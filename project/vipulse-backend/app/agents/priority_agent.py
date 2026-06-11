"""
Priority Agent — computes a 0-100 priority score with weighted factors.

Model : llama-3.3-70b-versatile
Score map: 0-30=LOW | 31-60=MEDIUM | 61-80=HIGH | 81-100=CRITICAL
"""
import json
from datetime import datetime, timezone

from langchain_core.messages import HumanMessage, SystemMessage

from app.agents.base_agent import BaseAgent
from app.orchestrator.state import AgentState

_SEVERITY_SCORES: dict[str, int] = {
    "critical": 30,
    "high": 20,
    "medium": 10,
    "low": 5,
}

_CATEGORY_SCORES: dict[str, int] = {
    "network": 15,
    "security": 15,
    "access": 10,
    "software": 8,
    "hardware": 7,
    "payroll": 12,
    "other": 5,
}

_SYSTEM = """\
You are a priority scoring engine for an enterprise IT helpdesk.
Given the pre-computed factor scores below, calculate the FINAL priority.

Respond ONLY with valid JSON — no markdown, no extra text:
{{
  "priority_score": <float 0-100>,
  "priority_label": "<LOW|MEDIUM|HIGH|CRITICAL>",
  "priority_factors": ["<factor 1>", "<factor 2>", ...]
}}

Rules for priority_label from priority_score:
  0-30  → LOW
  31-60 → MEDIUM
  61-80 → HIGH
  81-100→ CRITICAL"""


def _business_hours_factor() -> tuple[int, str]:
    """Return +10 if current UTC time falls in IST business hours (9am-6pm), else +5."""
    # IST = UTC+5:30
    now_utc = datetime.now(timezone.utc)
    ist_hour = (now_utc.hour + 5) % 24 + (1 if now_utc.minute >= 30 else 0)
    if 9 <= ist_hour < 18:
        return 10, "Ticket submitted during IST business hours (+10)"
    return 5, "Ticket submitted outside IST business hours (+5)"


class PriorityAgent(BaseAgent):

    def __init__(self):
        super().__init__(model_name="llama-3.3-70b-versatile", temperature=0.1)

    async def run(self, state: AgentState) -> AgentState:
        ticket_id = state.get("ticket_id", "unknown")
        self._log_start(ticket_id)

        vip_confidence = float(state.get("vip_confidence", 0.0))
        severity = state.get("severity", "medium").lower()
        keywords = state.get("detected_keywords", [])
        category = state.get("category", "Other").lower()

        # Pre-compute deterministic components to give the LLM precise numbers
        vip_contrib = round(vip_confidence * 0.35, 2)          # max 35 pts
        severity_score = _SEVERITY_SCORES.get(severity, 10)
        keyword_score = min(20, len(keywords) * 5)
        biz_hours_score, biz_hours_reason = _business_hours_factor()
        category_score = _CATEGORY_SCORES.get(category, 5)

        factor_context = (
            f"- VIP contribution: {vip_contrib} pts "
            f"(vip_confidence={vip_confidence:.1f} × 0.35)\n"
            f"- Severity score: {severity_score} pts (severity='{severity}')\n"
            f"- Urgency keyword score: {keyword_score} pts "
            f"({len(keywords)} keywords × 5, max 20)\n"
            f"- Business hours factor: {biz_hours_score} pts — {biz_hours_reason}\n"
            f"- Category criticality: {category_score} pts (category='{category}')\n"
            f"- Raw sub-total (for reference): "
            f"{vip_contrib + severity_score + keyword_score + biz_hours_score + category_score:.2f}\n\n"
            f"Detected keywords: {keywords}\n"
            f"Issue title: {state.get('issue_title')}\n"
            f"Department: {state.get('department')} | Role: {state.get('role')}\n"
            f"VIP detected: {state.get('vip_detected')} ({state.get('vip_level')})"
        )

        try:
            raw = await self._call_llm(
                [
                    SystemMessage(content=_SYSTEM),
                    HumanMessage(content=factor_context),
                ]
            )
            result = json.loads(raw)
            priority_score = float(result.get("priority_score", 50.0))
            priority_label = result.get("priority_label", "MEDIUM").upper()
            priority_factors: list[str] = result.get("priority_factors", [])
        except json.JSONDecodeError as exc:
            self._log_error(ticket_id, f"JSON parse error: {exc}")
            priority_score = self._fallback_score(vip_contrib, severity_score, keyword_score, biz_hours_score, category_score)
            priority_label = _score_to_label(priority_score)
            priority_factors = [f"Fallback scoring used due to parse error: {exc}"]
            return {
                "priority_score": priority_score,
                "priority_label": priority_label,
                "priority_factors": priority_factors,
                **self._error_state(f"JSON parse error: {exc}"),
            }
        except Exception as exc:
            self._log_error(ticket_id, str(exc))
            priority_score = 50.0
            priority_label = "MEDIUM"
            priority_factors = [f"LLM unavailable — default medium priority assigned."]
            return {
                "priority_score": priority_score,
                "priority_label": priority_label,
                "priority_factors": priority_factors,
                **self._error_state(str(exc)),
            }

        # Validate and clamp
        priority_score = max(0.0, min(100.0, priority_score))
        # Re-derive label from score to prevent LLM label/score mismatch
        priority_label = _score_to_label(priority_score)

        self._log_complete(
            ticket_id,
            priority_score=priority_score,
            priority_label=priority_label,
        )

        return {
            "priority_score": priority_score,
            "priority_label": priority_label,
            "priority_factors": priority_factors,
            "errors": [],
        }

    @staticmethod
    def _fallback_score(*components: float) -> float:
        return max(0.0, min(100.0, sum(components)))


def _score_to_label(score: float) -> str:
    if score >= 81:
        return "CRITICAL"
    if score >= 61:
        return "HIGH"
    if score >= 31:
        return "MEDIUM"
    return "LOW"
