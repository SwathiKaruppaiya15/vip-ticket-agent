"""
Notification Agent — in-pipeline notification step.

Triggers when ANY of:
  • vip_detected is True
  • priority_label is HIGH or CRITICAL
  • sla_risk_score ≥ 75

During the LangGraph pipeline the full Ticket document has not been persisted yet,
so this agent calls the notification service with a lightweight proxy Ticket built
from the AgentState.  The ticket_service.run_pipeline_and_update() path will call
notify(ticket) again with the real persisted document after saving to MongoDB.
"""
from datetime import datetime, timedelta
from typing import Optional

from app.agents.base_agent import BaseAgent
from app.models.ticket import Priority, Ticket, TicketStatus, VIPLevel
from app.orchestrator.state import AgentState


def _state_to_ticket(state: AgentState) -> Ticket:
    """
    Build a transient (non-persisted) Ticket from AgentState so the notification
    service can render rich embeds/emails without waiting for DB write.
    """
    priority_str  = (state.get("priority_label") or "MEDIUM").lower()
    vip_level_str = (state.get("vip_level") or "STANDARD").lower()

    # Map string → enums with safe fallbacks
    try:
        priority_enum = Priority(priority_str)
    except ValueError:
        priority_enum = Priority.MEDIUM

    try:
        vip_level_enum = VIPLevel(vip_level_str)
    except ValueError:
        vip_level_enum = VIPLevel.STANDARD

    deadline_hours = state.get("sla_deadline_hours", 24)
    sla_deadline   = datetime.utcnow() + timedelta(hours=int(deadline_hours))

    # vip_confidence from pipeline is 0-100; Ticket stores 0-1
    vip_conf_raw = float(state.get("vip_confidence") or 0)
    vip_conf_normalised = vip_conf_raw / 100.0 if vip_conf_raw > 1 else vip_conf_raw

    return Ticket(
        ticket_id       = state.get("ticket_id", "T-UNKNOWN"),
        employee_id     = state.get("employee_id", ""),
        employee_name   = state.get("employee_name", ""),
        role            = state.get("role", ""),
        department      = state.get("department", ""),
        issue_title     = state.get("issue_title", ""),
        issue_description = state.get("issue_description", ""),
        severity        = state.get("severity", "medium"),
        category        = state.get("category") or None,
        subcategory     = state.get("subcategory") or None,
        priority        = priority_enum,
        priority_score  = float(state.get("priority_score") or 0),
        vip_detected    = bool(state.get("vip_detected", False)),
        vip_level       = vip_level_enum,
        vip_confidence  = vip_conf_normalised,
        urgency_level   = state.get("urgency_level", "low"),
        business_impact = state.get("business_impact", "minimal"),
        assigned_team   = state.get("assigned_team") or None,
        sla_risk_score  = float(state.get("sla_risk_score") or 0),
        sla_deadline    = sla_deadline,
        ai_reasoning    = list(state.get("ai_reasoning") or []),
        status          = TicketStatus.OPEN,
        created_by      = "system",
    )


class NotificationAgent(BaseAgent):

    def __init__(self):
        # No LLM needed
        super().__init__(model_name="", use_llm=False)

    async def run(self, state: AgentState) -> AgentState:
        ticket_id = state.get("ticket_id", "unknown")
        self._log_start(ticket_id)

        priority_label = (state.get("priority_label") or "LOW").upper()
        should_notify  = (
            state.get("vip_detected")
            or priority_label in ("HIGH", "CRITICAL")
            or float(state.get("sla_risk_score") or 0) >= 75
        )

        if not should_notify:
            self._log_complete(ticket_id, skipped=True, reason="below threshold")
            return {"discord_sent": False, "email_sent": False, "errors": []}

        # Build a transient Ticket object for the notification service
        ticket_proxy = _state_to_ticket(state)

        try:
            from app.services.notification_service import notify
            results = await notify(ticket_proxy)
            discord_sent = results.get("discord", False)
            email_sent   = results.get("email", False)
        except Exception as exc:
            self._log_error(ticket_id, str(exc))
            return {
                "discord_sent": False,
                "email_sent":   False,
                **self._error_state(str(exc)),
            }

        self._log_complete(
            ticket_id,
            discord=discord_sent,
            email=email_sent,
        )
        return {
            "discord_sent": discord_sent,
            "email_sent":   email_sent,
            "errors":       [],
        }
