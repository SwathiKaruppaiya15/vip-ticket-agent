"""
Unit tests for Phase 2 AI agents (mocked LLM calls where applicable).
"""
import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.agents.intake_agent import IntakeAgent
from app.agents.priority_agent import PriorityAgent, _score_to_label
from app.agents.sla_agent import SLAAgent, _score_to_level
from app.agents.vip_agent import VIPAgent
from app.orchestrator.state import AgentState

pytestmark = pytest.mark.asyncio

# ── Shared base state ─────────────────────────────────────────────────────────

_BASE: AgentState = {
    "ticket_id":         "T-ABCD1234",
    "employee_id":       "EMP-001",
    "employee_name":     "Alice CEO",
    "role":              "Chief Executive Officer",
    "department":        "Executive",
    "issue_title":       "Cannot access email",
    "issue_description": "Corporate email inaccessible from all devices since this morning. Production blocked.",
    "severity":          "critical",
    # defaults
    "errors":            [],
    "vip_detected":      False,
    "vip_level":         "STANDARD",
    "vip_confidence":    0.0,
    "vip_score_breakdown": {},
    "priority_score":    0.0,
    "priority_label":    "MEDIUM",
    "priority_factors":  [],
    "urgency_level":     "low",
    "business_impact":   "minimal",
    "detected_keywords": [],
    "category":          "",
    "subcategory":       "",
    "assigned_team":     "",
    "routing_reason":    "",
    "sla_risk_score":    0.0,
    "sla_risk_level":    "LOW",
    "sla_risk_factors":  [],
    "sla_deadline_hours": 24,
    "ai_reasoning":      [],
    "full_explanation":  "",
    "discord_sent":      False,
    "email_sent":        False,
}


# ── Intake Agent ──────────────────────────────────────────────────────────────

async def test_intake_classifies_category():
    agent = IntakeAgent()
    mock_content = json.dumps({
        "category": "Access",
        "subcategory": "Email Access",
        "cleaned_summary": "Employee cannot access corporate email.",
        "detected_keywords": ["production", "blocked"],
    })
    with patch.object(agent, "_call_llm", new=AsyncMock(return_value=mock_content)):
        result = await agent.run(dict(_BASE))

    assert result["category"] == "Access"
    assert result["subcategory"] == "Email Access"
    assert "production" in result["detected_keywords"]
    assert result["urgency_level"] == "critical"  # "production" keyword
    assert result["errors"] == []


async def test_intake_fallback_on_json_error():
    agent = IntakeAgent()
    with patch.object(agent, "_call_llm", new=AsyncMock(return_value="not valid json")):
        result = await agent.run(dict(_BASE))

    assert result["category"] == "Other"
    assert len(result["errors"]) > 0


async def test_intake_fallback_on_llm_failure():
    agent = IntakeAgent()
    with patch.object(agent, "_call_llm", new=AsyncMock(side_effect=Exception("timeout"))):
        result = await agent.run(dict(_BASE))

    assert result["category"] == "Other"
    assert any("IntakeAgent" in e for e in result["errors"])


# ── VIP Agent ─────────────────────────────────────────────────────────────────

async def test_vip_agent_ceo_is_platinum():
    agent = VIPAgent()
    with patch("app.agents.vip_agent.Employee") as MockEmp:
        MockEmp.find_one = AsyncMock(return_value=None)
        result = await agent.run(dict(_BASE))

    # CEO in Executive dept: 50 (role) + 25 (dept) = 75 → GOLD threshold
    assert result["vip_detected"] is True
    assert result["vip_level"] in ("GOLD", "PLATINUM")
    assert result["vip_confidence"] >= 60.0
    assert result["errors"] == []


async def test_vip_agent_standard_employee():
    agent = VIPAgent()
    state = {**_BASE, "role": "Intern", "department": "Marketing"}
    with patch("app.agents.vip_agent.Employee") as MockEmp:
        MockEmp.find_one = AsyncMock(return_value=None)
        result = await agent.run(state)

    assert result["vip_detected"] is False
    assert result["vip_level"] == "STANDARD"


async def test_vip_agent_uses_db_override():
    agent = VIPAgent()
    mock_employee = MagicMock()
    mock_employee.vip_score_override = 95.0
    mock_employee.vip_level = MagicMock()
    mock_employee.vip_level.value = "platinum"

    with patch("app.agents.vip_agent.Employee") as MockEmp:
        MockEmp.find_one = AsyncMock(return_value=mock_employee)
        result = await agent.run(dict(_BASE))

    assert result["vip_confidence"] == 95.0
    assert result["vip_level"] == "PLATINUM"
    assert result["vip_score_breakdown"]["source"] == "manual_override"


# ── Priority Agent ────────────────────────────────────────────────────────────

