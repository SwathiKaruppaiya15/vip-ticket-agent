"""
FastAPI dependency providers.

get_current_user   – decode JWT, check Redis blocklist, return User document
require_roles()    – factory that wraps get_current_user with a role guard
"""
from datetime import datetime, timezone
from typing import List

from fastapi import Depends, Query
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError

from app.core.security import decode_token, is_token_blocklisted
from app.models.user import User, UserRole
from app.utils.exceptions import ForbiddenException, UnauthorizedException

_bearer = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
) -> User:
    if not credentials:
        raise UnauthorizedException("Missing Authorization header.")

    token = credentials.credentials

    try:
        payload = decode_token(token)
    except JWTError:
        raise UnauthorizedException("Invalid or expired token.")

    if payload.get("type") != "access":
        raise UnauthorizedException("Expected an access token.")

    jti: str | None = payload.get("jti")
    if jti and await is_token_blocklisted(jti):
        raise UnauthorizedException("Token has been revoked. Please log in again.")

    user_id: str | None = payload.get("sub")
    if not user_id:
        raise UnauthorizedException("Invalid token payload.")

    user = await User.find_one(User.user_id == user_id)
    if not user or not user.is_active:
        raise UnauthorizedException("User not found or account is disabled.")

    return user


def require_roles(allowed: List[UserRole]):
    """
    Dependency factory — restricts an endpoint to specific roles.

    Usage:
        current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.MANAGER]))
    """
    async def _check(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed:
            raise ForbiddenException(
                f"Role '{current_user.role.value}' does not have access to this resource."
            )
        return current_user

    return _check


async def get_ws_user(token: str = Query(..., description="JWT access token")) -> User:
    """
    WebSocket auth dependency — token passed as query parameter because
    browser WebSocket APIs cannot send custom headers.
    """
    try:
        payload = decode_token(token)
    except JWTError:
        raise UnauthorizedException("Invalid or expired WebSocket token.")

    if payload.get("type") != "access":
        raise UnauthorizedException("Expected an access token.")

    jti = payload.get("jti")
    if jti and await is_token_blocklisted(jti):
        raise UnauthorizedException("Token revoked.")

    user_id = payload.get("sub")
    user = await User.find_one(User.user_id == user_id)
    if not user or not user.is_active:
        raise UnauthorizedException("User not found or inactive.")

    return user
