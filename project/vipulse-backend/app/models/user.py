from datetime import datetime, timezone
from enum import Enum
from typing import Optional
from uuid import uuid4

from beanie import Document
from pydantic import Field
from pymongo import ASCENDING, IndexModel


class UserRole(str, Enum):
    ADMIN         = "admin"
    SUPPORT_AGENT = "support_agent"
    MANAGER       = "manager"
    VIEWER        = "viewer"


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Document):
    user_id:          str       = Field(default_factory=lambda: str(uuid4()))
    username:         str
    email:            str
    hashed_password:  str
    role:             UserRole  = UserRole.SUPPORT_AGENT
    is_active:        bool      = True
    created_at:       datetime  = Field(default_factory=_utcnow)
    last_login:       Optional[datetime] = None

    # ── First-login credential-change fields ──────────────────────────────────
    is_first_login:          bool = False
    must_change_credentials: bool = False

    class Settings:
        name = "users"
        indexes = [
            IndexModel([("email",   ASCENDING)], unique=True),
            IndexModel([("user_id", ASCENDING)], unique=True),
        ]
