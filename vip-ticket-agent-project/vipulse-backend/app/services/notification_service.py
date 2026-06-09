"""
Notification Service — Discord webhook + Gmail SMTP alerts.

Public API
----------
  send_discord(ticket) -> bool
  send_email(ticket, recipients=None) -> bool
  notify(ticket) -> {"discord": bool, "email": bool}

Both send_discord and send_email accept a Ticket document object.
notify() runs both concurrently via asyncio.gather.

Team → recipient routing
------------------------
TEAM_EMAIL_MAP env var: comma-separated "Team Name:email@co.com,..." pairs.
Falls back to GMAIL_USER (i.e. the ops inbox) if no mapping found.
"""
import asyncio
import os
from datetime import datetime, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path
from typing import List, Optional

import aiosmtplib
import httpx
import structlog
from jinja2 import Environment, FileSystemLoader, select_autoescape

from app.core.config import settings
from app.models.ticket import Priority, Ticket, VIPLevel

logger = structlog.get_logger(__name__)

# ── Jinja2 template environment ───────────────────────────────────────────────
_TEMPLATES_DIR = Path(__file__).parent.parent / "templates"
_jinja_env = Environment(
    loader=FileSystemLoader(str(_TEMPLATES_DIR)),
    autoescape=select_autoescape(["html"]),
)

# ── Colour palette ────────────────────────────────────────────────────────────
# Discord uses decimal colours
_DISCORD_COLORS: dict[str, int] = {
    "critical": 15158332,   # #E74C3C  red
    "high":     16776960,   # #FFD700  yellow/gold
    "medium":   16744272,   # #FF8C00  orange
    "low":      9807270,    # #95A5A6  grey
}

# CSS hex colours for the email template
_EMAIL_HEADER_COLORS: dict[str, str] = {
    "critical": "#C0392B",
    "high":     "#E67E22",
    "medium":   "#2980B9",
    "low":      "#27AE60",
}
_EMAIL_PRIORITY_COLORS: dict[str, str] = {
    "critical": "#C0392B",
    "high":     "#E67E22",
    "medium":   "#2980B9",
    "low":      "#27AE60",
}
_SLA_BAR_COLORS: dict[str, str] = {
    "CRITICAL": "#C0392B",
    "HIGH":     "#E67E22",
    "MEDIUM":   "#F39C12",
    "LOW":      "#27AE60",
}


# ── Team → email routing map ──────────────────────────────────────────────────

def _build_team_email_map() -> dict[str, str]:
    """Parse TEAM_EMAIL_MAP env var into a dict."""
    raw = settings.TEAM_EMAIL_MAP.strip()
    if not raw:
        return {}
    result: dict[str, str] = {}
    for pair in raw.split(","):
        pair = pair.strip()
        if ":" in pair:
            team, email = pair.split(":", 1)
            result[team.strip().lower()] = email.strip()
    return result


def _resolve_recipients(ticket: Ticket) -> List[str]:
    """
    Derive alert email recipients.
    Priority: explicit team mapping → ops inbox (GMAIL_USER).
    """
    team_map = _build_team_email_map()
    team_key = (ticket.assigned_team or "").lower()

    # Try exact match, then partial match
    if team_key in team_map:
        return [team_map[team_key]]
    for key, email in team_map.items():
        if key in team_key or team_key in key:
            return [email]

    # Fallback to the configured ops inbox
    return [settings.GMAIL_USER]


# ── Discord notification ──────────────────────────────────────────────────────

