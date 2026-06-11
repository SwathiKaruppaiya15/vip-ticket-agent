"""
Integration tests for the /api/v1/tickets endpoints.

Phase 3 notes:
  - POST /tickets/ returns 202 Accepted (background pipeline).
  - GET /tickets/ returns paginated envelope: {items, total, page, pages, ...}
  - GET /tickets/{id}/reasoning returns explainability payload.
"""
import pytest
from httpx import AsyncClient

from tests.conftest import make_ticket_payload

pytestmark = pytest.mark.asyncio


# ── POST /tickets/ ────────────────────────────────────────────────────────────

async def test_create_ticket_returns_202(client: AsyncClient, auth_headers: dict):
    """Ticket creation should be accepted immediately (202) before pipeline runs."""
    payload = make_ticket_payload()
    resp = await client.post("/api/v1/tickets/", json=payload, headers=auth_headers)

    assert resp.status_code == 202, resp.text
    data = resp.json()
    assert data["success"] is True
    assert "ticket_id" in data["data"]
    assert data["data"]["ticket_id"].startswith("T-")
    # At this point the AI fields are empty — pipeline runs in background
    assert data["data"]["status"] == "open"


async def test_create_ticket_missing_fields_422(client: AsyncClient, auth_headers: dict):
    """Incomplete payload must be rejected with 422."""
    resp = await client.post(
        "/api/v1/tickets/",
        json={"employee_id": "EMP-002"},
        headers=auth_headers,
    )
    assert resp.status_code == 422


async def test_create_ticket_invalid_severity_422(client: AsyncClient, auth_headers: dict):
    """severity must be one of: low | medium | high | critical."""
    payload = make_ticket_payload(severity="extreme")
    resp = await client.post("/api/v1/tickets/", json=payload, headers=auth_headers)
    assert resp.status_code == 422


async def test_create_ticket_unauthenticated_401(client: AsyncClient):
    """No token → 401."""
    resp = await client.post("/api/v1/tickets/", json=make_ticket_payload())
    assert resp.status_code == 401


# ── GET /tickets/ ─────────────────────────────────────────────────────────────

async def test_list_tickets_paginated(client: AsyncClient, auth_headers: dict):
    """Response must include pagination envelope fields."""
    resp = await client.get("/api/v1/tickets/", headers=auth_headers)
    assert resp.status_code == 200

    data = resp.json()
    assert data["success"] is True

    d = data["data"]
    assert "items" in d
    assert "total" in d
    assert "page" in d
    assert "pages" in d
    assert "has_next" in d
    assert "has_prev" in d
    assert isinstance(d["items"], list)


