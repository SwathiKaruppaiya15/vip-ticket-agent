"""
Authentication routes
─────────────────────
POST /auth/register                    – create account
POST /auth/login                       – sign in (flags must_change_credentials)
POST /auth/refresh                     – rotate tokens
POST /auth/logout                      – invalidate session
GET  /auth/me                          – current user profile
PUT  /auth/change-initial-credentials  – first-login credential update (JWT required)

Dev only:
POST /auth/seed         – seed default users
GET  /auth/debug/users  – list all users
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError

from app.api.v1.dependencies import get_current_user
from app.core.config import settings
from app.core.security import (
    blocklist_access_token,
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password_async,
    is_token_blocklisted,
    revoke_refresh_token,
    store_refresh_token,
    verify_password,
    verify_password_async,
    verify_refresh_token_in_redis,
)
from app.models.user import User
from app.schemas.auth_schemas import (
    AuthResponse,
    ChangeInitialCredentialsRequest,
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    TokenResponse,
    UserResponse,
)
from app.utils.exceptions import ConflictException, UnauthorizedException
from app.utils.response import success_response

router  = APIRouter(prefix="/auth", tags=["Authentication"])
_bearer = HTTPBearer(auto_error=False)


# ── Internal helpers ──────────────────────────────────────────────────────────

def _user_out(user: User) -> UserResponse:
    return UserResponse(
        user_id=user.user_id,
        username=user.username,
        email=user.email,
        role=user.role,
        is_active=user.is_active,
        must_change_credentials=user.must_change_credentials,
        is_first_login=user.is_first_login,
    )


async def _issue_tokens(user: User) -> TokenResponse:
    """Issue a new access + refresh token pair and persist the refresh JTI."""
    access_token,  _           = create_access_token(user.user_id, user.role.value)
    refresh_token, refresh_jti = create_refresh_token(user.user_id, user.role.value)
    await store_refresh_token(user.user_id, refresh_jti)
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        must_change_credentials=user.must_change_credentials,
    )


# ── POST /auth/register ───────────────────────────────────────────────────────

@router.post(
    "/register",
    status_code=status.HTTP_201_CREATED,
    summary="Create a new account",
)
async def register(payload: RegisterRequest):
    """Register a new user. Returns JWT tokens on success."""
    if await User.find_one(User.email == payload.email):
        raise ConflictException("User", "email", payload.email)

    user = User(
        username=payload.username,
        email=payload.email,
        hashed_password=await hash_password_async(payload.password),
        role=payload.role,
        is_active=True,
        is_first_login=False,
        must_change_credentials=False,
    )
    await user.insert()

    tokens = await _issue_tokens(user)
    return success_response(
        data=AuthResponse(user=_user_out(user), tokens=tokens).model_dump(),
        message="Account created successfully.",
    )


# ── POST /auth/login ──────────────────────────────────────────────────────────

@router.post("/login", summary="Sign in")
async def login(payload: LoginRequest):
    """
    Authenticate with email + password.

    If the account has **must_change_credentials=true** (demo / first-login),
    the response includes `must_change_credentials: true` inside the token
    object **and** inside the user object. The client must redirect the user
    to /setup-account before allowing access to any protected page.

    **Demo credentials:** admin@vipulse.ai / admin123
    """
    user = await User.find_one(User.email == payload.email)
    if not user or not await verify_password_async(payload.password, user.hashed_password):
        raise UnauthorizedException("Invalid email or password.")

    if not user.is_active:
        raise UnauthorizedException("Account is disabled. Contact your administrator.")

    tokens = await _issue_tokens(user)

    try:
        await user.update({"$set": {"last_login": datetime.now(timezone.utc)}})
    except Exception:
        pass

    return success_response(
        data=AuthResponse(user=_user_out(user), tokens=tokens).model_dump(),
        message="Login successful."
        if not user.must_change_credentials
        else "Login successful. Please update your credentials.",
    )


# ── PUT /auth/change-initial-credentials ─────────────────────────────────────

@router.put(
    "/change-initial-credentials",
    summary="Update email & password (first-login setup)",
)
async def change_initial_credentials(
    payload: ChangeInitialCredentialsRequest,
    current_user: User = Depends(get_current_user),
):
    """
    First-login credential update. **Requires a valid JWT.**

    1. Verifies the current password.
    2. Ensures the new email is not already taken by another user.
    3. Hashes and saves the new password.
    4. Updates email.
    5. Sets is_first_login=False and must_change_credentials=False.
    6. Revokes current JWT session so the user must log in with new credentials.

    Returns a success message — client should log out and redirect to /login.
    """
    # 1. Verify current password
    if not await verify_password_async(payload.current_password, current_user.hashed_password):
        raise UnauthorizedException("Current password is incorrect.")

    # 2. Email uniqueness (allow keeping the same email)
    if payload.new_email != current_user.email:
        existing = await User.find_one(User.email == payload.new_email)
        if existing:
            raise ConflictException("User", "email", payload.new_email)

    # 3. Apply updates
    new_hash = await hash_password_async(payload.new_password)
    await current_user.update({
        "$set": {
            "email":                   payload.new_email,
            "hashed_password":         new_hash,
            "is_first_login":          False,
            "must_change_credentials": False,
            "updated_at":              datetime.now(timezone.utc),
        }
    })

    # 4. Revoke the current JWT session (force re-login with new credentials)
    await revoke_refresh_token(current_user.user_id)

    return success_response(
        message="Credentials updated successfully. Please login with your new credentials.",
    )


# ── POST /auth/refresh ────────────────────────────────────────────────────────

@router.post("/refresh", summary="Refresh tokens")
async def refresh(payload: RefreshRequest):
    """Exchange a valid refresh token for a new access + refresh pair (rotation)."""
    try:
        decoded = decode_token(payload.refresh_token)
    except JWTError:
        raise UnauthorizedException("Invalid or expired refresh token.")

    if decoded.get("type") != "refresh":
        raise UnauthorizedException("Expected a refresh token.")

    user_id: str = decoded.get("sub", "")
    jti: str     = decoded.get("jti", "")
    role: str    = decoded.get("role", "support_agent")

    if not await verify_refresh_token_in_redis(user_id, jti):
        raise UnauthorizedException("Refresh token is invalid or already used. Please log in again.")

    user = await User.find_one(User.user_id == user_id)
    if not user or not user.is_active:
        raise UnauthorizedException("User not found or account disabled.")

    await revoke_refresh_token(user_id)
    new_access,  _               = create_access_token(user_id, role)
    new_refresh, new_refresh_jti = create_refresh_token(user_id, role)
    await store_refresh_token(user_id, new_refresh_jti)

    return success_response(
        data=TokenResponse(
            access_token=new_access,
            refresh_token=new_refresh,
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            must_change_credentials=user.must_change_credentials,
        ).model_dump(),
        message="Tokens refreshed.",
    )


# ── POST /auth/logout ─────────────────────────────────────────────────────────

@router.post("/logout", status_code=status.HTTP_200_OK, summary="Sign out")
async def logout(credentials: HTTPAuthorizationCredentials = Depends(_bearer)):
    """Blocklist the access token and delete the refresh token."""
    if not credentials:
        raise UnauthorizedException("Missing Authorization header.")

    try:
        payload = decode_token(credentials.credentials)
    except JWTError:
        raise UnauthorizedException("Invalid token.")

    jti     = payload.get("jti", "")
    user_id = payload.get("sub", "")
    exp_ts  = payload.get("exp", 0)
    exp_dt  = datetime.fromtimestamp(exp_ts, tz=timezone.utc)

    await blocklist_access_token(jti, exp_dt)
    await revoke_refresh_token(user_id)

    return success_response(message="Logged out successfully.")


# ── GET /auth/me ──────────────────────────────────────────────────────────────

@router.get("/me", summary="Current user profile")
async def me(credentials: HTTPAuthorizationCredentials = Depends(_bearer)):
    """Return the authenticated user's profile including must_change_credentials flag."""
    if not credentials:
        raise UnauthorizedException("Missing Authorization header.")

    try:
        payload = decode_token(credentials.credentials)
    except JWTError:
        raise UnauthorizedException("Invalid or expired token.")

    if payload.get("type") != "access":
        raise UnauthorizedException("Expected an access token.")

    jti = payload.get("jti", "")
    if jti and await is_token_blocklisted(jti):
        raise UnauthorizedException("Token has been revoked. Please log in again.")

    user = await User.find_one(User.user_id == payload.get("sub"))
    if not user or not user.is_active:
        raise UnauthorizedException("User not found.")

    return success_response(data=_user_out(user).model_dump())


# ── Dev endpoints ─────────────────────────────────────────────────────────────

@router.post("/seed", tags=["Dev"], summary="Seed default users (dev only)")
async def seed_database():
    """Create seed users if DB is empty. Non-production only."""
    if settings.ENVIRONMENT == "production":
        raise UnauthorizedException("Seed endpoint disabled in production.")

    from app.core.seeder import seed_users
    await seed_users()
    count = await User.count()
    return success_response(
        data={"users_in_db": count},
        message="Seed complete. Login: admin@vipulse.ai / admin123",
    )


@router.get("/debug/users", tags=["Dev"], summary="List all users (dev only)")
async def debug_list_users():
    """Dev/staging only."""
    if settings.ENVIRONMENT == "production":
        raise UnauthorizedException("Debug endpoint disabled in production.")

    users = await User.find_all().to_list()
    return success_response(data={
        "count": len(users),
        "users": [
            {
                "email":                   u.email,
                "username":                u.username,
                "role":                    u.role.value,
                "is_active":               u.is_active,
                "is_first_login":          u.is_first_login,
                "must_change_credentials": u.must_change_credentials,
            }
            for u in users
        ],
    })