async def send_discord(ticket: Ticket) -> bool:
    """
    POST a rich embed to the Discord webhook.
    Returns True on HTTP 200/204, False on any error.
    """
    priority = ticket.priority.value.lower()
    color = _DISCORD_COLORS.get(priority, _DISCORD_COLORS["medium"])

    is_vip = ticket.vip_detected
    title = (
        "🚨 VIP TICKET ALERT"
        if is_vip
        else ("⚠️ CRITICAL TICKET" if priority == "critical" else f"🔔 {priority.upper()} TICKET")
    )

    vip_level_str = (
        ticket.vip_level.value.upper()
        if ticket.vip_level and ticket.vip_level != VIPLevel.STANDARD
        else "Standard"
    )

    # SLA deadline display — normalize to UTC-aware before subtraction
    sla_display = "N/A"
    if ticket.sla_deadline:
        sla_dt = ticket.sla_deadline
        if sla_dt.tzinfo is None:
            sla_dt = sla_dt.replace(tzinfo=timezone.utc)
        remaining = sla_dt - datetime.now(timezone.utc)
        hours_left = max(0, int(remaining.total_seconds() / 3600))
        sla_display = f"{hours_left}h remaining"

    # AI reasoning — first 3 bullets, trimmed for Discord field limit
    reasoning_lines = "\n".join(
        f"✓ {r[:80]}" for r in (ticket.ai_reasoning or [])[:3]
    ) or "Pending AI analysis"

    embed = {
        "title": title,
        "color": color,
        "fields": [
            {
                "name":   "Ticket ID",
                "value":  ticket.ticket_id,
                "inline": True,
            },
            {
                "name":   "Employee",
                "value":  f"{ticket.employee_name} ({ticket.role})",
                "inline": True,
            },
            {
                "name":   "VIP Level",
                "value":  vip_level_str,
                "inline": True,
            },
            {
                "name":   "Issue",
                "value":  ticket.issue_title[:256],
                "inline": False,
            },
            {
                "name":   "Priority",
                "value":  f"🔴 {ticket.priority.value.upper()}  ·  Score: {ticket.priority_score:.0f}/100",
                "inline": True,
            },
            {
                "name":   "Assigned Team",
                "value":  ticket.assigned_team or "Unassigned",
                "inline": True,
            },
            {
                "name":   "SLA Risk",
                "value":  f"{ticket.sla_risk_score:.0f}%  ·  {sla_display}",
                "inline": True,
            },
            {
                "name":   "AI Reasoning",
                "value":  reasoning_lines[:1024],
                "inline": False,
            },
        ],
        "footer": {
            "text": "VIPulse AI – Intelligent Service Desk",
        },
        "timestamp": datetime.utcnow().isoformat(),
    }

    payload = {"embeds": [embed]}

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(settings.DISCORD_WEBHOOK_URL, json=payload)
            success = resp.status_code in (200, 204)
            if success:
                logger.info("discord_sent", ticket_id=ticket.ticket_id, status=resp.status_code)
            else:
                logger.warning(
                    "discord_bad_response",
                    ticket_id=ticket.ticket_id,
                    status=resp.status_code,
                    body=resp.text[:200],
                )
            return success
    except Exception as exc:
        logger.error("discord_failed", ticket_id=ticket.ticket_id, error=str(exc))
        return False


# ── Email notification ────────────────────────────────────────────────────────

