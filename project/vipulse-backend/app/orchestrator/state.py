import operator
from typing import Annotated, List, Optional, TypedDict


class AgentState(TypedDict):
    # ── Input ──────────────────────────────────────────────────────────────────
    ticket_id: str
    employee_id: str
    employee_name: str
    role: str
    department: str
    issue_title: str
    issue_description: str
    severity: str

    # ── VIP Detection outputs ──────────────────────────────────────────────────
    vip_detected: bool
    vip_level: str                          # STANDARD | SILVER | GOLD | PLATINUM
    vip_confidence: float                   # 0-100
    vip_score_breakdown: dict

    # ── Priority outputs ───────────────────────────────────────────────────────
    priority_score: float                   # 0-100
    priority_label: str                     # LOW | MEDIUM | HIGH | CRITICAL
    priority_factors: List[str]

    # ── Urgency outputs ────────────────────────────────────────────────────────
    urgency_level: str
    business_impact: str
    detected_keywords: List[str]

    # ── Categorization ─────────────────────────────────────────────────────────
    category: str
    subcategory: str

    # ── Routing ────────────────────────────────────────────────────────────────
    assigned_team: str
    routing_reason: str

    # ── SLA ────────────────────────────────────────────────────────────────────
    sla_risk_score: float                   # 0-100
    sla_risk_level: str                     # LOW | MEDIUM | HIGH | CRITICAL
    sla_risk_factors: List[str]
    sla_deadline_hours: int

    # ── Explainability ─────────────────────────────────────────────────────────
    ai_reasoning: List[str]
    full_explanation: str

    # ── Notifications ──────────────────────────────────────────────────────────
    discord_sent: bool
    email_sent: bool

    # ── Errors (merged across all agents via operator.add) ─────────────────────
    errors: Annotated[List[str], operator.add]
