"""
Analytics routes — deeper aggregations with Redis caching (TTL 5 min).
"""
import json
from datetime import datetime, timedelta, timezone

import structlog
from fastapi import APIRouter, Depends

from app.api.v1.dependencies import get_current_user
from app.core.redis_client import get_redis
from app.models.ticket import Ticket, TicketStatus
from app.models.user import User
from app.utils.response import success_response

router = APIRouter(prefix="/analytics", tags=["Analytics"])
logger = structlog.get_logger(__name__)

_CACHE_TTL = 300  # 5 minutes


async def _cached(key: str, pipeline, transform=None):
    """Run a MongoDB aggregation with Redis read-through cache."""
    try:
        redis = get_redis()
        raw = await redis.get(key)
        if raw:
            return json.loads(raw)
    except Exception as exc:
        logger.warning("analytics_cache_miss", key=key, error=str(exc))

    result = await Ticket.aggregate(pipeline).to_list()
    data = transform(result) if transform else result

    try:
        redis = get_redis()
        await redis.set(key, json.dumps(data, default=str), ex=_CACHE_TTL)
    except Exception as exc:
        logger.warning("analytics_cache_write_failed", key=key, error=str(exc))

    return data


# ── GET /analytics/priority-distribution ─────────────────────────────────────

@router.get("/priority-distribution")
async def priority_distribution(current_user: User = Depends(get_current_user)):
    """Ticket counts by priority label. Cached 5 min."""
    pipeline = [
        {"$group": {"_id": "$priority", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ]
    result = await _cached("analytics:priority-distribution", pipeline)
    distribution = [
        {"priority": (r.get("_id") or "unknown").upper(), "count": r["count"]}
        for r in result
    ]
    return success_response(data={"distribution": distribution})


# ── GET /analytics/category-distribution ─────────────────────────────────────

@router.get("/category-distribution")
async def category_distribution(current_user: User = Depends(get_current_user)):
    """Ticket counts by AI-classified category. Cached 5 min."""
    pipeline = [
        {"$group": {"_id": "$category", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ]
    result = await _cached("analytics:category-distribution", pipeline)
    distribution = [
        {"category": r.get("_id") or "Uncategorised", "count": r["count"]}
        for r in result
    ]
    return success_response(data={"distribution": distribution})


# ── GET /analytics/vip-stats ──────────────────────────────────────────────────

@router.get("/vip-stats")
async def vip_statistics(current_user: User = Depends(get_current_user)):
    """Per-VIP-level aggregates: ticket count, avg priority score, avg SLA risk."""
    pipeline = [
        {"$match": {"vip_detected": True}},
        {
            "$group": {
                "_id": "$vip_level",
                "count": {"$sum": 1},
                "avg_priority_score": {"$avg": "$priority_score"},
                "avg_sla_risk":       {"$avg": "$sla_risk_score"},
                "avg_vip_confidence": {"$avg": "$vip_confidence"},
            }
        },
        {"$sort": {"count": -1}},
    ]
    result = await _cached("analytics:vip-stats", pipeline)
    stats = [
        {
            "vip_level":          (r.get("_id") or "STANDARD").upper(),
            "count":              r["count"],
            "avg_priority_score": round(r.get("avg_priority_score") or 0, 1),
            "avg_sla_risk":       round(r.get("avg_sla_risk") or 0, 1),
            "avg_vip_confidence": round((r.get("avg_vip_confidence") or 0) * 100, 1),
        }
        for r in result
    ]
    return success_response(data={"vip_stats": stats})


# ── GET /analytics/sla-risk ───────────────────────────────────────────────────

@router.get("/sla-risk")
async def sla_risk_breakdown(current_user: User = Depends(get_current_user)):
    """SLA risk scores bucketed into four bands (0-25, 25-50, 50-75, 75-100)."""
    pipeline = [
        {
            "$bucket": {
                "groupBy":    "$sla_risk_score",
                "boundaries": [0, 25, 50, 75, 100],
                "default":    "100+",
                "output":     {"count": {"$sum": 1}},
            }
        }
    ]

    def _label(result):
        labels = {0: "0-25 (LOW)", 25: "25-50 (MEDIUM)", 50: "50-75 (HIGH)", 75: "75-100 (CRITICAL)"}
        return [
            {"band": labels.get(r["_id"], str(r["_id"])), "count": r["count"]}
            for r in result
        ]

    data = await _cached("analytics:sla-risk", pipeline, transform=_label)
    return success_response(data={"sla_risk_buckets": data})


# ── GET /analytics/resolution-time ────────────────────────────────────────────

@router.get("/resolution-time")
async def avg_resolution_time(current_user: User = Depends(get_current_user)):
    """Average resolution hours per priority level (resolved tickets only)."""
    pipeline = [
        {"$match": {"status": TicketStatus.RESOLVED.value, "resolved_at": {"$ne": None}}},
        {
            "$project": {
                "resolution_hours": {
                    "$divide": [
                        {"$subtract": ["$resolved_at", "$created_at"]},
                        3_600_000,  # ms → hours
                    ]
                },
                "priority": 1,
            }
        },
        {
            "$group": {
                "_id":       "$priority",
                "avg_hours": {"$avg": "$resolution_hours"},
                "min_hours": {"$min": "$resolution_hours"},
                "max_hours": {"$max": "$resolution_hours"},
                "count":     {"$sum": 1},
            }
        },
        {"$sort": {"avg_hours": 1}},
    ]
    result = await _cached("analytics:resolution-time", pipeline)
    data = [
        {
            "priority":   (r.get("_id") or "unknown").upper(),
            "avg_hours":  round(r.get("avg_hours") or 0, 2),
            "min_hours":  round(r.get("min_hours") or 0, 2),
            "max_hours":  round(r.get("max_hours") or 0, 2),
            "count":      r["count"],
        }
        for r in result
    ]
    return success_response(data={"resolution_time_by_priority": data})


# ── GET /analytics/team-workload ──────────────────────────────────────────────

@router.get("/team-workload")
async def team_workload(current_user: User = Depends(get_current_user)):
    """Open ticket count per assigned team — shows current queue depth."""
    pipeline = [
        {"$match": {"status": {"$in": ["open", "in_progress"]}}},
        {
            "$group": {
                "_id":            "$assigned_team",
                "open_tickets":   {"$sum": 1},
                "avg_sla_risk":   {"$avg": "$sla_risk_score"},
                "critical_count": {
                    "$sum": {"$cond": [{"$eq": ["$priority", "critical"]}, 1, 0]}
                },
            }
        },
        {"$sort": {"open_tickets": -1}},
    ]
    result = await _cached("analytics:team-workload", pipeline)
    data = [
        {
            "team":           r.get("_id") or "Unassigned",
            "open_tickets":   r["open_tickets"],
            "avg_sla_risk":   round(r.get("avg_sla_risk") or 0, 1),
            "critical_count": r.get("critical_count", 0),
        }
        for r in result
    ]
    return success_response(data={"team_workload": data})


# ── GET /analytics/hourly-volume ──────────────────────────────────────────────

@router.get("/hourly-volume")
async def hourly_volume(current_user: User = Depends(get_current_user)):
    """Ticket creation volume by hour-of-day (last 30 days). Useful for staffing."""
    thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
    pipeline = [
        {"$match": {"created_at": {"$gte": thirty_days_ago}}},
        {
            "$group": {
                "_id":   {"$hour": "$created_at"},
                "count": {"$sum": 1},
            }
        },
        {"$sort": {"_id": 1}},
    ]
    result = await _cached("analytics:hourly-volume", pipeline)
    data = [{"hour": r["_id"], "count": r["count"]} for r in result]
    return success_response(data={"hourly_volume": data})