async def test_priority_agent_critical_vip():
    agent = PriorityAgent()
    state = {
        **_BASE,
        "vip_detected": True,
        "vip_level": "PLATINUM",
        "vip_confidence": 90.0,
        "category": "Network",
        "subcategory": "VPN Failure",
        "detected_keywords": ["production", "down", "critical"],
    }
    mock_content = json.dumps({
        "priority_score": 92.0,
        "priority_label": "CRITICAL",
        "priority_factors": [
            "VIP PLATINUM employee contribution: 31.5 pts",
            "Critical severity: 30 pts",
            "3 urgency keywords: 15 pts",
        ],
    })
    with patch.object(agent, "_call_llm", new=AsyncMock(return_value=mock_content)):
        result = await agent.run(state)

    assert result["priority_score"] >= 81.0
    assert result["priority_label"] == "CRITICAL"
    assert len(result["priority_factors"]) > 0
    assert result["errors"] == []


async def test_priority_agent_fallback_on_llm_error():
    agent = PriorityAgent()
    state = {**_BASE, "vip_confidence": 0.0, "category": "Other", "detected_keywords": []}
    with patch.object(agent, "_call_llm", new=AsyncMock(side_effect=Exception("LLM down"))):
        result = await agent.run(state)

    assert result["priority_label"] == "MEDIUM"
    assert result["priority_score"] == 50.0
    assert len(result["errors"]) > 0


@pytest.mark.parametrize("score,expected", [
    (0, "LOW"), (30, "LOW"), (31, "MEDIUM"), (60, "MEDIUM"),
    (61, "HIGH"), (80, "HIGH"), (81, "CRITICAL"), (100, "CRITICAL"),
])
def test_score_to_label(score, expected):
    assert _score_to_label(score) == expected


# ── SLA Agent ─────────────────────────────────────────────────────────────────

async def test_sla_agent_critical_vip_short_deadline():
    agent = SLAAgent()
    state = {
        **_BASE,
        "priority_label": "CRITICAL",
        "vip_detected": True,
        "vip_level": "PLATINUM",
        "urgency_level": "critical",
        "business_impact": "severe",
        "detected_keywords": ["production", "down"],
        "assigned_team": "VIP — Infrastructure Support Team",
    }
    mock_content = json.dumps({
        "sla_risk_score": 88.0,
        "risk_level": "CRITICAL",
        "sla_risk_factors": ["CRITICAL priority VIP ticket", "Production keyword detected"],
        "sla_deadline_hours": 1,
    })
    with patch.object(agent, "_call_llm", new=AsyncMock(return_value=mock_content)):
        result = await agent.run(state)

    # CRITICAL × VIP multiplier = 2h × 0.5 = 1h
    assert result["sla_deadline_hours"] <= 2
    assert result["sla_risk_score"] >= 75.0
    assert result["sla_risk_level"] == "CRITICAL"
    assert result["errors"] == []


async def test_sla_agent_low_priority_standard():
    agent = SLAAgent()
    state = {
        **_BASE,
        "priority_label": "LOW",
        "vip_detected": False,
        "vip_level": "STANDARD",
        "urgency_level": "low",
        "business_impact": "minimal",
        "detected_keywords": [],
        "assigned_team": "Level 1 Support",
    }
    mock_content = json.dumps({
        "sla_risk_score": 12.0,
        "risk_level": "LOW",
        "sla_risk_factors": ["Standard employee", "Low priority"],
        "sla_deadline_hours": 24,
    })
    with patch.object(agent, "_call_llm", new=AsyncMock(return_value=mock_content)):
        result = await agent.run(state)

    assert result["sla_risk_score"] < 26.0
    assert result["sla_risk_level"] == "LOW"
    assert result["sla_deadline_hours"] == 24


async def test_sla_agent_fallback_on_error():
    agent = SLAAgent()
    state = {**_BASE, "priority_label": "HIGH", "vip_detected": False, "vip_level": "STANDARD"}
    with patch.object(agent, "_call_llm", new=AsyncMock(side_effect=Exception("timeout"))):
        result = await agent.run(state)

    assert result["sla_risk_score"] >= 50.0  # HIGH fallback
    assert len(result["errors"]) > 0


@pytest.mark.parametrize("score,expected", [
    (0, "LOW"), (25, "LOW"), (26, "MEDIUM"), (50, "MEDIUM"),
    (51, "HIGH"), (75, "HIGH"), (76, "CRITICAL"), (100, "CRITICAL"),
])
def test_score_to_level(score, expected):
    assert _score_to_level(score) == expected


# ── Base Agent retry logic ────────────────────────────────────────────────────

async def test_base_agent_retries_on_failure():
    """_call_llm should retry up to 3 times before raising."""
    from app.agents.intake_agent import IntakeAgent
    agent = IntakeAgent()

    call_count = 0

    async def flaky_llm(*args, **kwargs):
        nonlocal call_count
        call_count += 1
        raise Exception("transient error")

    with patch.object(agent.llm, "ainvoke", new=flaky_llm):
        with pytest.raises(Exception, match="transient error"):
            await agent._call_llm([])

    assert call_count == 3  # initial + 2 retries
