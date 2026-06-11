"""
Unit + integration tests for the authentication system.
JWT structure, Redis blocklist, refresh rotation.
"""
import time

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


def _unique_user(suffix: str = "") -> dict:
    ts = str(int(time.time() * 1000))
    return {
        "username": f"user_{ts}{suffix}",
        "email": f"user_{ts}{suffix}@test.vipulse",
        "password": "SecurePass123!",
        "role": "support_agent",
    }


# ── Register ──────────────────────────────────────────────────────────────────

async def test_register_success(client: AsyncClient):
    user = _unique_user("_reg")
    resp = await client.post("/api/v1/auth/register", json=user)
    assert resp.status_code == 201
    data = resp.json()
    assert data["success"] is True
    assert "access_token" in data["data"]["tokens"]
    assert "refresh_token" in data["data"]["tokens"]
    assert data["data"]["tokens"]["token_type"] == "bearer"
    assert "expires_in" in data["data"]["tokens"]
    # password must NOT appear in response
    assert "password" not in str(data["data"]["user"])
    assert "hashed_password" not in str(data["data"]["user"])


async def test_register_duplicate_email_409(client: AsyncClient):
    user = _unique_user("_dup")
    await client.post("/api/v1/auth/register", json=user)
    resp = await client.post("/api/v1/auth/register", json=user)
    assert resp.status_code == 409


async def test_register_short_password_422(client: AsyncClient):
    user = {**_unique_user("_short"), "password": "abc"}
    resp = await client.post("/api/v1/auth/register", json=user)
    assert resp.status_code == 422


async def test_register_invalid_email_422(client: AsyncClient):
    user = {**_unique_user("_bademail"), "email": "not-an-email"}
    resp = await client.post("/api/v1/auth/register", json=user)
    assert resp.status_code == 422


# ── Login ─────────────────────────────────────────────────────────────────────

async def test_login_success(client: AsyncClient):
    user = _unique_user("_login")
    await client.post("/api/v1/auth/register", json=user)

    resp = await client.post(
        "/api/v1/auth/login",
        json={"email": user["email"], "password": user["password"]},
    )
    assert resp.status_code == 200
    tokens = resp.json()["data"]["tokens"]
    assert tokens["access_token"]
    assert tokens["refresh_token"]


async def test_login_wrong_password_401(client: AsyncClient):
    user = _unique_user("_wrongpw")
    await client.post("/api/v1/auth/register", json=user)

    resp = await client.post(
        "/api/v1/auth/login",
        json={"email": user["email"], "password": "WrongPassword!"},
    )
    assert resp.status_code == 401


async def test_login_unknown_email_401(client: AsyncClient):
    resp = await client.post(
        "/api/v1/auth/login",
        json={"email": "nobody@nowhere.com", "password": "anything"},
    )
    assert resp.status_code == 401


# ── JWT payload structure ─────────────────────────────────────────────────────

async def test_access_token_contains_jti_and_role(client: AsyncClient):
    """Decode the JWT header to verify it carries jti and role claims."""
    from jose import jwt as jose_jwt
    import os

    user = _unique_user("_jwt")
    reg = await client.post("/api/v1/auth/register", json=user)
    token = reg.json()["data"]["tokens"]["access_token"]

    secret = os.environ["SECRET_KEY"]
    payload = jose_jwt.decode(token, secret, algorithms=["HS256"])

    assert "jti" in payload, "JWT must carry a jti claim for blocklisting"
    assert "role" in payload, "JWT must carry the user role"
    assert "sub" in payload
    assert payload["type"] == "access"


# ── Refresh ───────────────────────────────────────────────────────────────────

async def test_refresh_rotates_tokens(client: AsyncClient):
    """Refresh token should be rotated — old one must no longer work."""
    user = _unique_user("_rot")
    reg = await client.post("/api/v1/auth/register", json=user)
    old_refresh = reg.json()["data"]["tokens"]["refresh_token"]

    # Use the refresh token
    r1 = await client.post("/api/v1/auth/refresh", json={"refresh_token": old_refresh})
    assert r1.status_code == 200
    new_access = r1.json()["data"]["access_token"]
    assert new_access  # got a new access token

    # Old refresh token must now be rejected (rotated out of Redis)
    r2 = await client.post("/api/v1/auth/refresh", json={"refresh_token": old_refresh})
    assert r2.status_code == 401


async def test_refresh_with_access_token_rejected(client: AsyncClient):
    """Sending an access token to /refresh must be rejected."""
    user = _unique_user("_accref")
    reg = await client.post("/api/v1/auth/register", json=user)
    access_token = reg.json()["data"]["tokens"]["access_token"]

    resp = await client.post("/api/v1/auth/refresh", json={"refresh_token": access_token})
    assert resp.status_code == 401


# ── Logout + blocklist ────────────────────────────────────────────────────────

async def test_logout_invalidates_access_token(client: AsyncClient):
    """Logging out must blocklist the access token in Redis."""
    user = _unique_user("_out")
    reg = await client.post("/api/v1/auth/register", json=user)
    access = reg.json()["data"]["tokens"]["access_token"]
    headers = {"Authorization": f"Bearer {access}"}

    # Confirm token works
    me = await client.get("/api/v1/auth/me", headers=headers)
    assert me.status_code == 200

    # Logout
    logout = await client.post("/api/v1/auth/logout", headers=headers)
    assert logout.status_code == 200

    # Token must now be rejected
    me_after = await client.get("/api/v1/auth/me", headers=headers)
    assert me_after.status_code == 401


async def test_logout_without_token_401(client: AsyncClient):
    resp = await client.post("/api/v1/auth/logout")
    assert resp.status_code == 401


# ── GET /auth/me ──────────────────────────────────────────────────────────────

async def test_me_returns_profile(client: AsyncClient):
    user = _unique_user("_me")
    reg = await client.post("/api/v1/auth/register", json=user)
    access = reg.json()["data"]["tokens"]["access_token"]

    resp = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {access}"},
    )
    assert resp.status_code == 200
    profile = resp.json()["data"]
    assert profile["email"] == user["email"]
    assert profile["username"] == user["username"]
    assert "hashed_password" not in profile
