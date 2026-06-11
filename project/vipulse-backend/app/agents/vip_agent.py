"""
VIP Agent — pure rule-based + MongoDB lookup.  No LLM used.

Detection priority:
  1. MongoDB Employee record with employee_id (highest priority)
     - If vip_score_override is set → use it directly as confidence (0-100)
     - Else → use the stored vip_level to set a baseline + computed adjustments
  2. Role-keyword scoring (fallback when employee not in DB)
  3. Department scoring (additive)

VIP Levels from confidence score:
  PLATINUM ≥ 80 | GOLD ≥ 60 | SILVER ≥ 40 | STANDARD < 40
  vip_detected = True when confidence ≥ 40

Also generates initial ai_reasoning bullets so they are available
even on the fast-track path (CRITICAL+VIP skips ExplainabilityAgent).
"""
import logging

from app.agents.base_agent import BaseAgent
from app.models.employee import Employee
from app.orchestrator.state import AgentState

logger = logging.getLogger(__name__)

# ── Role scoring table ────────────────────────────────────────────────────────
_ROLE_SCORES: list[tuple[list[str], int]] = [
    (["ceo", "cto", "cfo", "coo", "chief", "c-level", "c-suite", "president"], 50),
    (["evp", "svp", "vp", "vice president"], 45),
    (["director"], 40),
    (["senior manager", "sr. manager", "sr manager"], 28),
    (["manager"], 25),
    (["lead", "principal", "staff engineer"], 15),
]

# ── Department scoring table ──────────────────────────────────────────────────
_DEPT_SCORES: dict[str, int] = {
    "executive":           25,
    "finance":             20,
    "security":            20,
    "legal":               18,
    "hr":                  15,
    "human resources":     15,
    "it":                  12,
    "information technology": 12,
    "operations":          10,
}

# ── VIP level → baseline confidence ──────────────────────────────────────────
_LEVEL_BASELINE: dict[str, float] = {
    "platinum": 90.0,
    "gold":     70.0,
    "silver":   50.0,
    "standard":  0.0,
}

# ── VIP level thresholds ──────────────────────────────────────────────────────
_VIP_THRESHOLDS: list[tuple[str, float]] = [
    ("PLATINUM", 80.0),
    ("GOLD",     60.0),
    ("SILVER",   40.0),
    ("STANDARD",  0.0),
]


def _score_role(role: str) -> tuple[int, str]:
    role_lower = role.lower()
    for keywords, score in _ROLE_SCORES:
        if any(kw in role_lower for kw in keywords):
            return score, f"Role '{role}' matched VIP tier (+{score} pts)"
    return 0, f"Role '{role}' has no direct VIP scoring"


def _score_dept(department: str) -> tuple[int, str]:
    dept_lower = department.lower()
    for dept_key, score in _DEPT_SCORES.items():
        if dept_key in dept_lower:
            return score, f"Department '{department}' is a VIP-priority dept (+{score} pts)"
    return 0, f"Department '{department}' has no VIP priority boost"


def _level_from_score(score: float) -> str:
    for level, threshold in _VIP_THRESHOLDS:
        if score >= threshold:
            return level
    return "STANDARD"


def _build_reasoning(
    employee_found: bool,
    employee_name: str,
    role: str,
    department: str,
    vip_level: str,
    confidence: float,
    priority_score: float,
    source: str,
    override_value: float | None,
) -> list[str]:
    """Generate initial ai_reasoning bullets from VIP detection results."""
    bullets: list[str] = []

    if employee_found:
        bullets.append(
            f"Detected '{employee_name}' in VIP employee registry "
            f"({vip_level} tier, confidence {confidence:.0f}%)."
        )
        if override_value is not None:
            bullets.append(
                f"Applied manual VIP score override of {override_value:.0f}/100 "
                f"set by administrator."
            )
    else:
        if confidence >= 40:
            bullets.append(
                f"Identified VIP status via role/department scoring: "
                f"'{role}' in '{department}' → {vip_level} ({confidence:.0f}% confidence)."
            )
        else:
            bullets.append(
                f"No VIP record found for employee. "
                f"Role '{role}' / dept '{department}' scored below VIP threshold."
            )

    if vip_level in ("GOLD", "PLATINUM"):
        bullets.append(
            f"Flagged as {vip_level} VIP — ticket receives elevated priority treatment."
        )

    return bullets


