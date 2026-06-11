"""
Integration tests for the LangGraph orchestrator.

All LLM calls are mocked so the graph wiring and state propagation
are tested without hitting the Groq API.
"""
import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.orchestrator.state import AgentState

pytestmark = pytest.mark.asyncio

# ── Shared LLM mock payloads ──────────────────────────────────────────────────

_INTAKE_RESP = json.dumps({
    "category": "Network", "subcategory": "VPN",
    "cleaned_summary": "VPN down blocking board access.",
    "detected_keywords": ["production", "down", "critical"],
})
_PRIORITY_RESP = json.dumps({
    "priority_score": 92.0, "priority_label": "CRITICAL",
    "priority_factors": ["VIP CEO", "Network/VPN", "3 urgency keywords"],
})
_ROUTING_RESP = json.dumps({
    "assigned_team": "VIP — Infrastructure Support Team",
    "routing_reason": "CEO VIP + Network category.",
})
_SLA_RESP = json.dumps({
    "sla_risk_score": 88.0, "risk_level": "CRITICAL",
    "sla_risk_factors": ["CRITICAL priority VIP ticket"],
    "sla_deadline_hours": 1,
})
_EXPLAIN_RESP = json.dumps({
    "ai_reasoning": [
        "Detected CEO role — PLATINUM VIP (95% confidence).",
        "Identified Network/VPN category with critical keywords.",
        "Calculated priority score 92/100 — CRITICAL.",
        "Assigned to VIP Infrastructure Support Team.",
        "Predicted SLA breach risk at 88%.",
    ],
    "full_explanation": "Critical VIP ticket routed immediately.",
})


def _mock_llm(content: str):
    m = MagicMock()
    m.content = content
    return m


async def _patched_process_ticket(ticket_data: dict) -> AgentState:
    """Run process_ticket with all LLM calls mocked."""
    from app.agents.intake_agent       import IntakeAgent
    from app.agents.priority_agent     import PriorityAgent
    from app.agents.routing_agent      import RoutingAgent
    from app.agents.sla_agent          import SLAAgent
    from app.agents.explainability_agent import ExplainabilityAgent
    from app.agents.vip_agent          import VIPAgent
    from app.orchestrator.graph        import process_ticket

    with (
        patch.object(IntakeAgent,          '_call_llm', new=AsyncMock(return_value=_INTAKE_RESP)),
        patch.object(PriorityAgent,        '_call_llm', new=AsyncMock(return_value=_PRIORITY_RESP)),
        patch.object(RoutingAgent,         '_call_llm', new=AsyncMock(return_value=_ROUTING_RESP)),
        patch.object(SLAAgent,             '_call_llm', new=AsyncMock(return_value=_SLA_RESP)),
        patch.object(ExplainabilityAgent,  '_call_llm', new=AsyncMock(return_value=_EXPLAIN_RESP)),
        patch('app.agents.vip_agent.Employee') as MockEmp,
        patch('app.agents.notification_agent.notify', new=AsyncMock(return_value={"discord": True, "email": True})),
    ):
        MockEmp.find_one = AsyncMock(return_value=None)
        return await process_ticket(ticket_data)


# ── Tests ─────────────────────────────────────────────────────────────────────

async def test_full_pipeline_populates_all_state_fields():
    """End-to-end: all expected state fields must be present and non-empty."""
    result = await _patched_process_ticket({
        "ticket_id":         "T-INTTEST1",
        "employee_id":       "EMP-CEO",
        "employee_name":     "Alice CEO",
        "role":              "Chief Executive Officer",
        "department":        "Executive",
        "issue_title":       "VPN down — board call in 30 min",
        "issue_description": "Corporate VPN completely down since 9am. Board call is imminent.",
        "severity":          "critical",
    })

    # Intake outputs
    assert result["category"]   == "Network"
    assert result["subcategory"] == "VPN"
    assert "production" in result["detected_keywords"]
    assert result["urgency_level"] != ""

    # VIP outputs (CEO in Executive dept → high confidence)
    assert result["vip_detected"] is True
    assert result["vip_level"] in ("GOLD", "PLATINUM")

    # Priority outputs
    assert result["priority_score"] >= 80
    assert result["priority_label"] == "CRITICAL"
    assert len(result["priority_factors"]) > 0

    # Routing outputs
    assert result["assigned_team"] != ""
    assert result["routing_reason"] != ""

    # SLA outputs
    assert result["sla_risk_score"] > 0
    assert result["sla_deadline_hours"] > 0
    assert len(result["sla_risk_factors"]) > 0

    # Explainability
    assert 4 <= len(result["ai_reasoning"]) <= 6

    # No errors should propagate from mocked pipeline
    assert result["errors"] == []


