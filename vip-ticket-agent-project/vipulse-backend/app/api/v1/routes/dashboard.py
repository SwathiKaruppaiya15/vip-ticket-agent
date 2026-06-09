"""
Dashboard routes — stats, charts, live feed, and export.

Caching strategy:
  /dashboard/stats              → Redis, TTL 60 s  (key: dashboard:stats:{date})
  /dashboard/charts/*           → Redis, TTL 300 s (key: dashboard:chart:{name})
  /dashboard/live-tickets       → no cache (real-time feed)
"""
import csv
import io
import json
from datetime import datetime, timedelta, timezone
from typing import Literal, Optional

import structlog
from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel

from app.api.v1.dependencies import get_current_user, require_roles
from app.core.redis_client import get_redis
from app.models.ticket import Ticket, TicketStatus, Priority
from app.models.user import User, UserRole
from app.schemas.ticket_schemas import LiveTicketItem
from app.utils.response import success_response

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])
logger = structlog.get_logger(__name__)

# ── Cache helpers ─────────────────────────────────────────────────────────────

async def _from_cache(key: str) -> Optional[dict]:
    try:
        redis = get_redis()
        raw = await redis.get(key)
        if raw:
            return json.loads(raw)
    except Exception as exc:
        logger.warning("dashboard_cache_miss", key=key, error=str(exc))
    return None


async def _to_cache(key: str, data: dict, ttl: int) -> None:
    try:
        redis = get_redis()
        await redis.set(key, json.dumps(data, default=str), ex=ttl)
    except Exception as exc:
        logger.warning("dashboard_cache_write_failed", key=key, error=str(exc))


# ── GET /dashboard/stats ──────────────────────────────────────────────────────

@router.get("/stats")
async def get_stats(current_user: User = Depends(get_current_user)):
    """
    Key metrics for the dashboard header widgets.
    Cached for 60 seconds (key includes today's date so it resets at midnight).
    """
    date_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    cache_key = f"dashboard:stats:{date_str}"

    cached = await _from_cache(cache_key)
    if cached:
        return success_response(data=cached)

    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)

    # Run all counts concurrently via MongoDB aggregations
    today_total = await Ticket.find({"created_at": {"$gte": today_start}}).count()
    today_vip = await Ticket.find({
        "created_at": {"$gte": today_start},
        "vip_detected": True,
    }).count()
    today_critical = await Ticket.find({
        "created_at": {"$gte": today_start},
        "priority": Priority.CRITICAL.value,
    }).count()
    today_escalated = await Ticket.find({
        "created_at": {"$gte": today_start},
        "status": TicketStatus.ESCALATED.value,
    }).count()

    # SLA saved = resolved before sla_deadline
    sla_saved_pipeline = [
        {
            "$match": {
                "status": TicketStatus.RESOLVED.value,
                "resolved_at": {"$ne": None},
                "sla_deadline": {"$ne": None},
            }
        },
        {
            "$match": {
                "$expr": {"$lt": ["$resolved_at", "$sla_deadline"]}
            }
        },
        {"$count": "total"},
    ]
    sla_saved_result = await Ticket.aggregate(sla_saved_pipeline).to_list()
    sla_saved = sla_saved_result[0]["total"] if sla_saved_result else 0

    open_tickets = await Ticket.find({"status": TicketStatus.OPEN.value}).count()

    # Average resolution hours
    avg_pipeline = [
        {
            "$match": {
                "status": TicketStatus.RESOLVED.value,
                "resolved_at": {"$ne": None},
            }
        },
        {
            "$project": {
                "hours": {
                    "$divide": [
                        {"$subtract": ["$resolved_at", "$created_at"]},
                        3_600_000,
                    ]
                }
            }
        },
        {"$group": {"_id": None, "avg": {"$avg": "$hours"}}},
    ]
    avg_result = await Ticket.aggregate(avg_pipeline).to_list()
    avg_resolution_hours = round(avg_result[0]["avg"], 2) if avg_result else 0.0

    total_all = await Ticket.count()
    vip_all = await Ticket.find({"vip_detected": True}).count()
    vip_percentage = round((vip_all / total_all * 100) if total_all else 0.0, 1)

    data = {
        "today_total": today_total,
        "today_vip": today_vip,
        "today_critical": today_critical,
        "today_escalated": today_escalated,
        "sla_saved": sla_saved,
        "open_tickets": open_tickets,
        "avg_resolution_hours": avg_resolution_hours,
        "vip_percentage": vip_percentage,
    }

    await _to_cache(cache_key, data, ttl=60)
    return success_response(data=data)


