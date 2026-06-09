from datetime import datetime, timezone
from enum import Enum
from typing import List, Optional
from uuid import uuid4

from beanie import Document
from pydantic import Field
from pymongo import ASCENDING, DESCENDING, IndexModel


class TicketStatus(str, Enum):
    OPEN        = "open"
    IN_PROGRESS = "in_progress"
    RESOLVED    = "resolved"
    ESCALATED   = "escalated"
    SLA_BREACHED= "sla_breached"


class Priority(str, Enum):
    LOW      = "low"
    MEDIUM   = "medium"
    HIGH     = "high"
    CRITICAL = "critical"


class VIPLevel(str, Enum):
    STANDARD = "standard"
    SILVER   = "silver"
    GOLD     = "gold"
    PLATINUM = "platinum"


def _generate_ticket_id() -> str:
    return f"T-{uuid4().hex[:8].upper()}"


def _utcnow() -> datetime:
    """Always returns a timezone-aware UTC datetime."""
    return datetime.now(timezone.utc)


class Ticket(Document):
    # ── Identity ──────────────────────────────────────────────────────────────
    ticket_id:         str = Field(default_factory=_generate_ticket_id)
    employee_id:       str
    employee_name:     str
    role:              str
    department:        str

    # ── Issue ─────────────────────────────────────────────────────────────────
    issue_title:       str
    issue_description: str
    severity:          str
    category:          Optional[str] = None
    subcategory:       Optional[str] = None

    # ── Priority / Scoring ────────────────────────────────────────────────────
    priority:          Priority = Priority.MEDIUM
    priority_score:    float    = 0.0          # 0-100

    # ── VIP Detection ─────────────────────────────────────────────────────────
    vip_detected:      bool               = False
    vip_level:         Optional[VIPLevel] = None
    vip_confidence:    float              = 0.0   # 0-1

    # ── Urgency & Impact ──────────────────────────────────────────────────────
    urgency_level:     str = "low"
    business_impact:   str = "minimal"

    # ── Routing ───────────────────────────────────────────────────────────────
    assigned_team:     Optional[str] = None
    assigned_agent:    Optional[str] = None

    # ── SLA ───────────────────────────────────────────────────────────────────
    sla_risk_score:    float              = 0.0
    sla_deadline:      Optional[datetime] = None

    # ── Explainability ────────────────────────────────────────────────────────
    ai_reasoning:      List[str] = Field(default_factory=list)

    # ── Status & Notifications ────────────────────────────────────────────────
    status:            TicketStatus = TicketStatus.OPEN
    discord_notified:  bool         = False
    email_notified:    bool         = False

    # ── Timestamps (timezone-aware UTC) ───────────────────────────────────────
    created_at:        datetime          = Field(default_factory=_utcnow)
    updated_at:        datetime          = Field(default_factory=_utcnow)
    resolved_at:       Optional[datetime]= None

    # ── Audit ─────────────────────────────────────────────────────────────────
    created_by:        str   # user_id of the submitting user

    # ── Soft delete ───────────────────────────────────────────────────────────
    is_deleted:        bool             = False
    deleted_at:        Optional[datetime]= None
    deleted_by:        Optional[str]    = None   # user_id who deleted

    class Settings:
        name = "tickets"
        indexes = [
            IndexModel([("ticket_id",   ASCENDING)],  unique=True),
            IndexModel([("employee_id", ASCENDING)]),
            IndexModel([("priority",    ASCENDING), ("created_at", DESCENDING)]),
            IndexModel([("vip_detected",ASCENDING)]),
            IndexModel([("status",      ASCENDING)]),
            IndexModel([("created_at",  DESCENDING)]),
            IndexModel([("is_deleted",  ASCENDING)]),  # fast filter of soft-deleted
        ]
