"""
SLA Agent — predicts SLA breach risk and sets deadline.

Model : llama-3.3-70b-versatile

Base deadlines (hours): CRITICAL=2 | HIGH=4 | MEDIUM=8 | LOW=24
VIP multiplier        : 0.5  (VIP tickets get half the deadline window)
"""
import json

from langchain_core.messages import HumanMessage, SystemMessage

from app.agents.base_agent import BaseAgent
from app.orchestrator.state import AgentState

SLA_DEADLINES: dict[str, int] = {
    "CRITICAL": 2,
    "HIGH": 4,
    "MEDIUM": 8,
    "LOW": 24,
}

VIP_MULTIPLIER: float = 0.5

_SYSTEM = """\
You are an SLA risk prediction engine for an IT helpdesk.
Predict whether this ticket will breach its SLA and quantify the risk.

Respond ONLY with valid JSON — no markdown, no extra text:
{{
  "sla_risk_score": <float 0-100>,
  "risk_level": "<LOW|MEDIUM|HIGH|CRITICAL>",
  "sla_risk_factors": ["<factor 1>", "<factor 2>", ...],
  "sla_deadline_hours": <int>
}}

Risk level from sla_risk_score:
  0-25  → LOW
  26-50 → MEDIUM
  51-75 → HIGH
  76-100→ CRITICAL"""


class SLAAgent(BaseAgent):

    def __init__(self):
        super().__init__(model_name="llama-3.3-70b-versatile", temperature=0.1)

    async def run(self, state: AgentState) -> AgentState:
        ticket_id = state.get("ticket_id", "unknown")
        self._log_start(ticket_id)

        priority_label = (state.get("priority_label") or "MEDIUM").upper()
        vip_detected = state.get("vip_detected", False)

        # Compute baseline deadline
        base_hours = SLA_DEADLINES.get(priority_label, 8)
        effective_hours = int(base_hours * VIP_MULTIPLIER) if vip_detected else base_hours

        user_msg = (
            f"priority_label: {priority_label}\n"
            f"vip_detected: {vip_detected}\n"
            f"vip_level: {state.get('vip_level', 'STANDARD')}\n"
            f"assigned_team: {state.get('assigned_team', 'Unknown')}\n"
            f"urgency_level: {state.get('urgency_level', 'low')}\n"
            f"business_impact: {state.get('business_impact', 'minimal')}\n"
            f"detected_keywords: {state.get('detected_keywords', [])}\n"
            f"ticket_age_minutes: 0 (new ticket)\n"
            f"baseline_deadline_hours: {effective_hours} "
            f"({'VIP multiplier applied' if vip_detected else 'standard deadline'})"
        )

        try:
            raw = await self._call_llm(
                [SystemMessage(content=_SYSTEM), HumanMessage(content=user_msg)]
            )
            result = json.loads(raw)
            sla_risk_score = float(result.get("sla_risk_score", 50.0))
            risk_level = result.get("risk_level", "MEDIUM").upper()
            sla_risk_factors: list[str] = result.get("sla_risk_factors", [])
            # Honour LLM deadline unless it's out of reasonable range
            llm_hours = int(result.get("sla_deadline_hours", effective_hours))
            sla_deadline_hours = llm_hours if 1 <= llm_hours <= 168 else effective_hours
        except json.JSONDecodeError as exc:
            self._log_error(ticket_id, f"JSON parse error: {exc}")
            return self._fallback(state, effective_hours, str(exc))
        except Exception as exc:
            self._log_error(ticket_id, str(exc))
            return self._fallback(state, effective_hours, str(exc))

        # Clamp and re-derive risk_level from score for consistency
        sla_risk_score = max(0.0, min(100.0, sla_risk_score))
        risk_level = _score_to_level(sla_risk_score)

        self._log_complete(
            ticket_id,
            sla_risk_score=sla_risk_score,
            risk_level=risk_level,
            deadline_hours=sla_deadline_hours,
        )

        return {
            "sla_risk_score": sla_risk_score,
            "sla_risk_level": risk_level,
            "sla_risk_factors": sla_risk_factors,
            "sla_deadline_hours": sla_deadline_hours,
            "errors": [],
        }

    def _fallback(self, state: AgentState, effective_hours: int, error: str) -> dict:
        priority_label = (state.get("priority_label") or "MEDIUM").upper()
        vip_detected = state.get("vip_detected", False)
        risk = 70.0 if priority_label == "CRITICAL" else \
               55.0 if priority_label == "HIGH" else \
               35.0 if priority_label == "MEDIUM" else 15.0
        if vip_detected:
            risk = min(100.0, risk + 15.0)
        return {
            "sla_risk_score": risk,
            "sla_risk_level": _score_to_level(risk),
            "sla_risk_factors": ["Fallback SLA scoring applied due to LLM error."],
            "sla_deadline_hours": effective_hours,
            **self._error_state(error),
        }


def _score_to_level(score: float) -> str:
    if score >= 76:
        return "CRITICAL"
    if score >= 51:
        return "HIGH"
    if score >= 26:
        return "MEDIUM"
    return "LOW"