class VIPAgent(BaseAgent):

    def __init__(self):
        # No LLM needed for this agent
        super().__init__(model_name="", use_llm=False)

    async def run(self, state: AgentState) -> AgentState:
        ticket_id    = state.get("ticket_id", "unknown")
        employee_id  = state.get("employee_id", "")
        self._log_start(ticket_id)

        breakdown: dict    = {}
        raw_score: float   = 0.0
        employee_found     = False
        override_value     = None

        # ── 1. DB lookup by employee_id (primary key) ──────────────────────────
        employee = None
        if employee_id:
            try:
                # Use raw dict filter — most reliable with Motor 3.3 + pymongo 4.5
                employee = await Employee.find_one({"employee_id": employee_id})
                if employee:
                    employee_found = True
                    logger.info(
                        "vip_lookup: employee_id=%s found vip_level=%s override=%s",
                        employee_id, employee.vip_level.value, employee.vip_score_override,
                    )
                else:
                    logger.info("vip_lookup: employee_id=%s not found in DB", employee_id)
            except Exception as exc:
                logger.error("vip_lookup DB error for employee_id=%s: %s", employee_id, exc)
                breakdown["db_error"] = str(exc)

        # ── 2. Score computation ───────────────────────────────────────────────
        if employee_found and employee is not None:
            if employee.vip_score_override is not None:
                # Manual override takes absolute priority
                raw_score      = float(employee.vip_score_override)
                override_value = raw_score
                breakdown["source"]         = "manual_override"
                breakdown["override_value"] = raw_score
            else:
                # Use stored VIP level as a strong baseline
                stored_level = employee.vip_level.value.lower()
                raw_score    = _LEVEL_BASELINE.get(stored_level, 0.0)
                breakdown["source"]         = "db_level_baseline"
                breakdown["db_vip_level"]   = stored_level
                breakdown["baseline_score"] = raw_score

                # Add role + department on top of the baseline (capped at 100)
                role       = state.get("role", employee.role or "")
                dept       = state.get("department", employee.department or "")
                r_score, r_reason = _score_role(role)
                d_score, d_reason = _score_dept(dept)

                # Only add role/dept if they push us higher
                computed = r_score + d_score
                if computed > raw_score:
                    raw_score               = computed
                    breakdown["source"]     = "computed"
                    breakdown["role_score"] = r_score
                    breakdown["dept_score"] = d_score
                    breakdown["role_reason"]= r_reason
                    breakdown["dept_reason"]= d_reason
        else:
            # ── 3. Role + department fallback (no DB record) ──────────────────
            role = state.get("role", "")
            dept = state.get("department", "")

            r_score, r_reason = _score_role(role)
            d_score, d_reason = _score_dept(dept)

            breakdown["role_score"]  = r_score
            breakdown["role_reason"] = r_reason
            breakdown["dept_score"]  = d_score
            breakdown["dept_reason"] = d_reason
            breakdown["source"]      = "computed"
            raw_score = r_score + d_score

        # ── 4. Normalise → level → detected ───────────────────────────────────
        confidence   = min(100.0, max(0.0, float(raw_score)))
        vip_level    = _level_from_score(confidence)
        vip_detected = confidence >= 40.0

        breakdown["raw_score"]  = raw_score
        breakdown["confidence"] = confidence
        breakdown["vip_level"]  = vip_level

        # ── 5. Build initial ai_reasoning bullets ─────────────────────────────
        initial_reasoning = _build_reasoning(
            employee_found = employee_found,
            employee_name  = state.get("employee_name", "Employee"),
            role           = state.get("role", ""),
            department     = state.get("department", ""),
            vip_level      = vip_level,
            confidence     = confidence,
            priority_score = 0.0,  # not computed yet
            source         = breakdown.get("source", "computed"),
            override_value = override_value,
        )

        self._log_complete(
            ticket_id,
            vip_detected=vip_detected,
            vip_level=vip_level,
            confidence=confidence,
            source=breakdown.get("source"),
        )

        return {
            "vip_detected":      vip_detected,
            "vip_level":         vip_level,
            "vip_confidence":    confidence,
            "vip_score_breakdown": breakdown,
            "ai_reasoning":      initial_reasoning,   # seed — explainability will extend
            "errors":            [],
        }
