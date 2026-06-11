from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

from app.models.ticket import Priority, TicketStatus, VIPLevel


# ── Request Schemas ───────────────────────────────────────────────────────────

class TicketCreateRequest(BaseModel):
    employee_id: str = Field(..., min_length=1)
    employee_name: str = Field(..., min_length=1, max_length=200)
    role: str = Field(..., min_length=1, max_length=100)
    department: str = Field(..., min_length=1, max_length=100)
    issue_title: str = Field(..., min_length=5, max_length=200)
    issue_description: str = Field(..., min_length=10, max_length=5000)
    severity: str = Field(..., pattern="^(low|medium|high|critical)$")


class TicketUpdateRequest(BaseModel):
    status: Optional[TicketStatus] = None
    assigned_team: Optional[str] = None
    assigned_agent: Optional[str] = None
    priority: Optional[Priority] = None


# ── Response Schemas ──────────────────────────────────────────────────────────

class TicketResponse(BaseModel):
    ticket_id: str
    employee_id: str
    employee_name: str
    role: str
    department: str
    issue_title: str
    issue_description: str
    severity: str
    category: Optional[str] = None
    subcategory: Optional[str] = None
    priority: Priority
    priority_score: float
    vip_detected: bool
    vip_level: Optional[VIPLevel] = None
    vip_confidence: float
    urgency_level: str
    business_impact: str
    assigned_team: Optional[str] = None
    assigned_agent: Optional[str] = None
    sla_risk_score: float
    sla_deadline: Optional[datetime] = None
    ai_reasoning: List[str]
    status: TicketStatus
    discord_notified: bool
    email_notified: bool
    created_at: datetime
    updated_at: datetime
    resolved_at: Optional[datetime] = None
    created_by: str

    model_config = {"from_attributes": True}


class TicketReasoningResponse(BaseModel):
    """Detailed explainability payload for GET /tickets/{id}/reasoning."""
    ticket_id: str
    priority_score: float
    priority_label: str
    vip_detected: bool
    vip_level: Optional[str]
    vip_confidence: float
    sla_risk_score: float
    sla_deadline: Optional[datetime]
    ai_reasoning: List[str]
    full_explanation: str = ""
    category: Optional[str]
    subcategory: Optional[str]
    assigned_team: Optional[str]
    urgency_level: str
    business_impact: str
    detected_keywords: List[str] = Field(default_factory=list)

    model_config = {"from_attributes": True}


class LiveTicketItem(BaseModel):
    """Slim ticket projection for the live dashboard feed."""
    ticket_id: str
    employee_name: str
    role: str
    priority: Priority
    status: TicketStatus
    vip_detected: bool
    sla_risk_score: float
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Paginated response envelope ───────────────────────────────────────────────

class PaginatedTickets(BaseModel):
    items: List[TicketResponse]
    total: int
    page: int
    pages: int
    page_size: int
    has_next: bool
    has_prev: bool


# kept for backward compatibility with any existing callers
class TicketListResponse(BaseModel):
    tickets: List[TicketResponse]
    total: int
    page: int
    page_size: int
