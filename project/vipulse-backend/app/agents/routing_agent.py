"""
Routing Agent — assigns the ticket to the correct support team.

Model : llama-3.3-70b-versatile
"""
import json

from langchain_core.messages import HumanMessage, SystemMessage

from app.agents.base_agent import BaseAgent
from app.orchestrator.state import AgentState

ROUTING_RULES: dict[str, str] = {
    "Network": "Infrastructure Support Team",
    "VPN": "Infrastructure Support Team",
    "Access": "Identity & Access Management (IAM) Team",
    "Security": "Security Operations Center (SOC)",
    "Payroll": "Finance IT Team",
    "Hardware": "Desktop Support Team",
    "Software": "Application Support Team",
    "Email": "Collaboration Tools Team",
    "HR": "HR Systems Team",
    "Other": "Level 1 Support",
}

_SYSTEM = """\
You are a ticket routing specialist for an enterprise IT helpdesk.
You must assign every ticket to exactly one support team.

Routing rules reference (category → default team):
{rules}

Additional overrides:
- VIP PLATINUM/GOLD employees should ALWAYS be routed to a dedicated VIP concierge sub-queue
  within the matched team (prefix with "VIP — ").
- Security tickets always go to the SOC regardless of other factors.
- Payroll issues for Finance dept employees have highest priority with Finance IT Team.

Respond ONLY with valid JSON — no markdown, no extra text:
{{
  "assigned_team": "<team name string>",
  "routing_reason": "<one sentence explaining the routing decision>"
}}"""


class RoutingAgent(BaseAgent):

    def __init__(self):
        super().__init__(model_name="llama-3.3-70b-versatile", temperature=0.1)

    async def run(self, state: AgentState) -> AgentState:
        ticket_id = state.get("ticket_id", "unknown")
        self._log_start(ticket_id)

        rules_text = "\n".join(f"  {k} → {v}" for k, v in ROUTING_RULES.items())
        system_prompt = _SYSTEM.format(rules=rules_text)

        user_msg = (
            f"category: {state.get('category')}\n"
            f"subcategory: {state.get('subcategory')}\n"
            f"role: {state.get('role')}\n"
            f"department: {state.get('department')}\n"
            f"vip_detected: {state.get('vip_detected')}\n"
            f"vip_level: {state.get('vip_level')}\n"
            f"priority_label: {state.get('priority_label')}\n"
            f"issue_title: {state.get('issue_title')}"
        )

        try:
            raw = await self._call_llm(
                [SystemMessage(content=system_prompt), HumanMessage(content=user_msg)]
            )
            result = json.loads(raw)
            assigned_team = result.get("assigned_team", "Level 1 Support")
            routing_reason = result.get("routing_reason", "Default routing applied.")
        except json.JSONDecodeError as exc:
            self._log_error(ticket_id, f"JSON parse error: {exc}")
            assigned_team = self._fallback_team(state)
            routing_reason = "Fallback rule-based routing applied."
            return {
                "assigned_team": assigned_team,
                "routing_reason": routing_reason,
                **self._error_state(f"JSON parse error: {exc}"),
            }
        except Exception as exc:
            self._log_error(ticket_id, str(exc))
            assigned_team = self._fallback_team(state)
            routing_reason = "LLM unavailable — deterministic fallback routing used."
            return {
                "assigned_team": assigned_team,
                "routing_reason": routing_reason,
                **self._error_state(str(exc)),
            }

        self._log_complete(ticket_id, assigned_team=assigned_team)

        return {
            "assigned_team": assigned_team,
            "routing_reason": routing_reason,
            "errors": [],
        }

    @staticmethod
    def _fallback_team(state: AgentState) -> str:
        """Pure-Python deterministic fallback — no LLM needed."""
        category = state.get("category", "Other")
        team = ROUTING_RULES.get(category, "Level 1 Support")
        vip_level = state.get("vip_level", "STANDARD")
        if vip_level in ("PLATINUM", "GOLD"):
            team = f"VIP — {team}"
        return team
