"""
Security utilities for VIPulse AI.

Token design:
  Every JWT carries:  sub (user_id), role, type, jti (UUID), iat, exp

Redis keys:
  refresh:{user_id}   → refresh token JTI, TTL = 7 days
  blocklist:{jti}     → "1", TTL = remaining access token lifetime

bcrypt compatibility:
  passlib 1.7.4 reads bcrypt.__about__.__version__ which was removed in bcrypt 4.x.
  We patch the missing attribute before creating the CryptContext so both
  bcrypt 3.x and 4.x work without errors.

Performance:
  hash_password is CPU-bound (~200ms). We expose an async version that runs it
  in asyncio's default ThreadPoolExecutor so it never blocks the event loop.
"""
import asyncio
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from typing import Any, Optional, Union
from uuid import uuid4

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

# ── bcrypt / passlib compatibility shim ──────────────────────────────────────
try:
    import bcrypt as _bcrypt_mod
    if not hasattr(_bcrypt_mod, "__about__"):
        class _About:
            __version__ = getattr(_bcrypt_mod, "__version__", "3.2.0")
        _bcrypt_mod.__about__ = _About()
except ImportError:
    pass

# ── Password context (rounds=10 → ~100ms; 12 → ~400ms; both NIST-compliant) ──
pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
    bcrypt__rounds=10,
)

# Thread pool for CPU-bound bcrypt work (2 workers is plenty)
_hash_executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="bcrypt")


def hash_password(plain: str) -> str:
    """Synchronous bcrypt hash — only call from thread/executor, not raw async."""
    return pwd_context.hash(plain)


async def hash_password_async(plain: str) -> str:
    """
    Async-safe password hashing.
    Runs synchronous bcrypt in a thread pool so the event loop stays free.
    Use this everywhere in FastAPI route handlers.
    """
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(_hash_executor, hash_password, plain)


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return pwd_context.verify(plain, hashed)
    except Exception:
        return False


async def verify_password_async(plain: str, hashed: str) -> bool:
    """Async-safe verify for use in route handlers."""
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(
        _hash_executor,
        verify_password,
        plain,
        hashed,
    )


# ── JWT helpers ───────────────────────────────────────────────────────────────

def _make_token(
    subject: Union[str, Any],
    role: str,
    expires_delta: timedelta,
    token_type: str,
) -> tuple[str, str]:
    """Create a signed JWT. Returns (encoded_token, jti)."""
    jti = str(uuid4())
    now = datetime.now(timezone.utc)
    expire = now + expires_delta
    payload = {
        "sub": str(subject),
        "role": role,
        "type": token_type,
        "jti": jti,
        "iat": now,
        "exp": expire,
    }
    token = jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return token, jti


def create_access_token(user_id: str, role: str) -> tuple[str, str]:
    """Returns (token, jti)."""
    return _make_token(
        user_id,
        role,
        timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        "access",
    )


def create_refresh_token(user_id: str, role: str) -> tuple[str, str]:
    """Returns (token, jti)."""
    return _make_token(
        user_id,
        role,
        timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        "refresh",
    )


def decode_token(token: str) -> dict:
    """Decode and return payload. Raises JWTError on failure."""
    return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])


# ── Redis token store helpers ─────────────────────────────────────────────────

REFRESH_KEY_PREFIX = "refresh:"
BLOCKLIST_KEY_PREFIX = "blocklist:"


def refresh_redis_key(user_id: str) -> str:
    return f"{REFRESH_KEY_PREFIX}{user_id}"


def blocklist_redis_key(jti: str) -> str:
    return f"{BLOCKLIST_KEY_PREFIX}{jti}"


async def store_refresh_token(user_id: str, jti: str) -> None:
    from app.core.redis_client import get_redis
    redis = get_redis()
    ttl = settings.REFRESH_TOKEN_EXPIRE_DAYS * 86_400
    await redis.set(refresh_redis_key(user_id), jti, ex=ttl)


async def verify_refresh_token_in_redis(user_id: str, jti: str) -> bool:
    from app.core.redis_client import get_redis
    redis = get_redis()
    stored = await redis.get(refresh_redis_key(user_id))
    return stored == jti


async def revoke_refresh_token(user_id: str) -> None:
    from app.core.redis_client import get_redis
    redis = get_redis()
    await redis.delete(refresh_redis_key(user_id))


async def blocklist_access_token(jti: str, exp: datetime) -> None:
    from app.core.redis_client import get_redis
    redis = get_redis()
    remaining = int((exp - datetime.now(timezone.utc)).total_seconds())
    if remaining > 0:
        await redis.set(blocklist_redis_key(jti), "1", ex=remaining)


async def is_token_blocklisted(jti: str) -> bool:
    from app.core.redis_client import get_redis
    redis = get_redis()
    return await redis.exists(blocklist_redis_key(jti)) == 1