async def send_email(
    ticket: Ticket,
    recipients: Optional[List[str]] = None,
) -> bool:
    """
    Send an HTML alert email via Gmail SMTP (STARTTLS on port 587).
    Recipients default to the team routing map or the ops inbox.
    Returns True on success, False on any error.
    """
    to_list = recipients or _resolve_recipients(ticket)
    priority = ticket.priority.value.lower()

    # ── Build template context ────────────────────────────────────────────────
    is_vip = ticket.vip_detected
    vip_level_str = (
        ticket.vip_level.value.upper()
        if ticket.vip_level and ticket.vip_level != VIPLevel.STANDARD
        else "Standard"
    )

    # VIP confidence: stored 0-1 in model, display as %
    vip_confidence_pct = round(ticket.vip_confidence * 100, 1)

    # SLA display values — normalize to UTC-aware before subtraction
    sla_deadline_str = "N/A"
    sla_remaining_hrs: Optional[int] = None
    if ticket.sla_deadline:
        sla_dt = ticket.sla_deadline
        if sla_dt.tzinfo is None:
            sla_dt = sla_dt.replace(tzinfo=timezone.utc)
        sla_deadline_str = sla_dt.strftime("%Y-%m-%d %H:%M UTC")
        remaining_secs = (sla_dt - datetime.now(timezone.utc)).total_seconds()
        sla_remaining_hrs = max(0, int(remaining_secs / 3600))

    # Derive SLA risk level label from score
    sla_score = ticket.sla_risk_score
    if sla_score >= 76:
        sla_risk_level = "CRITICAL"
    elif sla_score >= 51:
        sla_risk_level = "HIGH"
    elif sla_score >= 26:
        sla_risk_level = "MEDIUM"
    else:
        sla_risk_level = "LOW"

    ticket_url = f"{settings.DASHBOARD_URL}/tickets/{ticket.ticket_id}"

    alert_title = (
        "🚨 VIP Ticket Requires Immediate Attention"
        if is_vip
        else (
            "⚠️ Critical Ticket Escalated"
            if priority == "critical"
            else "🔔 High-Priority Ticket Alert"
        )
    )

    context = {
        # Header / branding
        "header_color":      _EMAIL_HEADER_COLORS.get(priority, "#2980B9"),
        "header_icon":       "🚨" if is_vip or priority == "critical" else "⚠️",
        "alert_title":       alert_title,
        "priority_label":    ticket.priority.value.upper(),
        "priority_color":    _EMAIL_PRIORITY_COLORS.get(priority, "#2980B9"),

        # Employee / VIP
        "vip_detected":      is_vip,
        "vip_level":         vip_level_str,
        "vip_confidence_pct": vip_confidence_pct,
        "employee_name":     ticket.employee_name,
        "role":              ticket.role,
        "department":        ticket.department,

        # Ticket details
        "ticket_id":         ticket.ticket_id,
        "issue_title":       ticket.issue_title,
        "category":          ticket.category or "N/A",
        "subcategory":       ticket.subcategory or "",
        "assigned_team":     ticket.assigned_team or "Unassigned",
        "urgency_level":     ticket.urgency_level,
        "business_impact":   ticket.business_impact,
        "priority_score":    f"{ticket.priority_score:.1f}",

        # SLA gauge
        "sla_risk_score":    sla_score,
        "sla_risk_level":    sla_risk_level,
        "sla_bar_color":     _SLA_BAR_COLORS.get(sla_risk_level, "#F39C12"),
        "sla_deadline_str":  sla_deadline_str,
        "sla_deadline_hours": sla_remaining_hrs,

        # AI reasoning
        "ai_reasoning":      ticket.ai_reasoning or [],
        "full_explanation":  "",   # not persisted in Ticket model; shown blank

        # CTA
        "ticket_url":        ticket_url,

        # Footer
        "generated_at":      datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
    }

    # ── Render template ───────────────────────────────────────────────────────
    try:
        template = _jinja_env.get_template("email_alert.html")
        html_body = template.render(**context)
    except Exception as exc:
        logger.error("email_template_render_failed", ticket_id=ticket.ticket_id, error=str(exc))
        return False

    # ── Build MIME message ────────────────────────────────────────────────────
    subject = f"[{ticket.priority.value.upper()}] VIP Ticket Escalated – {ticket.ticket_id}"
    if not is_vip:
        subject = f"[{ticket.priority.value.upper()}] Ticket Alert – {ticket.ticket_id}"

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"]    = settings.GMAIL_USER
    msg["To"]      = ", ".join(to_list)

    # Plain-text fallback
    plain = (
        f"{alert_title}\n\n"
        f"Ticket: {ticket.ticket_id}\n"
        f"Employee: {ticket.employee_name} ({ticket.role})\n"
        f"Issue: {ticket.issue_title}\n"
        f"Priority: {ticket.priority.value.upper()} | Score: {ticket.priority_score:.1f}/100\n"
        f"Team: {ticket.assigned_team or 'Unassigned'}\n"
        f"SLA Risk: {sla_score:.0f}% ({sla_risk_level})\n"
        f"Deadline: {sla_deadline_str}\n\n"
        f"View ticket: {ticket_url}\n\n"
        f"AI Reasoning:\n" +
        "\n".join(f"  ✓ {r}" for r in (ticket.ai_reasoning or [])) +
        "\n\n-- VIPulse AI · Intelligent Service Desk"
    )
    msg.attach(MIMEText(plain, "plain"))
    msg.attach(MIMEText(html_body, "html"))

    # ── Send via Gmail STARTTLS ───────────────────────────────────────────────
    try:
        await aiosmtplib.send(
            msg,
            hostname="smtp.gmail.com",
            port=587,
            start_tls=True,
            username=settings.GMAIL_USER,
            password=settings.GMAIL_APP_PASSWORD,
        )
        logger.info(
            "email_sent",
            ticket_id=ticket.ticket_id,
            recipients=to_list,
            subject=subject,
        )
        return True
    except Exception as exc:
        logger.error(
            "email_failed",
            ticket_id=ticket.ticket_id,
            recipients=to_list,
            error=str(exc),
        )
        return False


# ── Unified notify ────────────────────────────────────────────────────────────

async def notify(
    ticket: Ticket,
    recipients: Optional[List[str]] = None,
) -> dict[str, bool]:
    """
    Fire Discord + email concurrently.
    Never raises — exceptions are caught internally and logged.

    Returns:
        {"discord": bool, "email": bool}
    """
    results = await asyncio.gather(
        send_discord(ticket),
        send_email(ticket, recipients=recipients),
        return_exceptions=True,
    )

    discord_ok = results[0] if isinstance(results[0], bool) else False
    email_ok   = results[1] if isinstance(results[1], bool) else False

    if isinstance(results[0], Exception):
        logger.error("discord_exception", error=str(results[0]))
    if isinstance(results[1], Exception):
        logger.error("email_exception", error=str(results[1]))

    logger.info(
        "notify_complete",
        ticket_id=ticket.ticket_id,
        discord=discord_ok,
        email=email_ok,
    )
    return {"discord": discord_ok, "email": email_ok}