async def test_list_tickets_page_size(client: AsyncClient, auth_headers: dict):
    """page_size query param must be respected."""
    resp = await client.get(
        "/api/v1/tickets/",
        params={"page": 1, "page_size": 5},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    items = resp.json()["data"]["items"]
    assert len(items) <= 5


async def test_list_tickets_vip_filter(client: AsyncClient, auth_headers: dict):
    """vip_only=true must return only VIP tickets."""
    resp = await client.get(
        "/api/v1/tickets/",
        params={"vip_only": True},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    for ticket in resp.json()["data"]["items"]:
        assert ticket["vip_detected"] is True


async def test_list_tickets_status_filter(client: AsyncClient, auth_headers: dict):
    """status filter must only return tickets with matching status."""
    resp = await client.get(
        "/api/v1/tickets/",
        params={"status": "open"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    for ticket in resp.json()["data"]["items"]:
        assert ticket["status"] == "open"


async def test_list_tickets_department_filter(client: AsyncClient, auth_headers: dict):
    """department filter must work."""
    resp = await client.get(
        "/api/v1/tickets/",
        params={"department": "Engineering"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    for ticket in resp.json()["data"]["items"]:
        assert ticket["department"] == "Engineering"


async def test_list_tickets_unauthenticated_401(client: AsyncClient):
    resp = await client.get("/api/v1/tickets/")
    assert resp.status_code == 401


# ── GET /tickets/{ticket_id} ──────────────────────────────────────────────────

async def test_get_ticket_not_found_404(client: AsyncClient, auth_headers: dict):
    resp = await client.get("/api/v1/tickets/T-DOESNOTEXIST", headers=auth_headers)
    assert resp.status_code == 404
    assert resp.json()["success"] is False


async def test_get_ticket_roundtrip(client: AsyncClient, auth_headers: dict):
    """Create a ticket then retrieve it by ID."""
    # Create
    create_resp = await client.post(
        "/api/v1/tickets/",
        json=make_ticket_payload(),
        headers=auth_headers,
    )
    assert create_resp.status_code == 202
    ticket_id = create_resp.json()["data"]["ticket_id"]

    # Retrieve
    get_resp = await client.get(f"/api/v1/tickets/{ticket_id}", headers=auth_headers)
    assert get_resp.status_code == 200
    assert get_resp.json()["data"]["ticket_id"] == ticket_id


# ── PATCH /tickets/{ticket_id} ────────────────────────────────────────────────

async def test_update_ticket_status(client: AsyncClient, auth_headers: dict):
    """PATCH should update status and return the modified ticket."""
    # Create first
    create_resp = await client.post(
        "/api/v1/tickets/",
        json=make_ticket_payload(),
        headers=auth_headers,
    )
    ticket_id = create_resp.json()["data"]["ticket_id"]

    # Update status
    patch_resp = await client.patch(
        f"/api/v1/tickets/{ticket_id}",
        json={"status": "in_progress"},
        headers=auth_headers,
    )
    assert patch_resp.status_code == 200
    assert patch_resp.json()["data"]["status"] == "in_progress"


# ── GET /tickets/{ticket_id}/reasoning ───────────────────────────────────────

async def test_get_ticket_reasoning(client: AsyncClient, auth_headers: dict):
    """Reasoning endpoint must return the explainability fields."""
    # Create a ticket first
    create_resp = await client.post(
        "/api/v1/tickets/",
        json=make_ticket_payload(),
        headers=auth_headers,
    )
    ticket_id = create_resp.json()["data"]["ticket_id"]

    resp = await client.get(
        f"/api/v1/tickets/{ticket_id}/reasoning",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert "ticket_id" in data
    assert "priority_score" in data
    assert "ai_reasoning" in data
    assert "priority_label" in data
    assert isinstance(data["ai_reasoning"], list)


# ── Auth flow ─────────────────────────────────────────────────────────────────

async def test_login_and_refresh(client: AsyncClient):
    """Full auth flow: register → login → refresh."""
    import time

    unique = str(int(time.time()))

    # Register
    reg = await client.post(
        "/api/v1/auth/register",
        json={
            "username": f"flowuser_{unique}",
            "email": f"flow_{unique}@vipulse.test",
            "password": "FlowPass123!",
            "role": "support_agent",
        },
    )
    assert reg.status_code == 201
    refresh_token = reg.json()["data"]["tokens"]["refresh_token"]

    # Refresh
    ref = await client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": refresh_token},
    )
    assert ref.status_code == 200
    assert "access_token" in ref.json()["data"]


async def test_logout_blocklists_token(client: AsyncClient):
    """After logout, the old access token must be rejected."""
    import time

    unique = str(int(time.time()))

    reg = await client.post(
        "/api/v1/auth/register",
        json={
            "username": f"logoutuser_{unique}",
            "email": f"logout_{unique}@vipulse.test",
            "password": "LogoutPass123!",
            "role": "support_agent",
        },
    )
    assert reg.status_code == 201
    access_token = reg.json()["data"]["tokens"]["access_token"]
    headers = {"Authorization": f"Bearer {access_token}"}

    # Logout
    logout_resp = await client.post("/api/v1/auth/logout", headers=headers)
    assert logout_resp.status_code == 200

    # Old token should now be rejected
    me_resp = await client.get("/api/v1/auth/me", headers=headers)
    assert me_resp.status_code == 401
