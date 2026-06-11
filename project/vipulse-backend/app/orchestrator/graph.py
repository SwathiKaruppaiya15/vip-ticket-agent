"""
LangGraph StateGraph — VIPulse AI ticket-processing pipeline.

Normal flow:
  START → intake → vip_detection → priority_scoring → routing
        → sla_prediction → explainability → notification → END

Fast-track (CRITICAL + VIP):
  priority_scoring → notification → END  (skips routing / SLA / explainability)
"""
import time
from typing import Literal

import structlog
from langgraph.graph import END, StateGraph

# LangGraph 0.2.x renamed MemorySaver → InMemorySaver; support both
try:
    from langgraph.checkpoint.memory import InMemorySaver as MemorySaver  # 0.2.x
except ImportError:
    from langgraph.checkpoint.memory import MemorySaver  # type: ignore[no-redef]  # 0.1.x

from app.agents.explainability_agent import ExplainabilityAgent
from app.agents.intake_agent import IntakeAgent
from app.agents.notification_agent import NotificationAgent
from app.agents.priority_agent import PriorityAgent
from app.agents.routing_agent import RoutingAgent
from app.agents.sla_agent import SLAAgent
from app.agents.vip_agent import VIPAgent
from app.orchestrator.state import AgentState

logger = structlog.get_logger(__name__)

# ── Agent singletons ──────────────────────────────────────────────────────────
_intake = IntakeAgent()
_vip = VIPAgent()
_priority = PriorityAgent()
_routing = RoutingAgent()
_sla = SLAAgent()
_explain = ExplainabilityAgent()
_notify = NotificationAgent()

# ── Conditional routing logic ─────────────────────────────────────────────────

def _should_fast_track(
    state: AgentState,
) -> Literal["fast_track", "normal"]:
    """
    After priority_scoring: if the ticket is CRITICAL **and** VIP detected,
    skip directly to notification for immediate alerting.
    """
    is_critical = (state.get("priority_label") or "").upper() == "CRITICAL"
    is_vip = state.get("vip_detected", False)
    if is_critical and is_vip:
        logger.info(
            "pipeline_fast_track",
            ticket_id=state.get("ticket_id"),
            reason="CRITICAL + VIP",
        )
        return "fast_track"
    return "normal"


# ── Graph builder ─────────────────────────────────────────────────────────────

def _build_graph() -> StateGraph:
    graph = StateGraph(AgentState)

    # Nodes
    graph.add_node("intake",         _intake.run)
    graph.add_node("vip_detection",  _vip.run)
    graph.add_node("priority_scoring", _priority.run)
    graph.add_node("routing",        _routing.run)
    graph.add_node("sla_prediction", _sla.run)
    graph.add_node("explainability", _explain.run)
    graph.add_node("notification",   _notify.run)

    # Entry
    graph.set_entry_point("intake")

    # Linear edges up to priority_scoring
    graph.add_edge("intake",         "vip_detection")
    graph.add_edge("vip_detection",  "priority_scoring")

    # Conditional edge after priority_scoring
    graph.add_conditional_edges(
        "priority_scoring",
        _should_fast_track,
        {
            "fast_track": "notification",   # CRITICAL + VIP → immediate alert
            "normal":     "routing",        # everything else → full pipeline
        },
    )

    # Normal-path continuation
    graph.add_edge("routing",        "sla_prediction")
    graph.add_edge("sla_prediction", "explainability")
    graph.add_edge("explainability", "notification")

    # Both paths converge at notification → END
    graph.add_edge("notification", END)

    return graph


# ── Compile with in-memory checkpointer ──────────────────────────────────────
_checkpointer = MemorySaver()
ticket_pipeline = _build_graph().compile(checkpointer=_checkpointer)


# ── Public API ────────────────────────────────────────────────────────────────

async def process_ticket(ticket_data: dict) -> AgentState:
    """
    Build an initial AgentState from *ticket_data*, run the full pipeline,
    and return the enriched final state.

    Args:
        ticket_data: dict with at minimum the keys required by AgentState input
                     fields (ticket_id, employee_id, employee_name, role,
                     department, issue_title, issue_description, severity).

    Returns:
        Fully populated AgentState after all agents have run.
    """
    ticket_id: str = ticket_data.get("ticket_id", "unknown")

    initial_state: AgentState = {
        # ── Required inputs ───────────────────────────────────────────────────
        "ticket_id":          ticket_id,
        "employee_id":        ticket_data.get("employee_id", ""),
        "employee_name":      ticket_data.get("employee_name", ""),
        "role":               ticket_data.get("role", ""),
        "department":         ticket_data.get("department", ""),
        "issue_title":        ticket_data.get("issue_title", ""),
        "issue_description":  ticket_data.get("issue_description", ""),
        "severity":           ticket_data.get("severity", "medium"),
        # ── Defaults for accumulator fields ───────────────────────────────────
        "errors":             [],
        # ── Safe defaults so agents never KeyError on missing upstream ────────
        "vip_detected":       False,
        "vip_level":          "STANDARD",
        "vip_confidence":     0.0,
        "vip_score_breakdown": {},
        "priority_score":     0.0,
        "priority_label":     "MEDIUM",
        "priority_factors":   [],
        "urgency_level":      "low",
        "business_impact":    "minimal",
        "detected_keywords":  [],
        "category":           "",
        "subcategory":        "",
        "assigned_team":      "",
        "routing_reason":     "",
        "sla_risk_score":     0.0,
        "sla_risk_level":     "LOW",
        "sla_risk_factors":   [],
        "sla_deadline_hours": 24,
        "ai_reasoning":       [],
        "full_explanation":   "",
        "discord_sent":       False,
        "email_sent":         False,
    }

    config = {"configurable": {"thread_id": ticket_id}}

    t0 = time.perf_counter()
    logger.info("pipeline_start", ticket_id=ticket_id)

    final_state: AgentState = await ticket_pipeline.ainvoke(initial_state, config=config)

    elapsed_ms = round((time.perf_counter() - t0) * 1000, 1)
    logger.info(
        "pipeline_complete",
        ticket_id=ticket_id,
        elapsed_ms=elapsed_ms,
        priority_label=final_state.get("priority_label"),
        vip_detected=final_state.get("vip_detected"),
        errors=len(final_state.get("errors", [])),
    )

    return final_state