async def test_fast_track_skips_routing_sla_explainability():
    """
    CRITICAL + VIP ticket should take the fast-track edge:
    routing/sla/explainability agents are skipped.
    """
    from app.agents.intake_agent       import IntakeAgent
    from app.agents.priority_agent     import PriorityAgent
    from app.agents.vip_agent          import VIPAgent
    from app.orchestrator.graph        import process_ticket

    routing_called = False
    sla_called     = False

    async def fake_routing(state):
        nonlocal routing_called
        routing_called = True
        return {"assigned_team": "VIP Team", "routing_reason": "test", "errors": []}

    async def fake_sla(state):
        nonlocal sla_called
        sla_called = True
        return {"sla_risk_score": 80.0, "sla_risk_level": "CRITICAL", "sla_risk_factors": [], "sla_deadline_hours": 1, "errors": []}

    # VIP agent mock returning PLATINUM
    mock_employee = MagicMock()
    mock_employee.vip_score_override = 95.0
    mock_employee.vip_level = MagicMock()
    mock_employee.vip_level.value = "platinum"

    with (
        patch.object(IntakeAgent,  '_call_llm', new=AsyncMock(return_value=_INTAKE_RESP)),
        patch.object(PriorityAgent,'_call_llm', new=AsyncMock(return_value=_PRIORITY_RESP)),
        patch('app.agents.vip_agent.Employee') as MockEmp,
        patch('app.agents.routing_agent.RoutingAgent.run', side_effect=fake_routing),
        patch('app.agents.sla_agent.SLAAgent.run',         side_effect=fake_sla),
        patch('app.agents.notification_agent.notify', new=AsyncMock(return_value={"discord": True, "email": False})),
    ):
        MockEmp.find_one = AsyncMock(return_value=mock_employee)
        result = await process_ticket({
            "ticket_id": "T-FASTTRACK",
            "employee_id": "EMP-CEO",
            "employee_name": "Bob CTO",
            "role": "Chief Technology Officer",
            "department": "Executive",
            "issue_title": "Production database down",
            "issue_description": "Main production DB is completely down. All services affected.",
            "severity": "critical",
        })

    # Fast-track skips routing and SLA
    assert routing_called is False, "Routing should be skipped on fast-track"
    assert sla_called     is False, "SLA should be skipped on fast-track"

    # But notification was still fired
    assert result["discord_sent"] is True


async def test_error_recovery_one_agent_fails_rest_continue():
    """
    If one agent fails (raises), the error is recorded in state.errors
    but remaining agents continue to run.
    """
    from app.agents.intake_agent       import IntakeAgent
    from app.agents.priority_agent     import PriorityAgent
    from app.agents.routing_agent      import RoutingAgent
    from app.agents.sla_agent          import SLAAgent
    from app.agents.explainability_agent import ExplainabilityAgent
    from app.orchestrator.graph        import process_ticket

    with (
        # Intake raises
        patch.object(IntakeAgent, '_call_llm', new=AsyncMock(side_effect=Exception("LLM timeout"))),
        # Rest succeed
        patch.object(PriorityAgent,       '_call_llm', new=AsyncMock(return_value=_PRIORITY_RESP)),
        patch.object(RoutingAgent,        '_call_llm', new=AsyncMock(return_value=_ROUTING_RESP)),
        patch.object(SLAAgent,            '_call_llm', new=AsyncMock(return_value=_SLA_RESP)),
        patch.object(ExplainabilityAgent, '_call_llm', new=AsyncMock(return_value=_EXPLAIN_RESP)),
        patch('app.agents.vip_agent.Employee') as MockEmp,
        patch('app.agents.notification_agent.notify', new=AsyncMock(return_value={"discord": False, "email": False})),
    ):
        MockEmp.find_one = AsyncMock(return_value=None)
        result = await process_ticket({
            "ticket_id":         "T-ERRTEST1",
            "employee_id":       "EMP-002",
            "employee_name":     "Bob Engineer",
            "role":              "Engineer",
            "department":        "Engineering",
            "issue_title":       "Cannot log in",
            "issue_description": "I cannot log into my laptop since this morning.",
            "severity":          "medium",
        })

    # Errors recorded
    assert any("IntakeAgent" in e for e in result["errors"])

    # Fallback values set by intake
    assert result["category"] == "Other"

    # Pipeline continued — priority agent ran
    assert result["priority_label"] == "CRITICAL"   # from mock
    assert result["assigned_team"]  != ""


async def test_pipeline_timing_logged(capsys):
    """process_ticket should complete without raising and return a state dict."""
    result = await _patched_process_ticket({
        "ticket_id":         "T-TIMETEST",
        "employee_id":       "EMP-003",
        "employee_name":     "Carol PM",
        "role":              "Product Manager",
        "department":        "Product",
        "issue_title":       "Slack is down",
        "issue_description": "Slack has been unavailable for our entire team for 2 hours.",
        "severity":          "high",
    })
    assert isinstance(result, dict)
    assert "ticket_id" in result
