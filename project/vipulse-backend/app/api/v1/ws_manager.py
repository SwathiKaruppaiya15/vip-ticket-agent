"""
WebSocket connection manager with Redis pub/sub as the message broker.

Architecture:
  • Each API instance holds its own set of active WebSocket connections.
  • On ticket updates, the event is published to Redis channel "ws:tickets".
  • All instances subscribed to that channel broadcast to their local connections.
  • Horizontal scaling works without sticky sessions.

Uses redis.asyncio (bundled in redis>=5), NOT the separate aioredis package.
"""
import asyncio
import json
from typing import Any

import structlog
from fastapi import WebSocket

logger = structlog.get_logger(__name__)

CHANNEL = "ws:tickets"


class ConnectionManager:
    def __init__(self) -> None:
        self._connections: set[WebSocket] = set()

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        self._connections.add(ws)
        logger.info("ws_connected", total=len(self._connections))

    def disconnect(self, ws: WebSocket) -> None:
        self._connections.discard(ws)
        logger.info("ws_disconnected", total=len(self._connections))

    async def broadcast(self, payload: dict[str, Any]) -> None:
        """Send a JSON payload to every locally connected WebSocket client."""
        dead: set[WebSocket] = set()
        message = json.dumps(payload)
        for ws in list(self._connections):
            try:
                await ws.send_text(message)
            except Exception:
                dead.add(ws)
        for ws in dead:
            self._connections.discard(ws)

    # ── Redis pub/sub ─────────────────────────────────────────────────────────

    async def publish(self, payload: dict[str, Any]) -> None:
        """Publish an event so all instances receive and fan it out."""
        from app.core.redis_client import get_redis
        redis = get_redis()
        await redis.publish(CHANNEL, json.dumps(payload))

    async def start_subscriber(self) -> None:
        """
        Long-running coroutine — subscribe to the Redis channel and broadcast
        every received message to locally connected WebSocket clients.
        Launch once at startup via asyncio.create_task().
        """
        from app.core.redis_client import get_redis
        redis = get_redis()

        # redis.asyncio pubsub
        pubsub = redis.pubsub()
        await pubsub.subscribe(CHANNEL)
        logger.info("ws_redis_subscriber_started", channel=CHANNEL)

        try:
            # pubsub.listen() yields dicts: {"type": ..., "data": ...}
            async for message in pubsub.listen():
                if message.get("type") != "message":
                    continue
                try:
                    payload = json.loads(message["data"])
                    await self.broadcast(payload)
                except Exception as exc:
                    logger.error("ws_broadcast_error", error=str(exc))
        except asyncio.CancelledError:
            await pubsub.unsubscribe(CHANNEL)
            await pubsub.close()
            logger.info("ws_redis_subscriber_stopped")


# Module-level singleton used by the tickets router and ticket_service
manager = ConnectionManager()