# ── GET /dashboard/charts/priority-distribution ───────────────────────────────

@router.get("/charts/priority-distribution")
async def chart_priority_distribution(current_user: User = Depends(get_current_user)):
    """Ticket count grouped by priority. Cached 5 minutes."""
    cache_key = "dashboard:chart:priority-distribution"
    cached = await _from_cache(cache_key)
    if cached:
        return success_response(data=cached)

    pipeline = [
        {"$group": {"_id": "$priority", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ]
    rows = await Ticket.aggregate(pipeline).to_list()
    # Normalise: {priority: "critical", count: 5}
    result = [{"priority": (r["_id"] or "unknown").upper(), "count": r["count"]} for r in rows]

    data = {"distribution": result}
    await _to_cache(cache_key, data, ttl=300)
    return success_response(data=data)


# ── GET /dashboard/charts/department-issues ───────────────────────────────────

@router.get("/charts/department-issues")
async def chart_department_issues(current_user: User = Depends(get_current_user)):
    """Ticket count grouped by department. Cached 5 minutes."""
    cache_key = "dashboard:chart:department-issues"
    cached = await _from_cache(cache_key)
    if cached:
        return success_response(data=cached)

    pipeline = [
        {"$group": {"_id": "$department", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 20},
    ]
    rows = await Ticket.aggregate(pipeline).to_list()
    result = [{"department": r["_id"] or "Unknown", "count": r["count"]} for r in rows]

    data = {"departments": result}
    await _to_cache(cache_key, data, ttl=300)
    return success_response(data=data)


# ── GET /dashboard/charts/escalation-trends ──────────────────────────────────

@router.get("/charts/escalation-trends")
async def chart_escalation_trends(current_user: User = Depends(get_current_user)):
    """Last 7 days of escalated vs total tickets per day. Cached 5 minutes."""
    cache_key = "dashboard:chart:escalation-trends"
    cached = await _from_cache(cache_key)
    if cached:
        return success_response(data=cached)

    now = datetime.now(timezone.utc)
    seven_days_ago = now - timedelta(days=7)

    pipeline = [
        {"$match": {"created_at": {"$gte": seven_days_ago}}},
        {
            "$group": {
                "_id": {
                    "$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}
                },
                "total": {"$sum": 1},
                "escalated": {
                    "$sum": {
                        "$cond": [
                            {"$eq": ["$status", TicketStatus.ESCALATED.value]},
                            1,
                            0,
                        ]
                    }
                },
            }
        },
        {"$sort": {"_id": 1}},
    ]
    rows = await Ticket.aggregate(pipeline).to_list()

    # Fill in any missing days with zeros
    day_map = {r["_id"]: r for r in rows}
    trend = []
    for i in range(7):
        day = (seven_days_ago + timedelta(days=i + 1)).strftime("%Y-%m-%d")
        entry = day_map.get(day, {"_id": day, "total": 0, "escalated": 0})
        trend.append({"date": day, "total": entry["total"], "escalated": entry["escalated"]})

    data = {"trends": trend}
    await _to_cache(cache_key, data, ttl=300)
    return success_response(data=data)


# ── GET /dashboard/charts/category-breakdown ─────────────────────────────────

@router.get("/charts/category-breakdown")
async def chart_category_breakdown(current_user: User = Depends(get_current_user)):
    """Category counts with percentage of total. Cached 5 minutes."""
    cache_key = "dashboard:chart:category-breakdown"
    cached = await _from_cache(cache_key)
    if cached:
        return success_response(data=cached)

    pipeline = [
        {"$group": {"_id": "$category", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ]
    rows = await Ticket.aggregate(pipeline).to_list()
    total = sum(r["count"] for r in rows) or 1

    result = [
        {
            "category": r["_id"] or "Uncategorised",
            "count": r["count"],
            "percentage": round(r["count"] / total * 100, 1),
        }
        for r in rows
    ]

    data = {"categories": result}
    await _to_cache(cache_key, data, ttl=300)
    return success_response(data=data)


# ── GET /dashboard/live-tickets ───────────────────────────────────────────────

@router.get("/live-tickets")
async def get_live_tickets(current_user: User = Depends(get_current_user)):
    """
    Top 20 open tickets sorted by priority_score descending.
    Not cached — this is the real-time triage feed.
    """
    tickets = (
        await Ticket.find({"status": TicketStatus.OPEN.value})
        .sort("-priority_score")
        .limit(20)
        .to_list()
    )
    items = [
        LiveTicketItem(
            ticket_id=t.ticket_id,
            employee_name=t.employee_name,
            role=t.role,
            priority=t.priority,
            status=t.status,
            vip_detected=t.vip_detected,
            sla_risk_score=t.sla_risk_score,
            created_at=t.created_at,
        ).model_dump()
        for t in tickets
    ]
    return success_response(data={"tickets": items, "total": len(items)})


# ── POST /dashboard/export ────────────────────────────────────────────────────

class ExportRequest(BaseModel):
    format: Literal["csv", "pdf"]
    filters: dict = {}


@router.post("/export")
async def export_tickets(
    payload: ExportRequest,
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.MANAGER])),
):
    """
    Export tickets as CSV or PDF.
    Requires MANAGER or ADMIN role.

    PDF export uses pure HTML→bytes fallback (no wkhtmltopdf dependency).
    For production-grade PDF, swap the renderer for WeasyPrint or Puppeteer.
    """
    # Build query from filters
    query: dict = {}
    f = payload.filters
    if f.get("status"):
        query["status"] = f["status"]
    if f.get("priority"):
        query["priority"] = f["priority"]
    if f.get("department"):
        query["department"] = f["department"]
    if f.get("vip_only"):
        query["vip_detected"] = True
    if f.get("date_from"):
        query.setdefault("created_at", {})["$gte"] = datetime.fromisoformat(f["date_from"])
    if f.get("date_to"):
        query.setdefault("created_at", {})["$lte"] = datetime.fromisoformat(f["date_to"])

    tickets = await Ticket.find(query).sort("-created_at").limit(5000).to_list()

    if payload.format == "csv":
        return _build_csv_response(tickets)
    else:
        return _build_pdf_response(tickets)


# ── Export helpers ────────────────────────────────────────────────────────────

_CSV_FIELDS = [
    "ticket_id", "employee_name", "role", "department",
    "issue_title", "severity", "category", "subcategory",
    "priority", "priority_score", "vip_detected", "vip_level",
    "urgency_level", "business_impact", "assigned_team",
    "sla_risk_score", "status", "created_at", "resolved_at",
]


def _build_csv_response(tickets: list[Ticket]) -> StreamingResponse:
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=_CSV_FIELDS, extrasaction="ignore")
    writer.writeheader()

    for t in tickets:
        row = t.model_dump(mode="json")
        # Flatten enum values
        row["priority"] = row.get("priority", "")
        row["vip_level"] = row.get("vip_level", "")
        row["status"] = row.get("status", "")
        writer.writerow({k: row.get(k, "") for k in _CSV_FIELDS})

    buf.seek(0)
    filename = f"vipulse_tickets_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.csv"
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _build_pdf_response(tickets: list[Ticket]) -> Response:
    """Minimal HTML-based PDF fallback. Replace with WeasyPrint for production."""
    rows_html = ""
    for t in tickets:
        rows_html += (
            f"<tr>"
            f"<td>{t.ticket_id}</td>"
            f"<td>{t.employee_name}</td>"
            f"<td>{t.role}</td>"
            f"<td>{t.department}</td>"
            f"<td>{t.issue_title[:60]}</td>"
            f"<td>{t.priority.value.upper()}</td>"
            f"<td>{'✅' if t.vip_detected else '❌'}</td>"
            f"<td>{t.status.value}</td>"
            f"<td>{t.created_at.strftime('%Y-%m-%d %H:%M') if t.created_at else ''}</td>"
            f"</tr>\n"
        )

    html = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>VIPulse Ticket Export</title>
  <style>
    body {{ font-family: Arial, sans-serif; font-size: 11px; }}
    h1 {{ color: #E74C3C; }}
    table {{ border-collapse: collapse; width: 100%; }}
    th {{ background: #2C3E50; color: white; padding: 6px 8px; text-align: left; }}
    td {{ padding: 4px 8px; border-bottom: 1px solid #ddd; }}
    tr:nth-child(even) {{ background: #f9f9f9; }}
  </style>
</head>
<body>
  <h1>VIPulse AI — Ticket Export</h1>
  <p>Generated: {datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")} · Total: {len(tickets)}</p>
  <table>
    <thead>
      <tr>
        <th>Ticket ID</th><th>Employee</th><th>Role</th><th>Department</th>
        <th>Issue</th><th>Priority</th><th>VIP</th><th>Status</th><th>Created</th>
      </tr>
    </thead>
    <tbody>
      {rows_html}
    </tbody>
  </table>
</body>
</html>"""

    filename = f"vipulse_tickets_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.html"
    return Response(
        content=html.encode("utf-8"),
        media_type="text/html",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )



