"""
Pytest configuration — async client, fake Redis, data factories.

Uses fakeredis>=2.x which works with redis.asyncio (redis>=5).
"""
import asyncio
import os
from datetime import datetime
from typing import AsyncGenerator
from uuid import uuid4

import pytest
import pytest_asyncio

# ── Environment (must come before any app import) ─────────────────────────────
os.environ.setdefault("MONGODB_URL",         "mongodb://localhost:27017/vipulse_test")
os.environ.setdefault("REDIS_URL",           "redis://localhost:6379/15")
os.environ.setdefault("GROQ_API_KEY",        "test-groq-key")
os.environ.setdefault("SECRET_KEY",          "test-secret-key-32-chars-minimum!!")
os.environ.setdefault("DISCORD_WEBHOOK_URL", "https://discord.com/api/webhooks/test/token")
os.environ.setdefault("GMAIL_USER",          "test@gmail.com")
os.environ.setdefault("GMAIL_APP_PASSWORD",  "test-app-password")
os.environ.setdefault("SENTRY_DSN",          "https://abc@sentry.io/0")
os.environ.setdefault("ENVIRONMENT",         "test")
os.environ.setdefault("DASHBOARD_URL",       "http://localhost:3000")
os.environ.setdefault("TEAM_EMAIL_MAP",      "")

# ── Inject fake Redis before app boots ────────────────────────────────────────
import fakeredis  # type: ignore

import app.core.redis_client as _redis_module  # noqa: E402

# fakeredis>=2.x: FakeRedis can be used as a drop-in for redis.asyncio.Redis
_fake_redis_instance = fakeredis.FakeRedis(decode_responses=True)
_redis_module._redis_pool = _fake_redis_instance  # type: ignore[assignment]

# ── Now safe to import the app ────────────────────────────────────────────────
from httpx import ASGITransport, AsyncClient  # noqa: E402
from main import app  # noqa: E402


# ── Event loop ────────────────────────────────────────────────────────────────
@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


# ── HTTP client ───────────────────────────────────────────────────────────────
@pytest_asyncio.fixture(scope="session")
async def client() -> AsyncGenerator[AsyncClient, None]:
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://testserver",
    ) as ac:
        yield ac


# ── Data factories ────────────────────────────────────────────────────────────
def make_ticket(**overrides) -> dict:
    base = {
        "ticket_id":         f"T-{uuid4().hex[:8].upper()}",
        "employee_id":       "EMP-001",
        "employee_name":     "Alice CEO",
        "role":              "Chief Executive Officer",
        "department":        "Executive",
        "issue_title":       "VPN not working — board call in 30 min",
        "issue_description": "My VPN has been down since 8am. I have a board call in 30 minutes.",
        "severity":          "critical",
        "priority":          "critical",
        "priority_score":    92.5,
        "vip_detected":      True,
        "vip_level":         "platinum",
        "vip_confidence":    0.95,
        "urgency_level":     "critical",
        "business_impact":   "severe",
        "category":          "Network",
        "subcategory":       "VPN",
        "assigned_team":     "VIP — Infrastructure Support Team",
        "sla_risk_score":    85.0,
        "ai_reasoning":      [
            "Detected CEO role — PLATINUM VIP.",
            "Network/VPN category.",
            "CRITICAL priority.",
        ],
        "status":            "open",
        "discord_notified":  False,
        "email_notified":    False,
        "created_at":        datetime.utcnow().isoformat(),
        "updated_at":        datetime.utcnow().isoformat(),
        "created_by":        "user-abc",
    }
    base.update(overrides)
    return base


def make_employee(**overrides) -> dict:
    base = {
        "employee_id": f"EMP-{uuid4().hex[:6].upper()}",
        "name":        "Alice CEO",
        "email":       f"alice-{uuid4().hex[:4]}@company.com",
        "role":        "Chief Executive Officer",
        "department":  "Executive",
        "vip_level":   "platinum",
        "is_active":   True,
    }
    base.update(overrides)
    return base


def make_user(**overrides) -> dict:
    uid = uuid4().hex[:8]
    base = {
        "username": f"user_{uid}",
        "email":    f"user_{uid}@vipulse.test",
        "password": "TestPass123!",
        "role":     "support_agent",
    }
    base.update(overrides)
    return base


# ── Auth helpers ──────────────────────────────────────────────────────────────
async def _get_token(client: AsyncClient, user_data: dict) -> str:
    resp = await client.post("/api/v1/auth/register", json=user_data)
    if resp.status_code in (200, 201):
        return resp.json()["data"]["tokens"]["access_token"]
    login = await client.post(
        "/api/v1/auth/login",
        json={"email": user_data["email"], "password": user_data["password"]},
    )
    assert login.status_code == 200, f"Login failed: {login.text}"
    return login.json()["data"]["tokens"]["access_token"]


@pytest_asyncio.fixture
async def auth_headers(client: AsyncClient) -> dict:
    user = make_user(username="support_main", email="support@vipulse.test")
    token = await _get_token(client, user)
    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture
async def admin_headers(client: AsyncClient) -> dict:
    user = make_user(username="admin_main", email="admin@vipulse.test", role="admin")
    token = await _get_token(client, user)
    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture
async def viewer_headers(client: AsyncClient) -> dict:
    user = make_user(username="viewer_main", email="viewer@vipulse.test", role="viewer")
    token = await _get_token(client, user)
    return {"Authorization": f"Bearer {token}"}
