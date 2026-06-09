"""
Intake Agent — parses and normalises the ticket, classifies category/subcategory.

Model : llama-3.1-8b-instant  (fast, cheap — pure classification task)
Output: category, subcategory, detected_keywords
"""
import json

from langchain_core.messages import HumanMessage, SystemMessage

from app.agents.base_agent import BaseAgent
from app.orchestrator.state import AgentState

_SYSTEM = """\
You are a ticket intake classifier for an enterprise IT helpdesk.
Given a support ticket, extract exactly:
1. category   — one of: Network | Hardware | Software | Access | Security | Payroll | Other
2. subcategory — specific type within the category (e.g. VPN Failure, Laptop Screen, Password Reset)
3. cleaned_summary — 1-sentence plain-English summary of the problem
4. detected_keywords — list of any urgency words found in the description from this set:
   [urgent, critical, down, failed, blocked, production, stopped, breach, outage, emergency, escalate]

Respond ONLY with valid JSON — no markdown, no extra text:
{
  "category": "<string>",
  "subcategory": "<string>",
  "cleaned_summary": "<string>",
  "detected_keywords": ["<string>", ...]
}"""

_FALLBACK = {
    "category": "Other",
    "subcategory": "Unknown",
    "cleaned_summary": "Unable to classify ticket.",
    "detected_keywords": [],
}


class IntakeAgent(BaseAgent):

    def __init__(self):
        super().__init__(model_name="llama-3.1-8b-instant", temperature=0.1)

    async def run(self, state: AgentState) -> AgentState:
        ticket_id = state.get("ticket_id", "unknown")
        self._log_start(ticket_id)

        user_msg = (
            f"Title: {state['issue_title']}\n"
            f"Description: {state['issue_description']}"
        )

        try:
            raw = await self._call_llm(
                [SystemMessage(content=_SYSTEM), HumanMessage(content=user_msg)]
            )
            result = json.loads(raw)
        except json.JSONDecodeError as exc:
            self._log_error(ticket_id, f"JSON parse error: {exc}")
            result = _FALLBACK
            return {
                **result,
                "urgency_level": "low",
                "business_impact": "minimal",
                **self._error_state(f"JSON parse error: {exc}"),
            }
        except Exception as exc:
            self._log_error(ticket_id, str(exc))
            result = _FALLBACK
            return {
                **result,
                "urgency_level": "low",
                "business_impact": "minimal",
                **self._error_state(str(exc)),
            }

        keywords: list = result.get("detected_keywords", [])
        # Derive simple urgency/impact from keywords
        urgency = "critical" if any(k in keywords for k in ("critical", "production", "breach", "outage", "emergency")) \
               else "high" if any(k in keywords for k in ("urgent", "down", "failed", "stopped")) \
               else "medium" if any(k in keywords for k in ("blocked", "escalate")) \
               else "low"
        impact = "severe" if urgency == "critical" else \
                 "significant" if urgency == "high" else \
                 "moderate" if urgency == "medium" else "minimal"

        self._log_complete(
            ticket_id,
            category=result.get("category"),
            keywords=keywords,
        )

        return {
            "category": result.get("category", "Other"),
            "subcategory": result.get("subcategory", "Unknown"),
            "detected_keywords": keywords,
            "urgency_level": urgency,
            "business_impact": impact,
            "errors": [],
        }
