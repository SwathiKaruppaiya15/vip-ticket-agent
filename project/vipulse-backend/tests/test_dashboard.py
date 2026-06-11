"""
Integration tests for dashboard and analytics endpoints.
"""
import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


# ── /dashboard/stats ──────────────────────────────────────────────────────────

async def test_dashboard_stats_shape(client: AsyncClient, auth_headers: dict):
    resp = await client.get("/api/v1/dashboard/stats", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()["data"]
    required = [
        "today_total", "today_vip", "today_critical", "today_escalated",
        "sla_saved", "open_tickets", "avg_resolution_hours", "vip_percentage",
    ]
    for key in required:
        assert key in data, f"Missing key: {key}"


async def test_dashboard_stats_unauthenticated_401(client: AsyncClient):
    resp = await client.get("/api/v1/dashboard/stats")
    assert resp.status_code == 401


# ── /dashboard/charts/* ───────────────────────────────────────────────────────

async def test_chart_priority_distribution(client: AsyncClient, auth_headers: dict):
    resp = await client.get(
        "/api/v1/dashboard/charts/priority-distribution",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert "distribution" in resp.json()["data"]


async def test_chart_department_issues(client: AsyncClient, auth_headers: dict):
    resp = await client.get(
        "/api/v1/dashboard/charts/department-issues",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert "departments" in resp.json()["data"]


async def test_chart_escalation_trends(client: AsyncClient, auth_headers: dict):
    resp = await client.get(
        "/api/v1/dashboard/charts/escalation-trends",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    trends = resp.json()["data"]["trends"]
    assert isinstance(trends, list)
    assert len(trends) == 7  # always 7 days


async def test_chart_category_breakdown(client: AsyncClient, auth_headers: dict):
    resp = await client.get(
        "/api/v1/dashboard/charts/category-breakdown",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    categories = resp.json()["data"]["categories"]
    assert isinstance(categories, list)
    # Each item must have percentage
    for item in categories:
        assert "percentage" in item
        assert 0.0 <= item["percentage"] <= 100.0


# ── /dashboard/live-tickets ───────────────────────────────────────────────────

async def test_live_tickets_shape(client: AsyncClient, auth_headers: dict):
    resp = await client.get("/api/v1/dashboard/live-tickets", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert "tickets" in data
    assert "total" in data
    assert len(data["tickets"]) <= 20
    # Verify each item has required fields
    for ticket in data["tickets"]:
        assert "ticket_id" in ticket
        assert "priority" in ticket
        assert "sla_risk_score" in ticket
        assert "vip_detected" in ticket


# ── /dashboard/export ─────────────────────────────────────────────────────────

async def test_export_csv_requires_manager_role(client: AsyncClient, auth_headers: dict):
    """Regular support_agent should get 403."""
    resp = await client.post(
        "/api/v1/dashboard/export",
        json={"format": "csv", "filters": {}},
        headers=auth_headers,
    )
    assert resp.status_code == 403


async def test_export_csv_as_admin(client: AsyncClient, admin_headers: dict):
    """Admin can export CSV."""
    resp = await client.post(
        "/api/v1/dashboard/export",
        json={"format": "csv", "filters": {}},
        headers=admin_headers,
    )
    assert resp.status_code == 200
    assert "text/csv" in resp.headers.get("content-type", "")
    assert "attachment" in resp.headers.get("content-disposition", "")


async def test_export_pdf_as_admin(client: AsyncClient, admin_headers: dict):
    """Admin can export PDF (HTML fallback)."""
    resp = await client.post(
        "/api/v1/dashboard/export",
        json={"format": "pdf", "filters": {}},
        headers=admin_headers,
    )
    assert resp.status_code == 200
    assert "attachment" in resp.headers.get("content-disposition", "")


async def test_export_invalid_format_422(client: AsyncClient, admin_headers: dict):
    resp = await client.post(
        "/api/v1/dashboard/export",
        json={"format": "xlsx", "filters": {}},
        headers=admin_headers,
    )
    assert resp.status_code == 422


# ── /analytics/* ─────────────────────────────────────────────────────────────

async def test_analytics_vip_stats(client: AsyncClient, auth_headers: dict):
    resp = await client.get("/api/v1/analytics/vip-stats", headers=auth_headers)
    assert resp.status_code == 200
    assert "vip_stats" in resp.json()["data"]


async def test_analytics_sla_risk(client: AsyncClient, auth_headers: dict):
    resp = await client.get("/api/v1/analytics/sla-risk", headers=auth_headers)
    assert resp.status_code == 200
    assert "sla_risk_buckets" in resp.json()["data"]


async def test_analytics_resolution_time(client: AsyncClient, auth_headers: dict):
    resp = await client.get("/api/v1/analytics/resolution-time", headers=auth_headers)
    assert resp.status_code == 200
    assert "resolution_time_by_priority" in resp.json()["data"]


async def test_analytics_team_workload(client: AsyncClient, auth_headers: dict):
    resp = await client.get("/api/v1/analytics/team-workload", headers=auth_headers)
    assert resp.status_code == 200
    assert "team_workload" in resp.json()["data"]


async def test_analytics_hourly_volume(client: AsyncClient, auth_headers: dict):
    resp = await client.get("/api/v1/analytics/hourly-volume", headers=auth_headers)
    assert resp.status_code == 200
    assert "hourly_volume" in resp.json()["data"]
