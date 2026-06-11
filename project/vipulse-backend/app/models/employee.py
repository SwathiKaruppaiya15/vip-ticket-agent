from datetime import datetime, timezone
from typing import Optional

from beanie import Document
from pydantic import Field
from pymongo import ASCENDING, IndexModel

from app.models.ticket import VIPLevel


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Employee(Document):
    employee_id:        str
    name:               str
    email:              str
    role:               str
    department:         str
    vip_level:          VIPLevel        = VIPLevel.STANDARD
    vip_score_override: Optional[float] = None   # Manual override (0-100)
    is_active:          bool            = True
    created_at:         datetime        = Field(default_factory=_utcnow)
    updated_at:         datetime        = Field(default_factory=_utcnow)

    class Settings:
        name = "vip_employees"
        indexes = [
            IndexModel([("employee_id", ASCENDING)], unique=True),
            IndexModel([("email",       ASCENDING)], unique=True),
        ]
