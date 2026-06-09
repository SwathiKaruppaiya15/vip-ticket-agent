from typing import List, Type

from beanie import Document, init_beanie
from motor.motor_asyncio import AsyncIOMotorClient

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

_motor_client: AsyncIOMotorClient | None = None


def get_motor_client() -> AsyncIOMotorClient:
    global _motor_client
    if _motor_client is None:
        _motor_client = AsyncIOMotorClient(
            settings.MONGODB_URL,
            serverSelectionTimeoutMS=5000,
            connectTimeoutMS=5000,
        )
    return _motor_client


async def init_db(document_models: List[Type[Document]]) -> None:
    """Initialise Beanie with all document models."""
    client = get_motor_client()
    await init_beanie(
        database=client[settings.MONGODB_DB_NAME],
        document_models=document_models,
    )
    logger.info("beanie_initialised", database=settings.MONGODB_DB_NAME)


async def close_db() -> None:
    global _motor_client
    if _motor_client is not None:
        _motor_client.close()
        _motor_client = None
        logger.info("mongodb_connection_closed")
