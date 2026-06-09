"""
Explainability Agent — generates human-readable AI decision bullet points.

Model  : llama-3.3-70b-versatile
Output : 4-6 bullet points + a 2-3 sentence paragraph
"""
import json

from langchain_core.messages import HumanMessage, SystemMessage

from app.agents.base_agent import BaseAgent
from app.orchestrator.state import AgentState

_SYSTEM = """\
You are an AI explainability engine for an enterprise IT support system.
Your job is to explain, in plain English, exactly WHY the AI made the decisions
it did about a support ticket.

Rules:
- Generate EXACTLY 4-6 bullet points.
- Each bullet MUST start with one of these action words:
  Detected / Identified / Calculated / Assigned / Predicted / Flagged
- Each bullet must be ≤ 20 words.
- Write a 2-3 sentence paragraph summarising the overall decision.
- Be factual, jargon-free, and specific (include numbers where relevant).

Respond ONLY with valid JSON — no markdown, no extra text:
{{
  "ai_reasoning": ["<bullet 1>", "<bullet 2>", ...],
  "full_explanation": "<paragraph>"
}}"""


class ExplainabilityAgent(BaseAgent):

    def __init__(self):
        super().__init__(model_name="llama-3.3-70b-versatile", temperature=0.2)

    async def run(self, state: AgentState) -> AgentState:
        ticket_id = state.get("ticket_id", "unknown")
        self._log_start(ticket_id)

        user_msg = (
            f"employee: {state.get('employee_name')}, "
            f"role: {state.get('role')}, "
            f"dept: {state.get('department')}\n"
            f"vip_detected: {state.get('vip_detected')}, "
            f"vip_level: {state.get('vip_level')}, "
            f"confidence: {state.get('vip_confidence', 0):.1f}%\n"
            f"category: {state.get('category')}/{state.get('subcategory')}\n"
            f"urgency_keywords found: {state.get('detected_keywords', [])}\n"
            f"priority_score: {state.get('priority_score', 0):.1f} "
            f"→ {state.get('priority_label')}\n"
            f"priority_factors: {state.get('priority_factors', [])}\n"
            f"assigned_team: {state.get('assigned_team')}\n"
            f"routing_reason: {state.get('routing_reason')}\n"
            f"sla_risk: {state.get('sla_risk_score', 0):.1f}% "
            f"({state.get('sla_risk_level')}) — "
            f"deadline: {state.get('sla_deadline_hours')} hours\n"
            f"sla_risk_factors: {state.get('sla_risk_factors', [])}"
        )

        try:
            raw = await self._call_llm(
                [SystemMessage(content=_SYSTEM), HumanMessage(content=user_msg)]
            )
            result = json.loads(raw)
            llm_reasoning: list[str] = result.get("ai_reasoning", [])
            full_explanation: str = result.get("full_explanation", "")
        except json.JSONDecodeError as exc:
            self._log_error(ticket_id, f"JSON parse error: {exc}")
            return {
                **self._fallback(state),
                **self._error_state(f"JSON parse error: {exc}"),
            }
        except Exception as exc:
            self._log_error(ticket_id, str(exc))
            return {
                **self._fallback(state),
                **self._error_state(str(exc)),
            }

        # Merge: keep VIP agent's seed bullets, then add LLM bullets
        existing: list[str] = list(state.get("ai_reasoning") or [])
        merged = existing + [b for b in llm_reasoning if b not in existing]

        # Enforce minimum bullet count
        if len(merged) < 4:
            merged.extend(self._fallback(state)["ai_reasoning"][len(merged):4])

        self._log_complete(ticket_id, bullets=len(merged))

        return {
            "ai_reasoning":    merged,
            "full_explanation": full_explanation,
            "errors": [],
        }

    @staticmethod
    def _fallback(state: AgentState) -> dict:
        # Start with any VIP bullets already seeded
        existing: list[str] = list(state.get("ai_reasoning") or [])
        new_bullets = [
            f"Identified category as {state.get('category', 'Unknown')}/"
            f"{state.get('subcategory', 'Unknown')} via ticket analysis.",
            f"Calculated priority score {state.get('priority_score', 0):.1f}/100 "
            f"→ {state.get('priority_label', 'MEDIUM')}.",
            f"Assigned ticket to {state.get('assigned_team', 'Level 1 Support')}.",
            f"Predicted SLA risk at {state.get('sla_risk_score', 0):.1f}% "
            f"with {state.get('sla_deadline_hours', 8)}-hour deadline.",
        ]
        merged = existing + [b for b in new_bullets if b not in existing]
        paragraph = (
            f"The AI classified this ticket as {state.get('priority_label', 'MEDIUM')} priority "
            f"based on the employee role, department, and issue keywords. "
            f"It was routed to {state.get('assigned_team', 'Level 1 Support')} with an SLA "
            f"window of {state.get('sla_deadline_hours', 8)} hours."
        )
        return {"ai_reasoning": merged, "full_explanation": paragraph}
