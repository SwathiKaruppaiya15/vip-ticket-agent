"""
Redis async client — uses redis.asyncio (bundled in redis>=4.2).
aioredis is NOT used; it is redundant with redis>=5 and causes conflicts.
"""
from typing import Optional

import redis.asyncio as aioredis
from redis.asyncio import Redis

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

_redis_pool: Optional[Redis] = None


async def init_redis() -> Redis:
    """Create a connection pool and verify with PING."""
    global _redis_pool
    _redis_pool = aioredis.from_url(
        settings.REDIS_URL,
        encoding="utf-8",
        decode_responses=True,
        max_connections=20,
    )
    await _redis_pool.ping()
    logger.info("redis_connected", url=settings.REDIS_URL)
    return _redis_pool


async def close_redis() -> None:
    global _redis_pool
    if _redis_pool is not None:
        await _redis_pool.aclose()
        _redis_pool = None
        logger.info("redis_connection_closed")


def get_redis() -> Redis:
    """Return the active Redis pool. Raises if init_redis() was not called."""
    if _redis_pool is None:
        raise RuntimeError("Redis pool not initialised — call init_redis() first.")
    return _redis_pool
