"""
Unit tests for the notification service.

All external I/O (httpx, aiosmtplib) is mocked so tests run without live
Discord or Gmail credentials.
"""
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.models.ticket import Priority, Ticket, TicketStatus, VIPLevel
from app.services.notification_service import notify, send_discord, send_email

pytestmark = pytest.mark.asyncio


# ── Fixtures ──────────────────────────────────────────────────────────────────

def _make_ticket(**overrides) -> Ticket:
    """Build a transient (non-DB) Ticket for testing."""
    defaults = dict(
        ticket_id       = "T-ABCD1234",
        employee_id     = "EMP-001",
        employee_name   = "Alice CEO",
        role            = "Chief Executive Officer",
        department      = "Executive",
        issue_title     = "Cannot access corporate email",
        issue_description = "Email completely down since 9am. Board call in 1 hour.",
        severity        = "critical",
        category        = "Access",
        subcategory     = "Email",
        priority        = Priority.CRITICAL,
        priority_score  = 94.5,
        vip_detected    = True,
        vip_level       = VIPLevel.PLATINUM,
        vip_confidence  = 0.95,
        urgency_level   = "critical",
        business_impact = "severe",
        assigned_team   = "VIP — Identity & Access Management (IAM) Team",
        sla_risk_score  = 88.0,
        sla_deadline    = datetime.now(timezone.utc) + timedelta(hours=1),
        ai_reasoning    = [
            "Detected CEO role — highest VIP tier (PLATINUM, 95% confidence).",
            "Identified Access/Email category with production-blocking keywords.",
            "Calculated priority score 94.5/100 — CRITICAL.",
            "Assigned to VIP IAM Team for concierge-level response.",
            "Predicted SLA breach risk at 88% — 1-hour window.",
        ],
        status          = TicketStatus.OPEN,
        created_by      = "system",
    )
    defaults.update(overrides)
    return Ticket(**defaults)


# ── Discord tests ─────────────────────────────────────────────────────────────

async def test_send_discord_success():
    """send_discord returns True when Discord responds 204."""
    ticket = _make_ticket()

    mock_response = MagicMock()
    mock_response.status_code = 204

    with patch("app.services.notification_service.httpx.AsyncClient") as MockClient:
        mock_client_instance = AsyncMock()
        mock_client_instance.post = AsyncMock(return_value=mock_response)
        MockClient.return_value.__aenter__ = AsyncMock(return_value=mock_client_instance)
        MockClient.return_value.__aexit__ = AsyncMock(return_value=False)

        result = await send_discord(ticket)

    assert result is True
    mock_client_instance.post.assert_called_once()

    # Verify embed structure
    call_kwargs = mock_client_instance.post.call_args
    payload = call_kwargs.kwargs.get("json") or call_kwargs.args[1]
    assert "embeds" in payload
    embed = payload["embeds"][0]
    assert embed["color"] == 15158332           # red for CRITICAL
    assert "TICKET ALERT" in embed["title"].upper() or "VIP" in embed["title"]
    assert embed["footer"]["text"] == "VIPulse AI – Intelligent Service Desk"

    # Verify all required fields are present
    field_names = {f["name"] for f in embed["fields"]}
    assert "Ticket ID" in field_names
    assert "Employee" in field_names
    assert "VIP Level" in field_names
    assert "Issue" in field_names
    assert "Priority" in field_names
    assert "Assigned Team" in field_names
    assert "SLA Risk" in field_names
    assert "AI Reasoning" in field_names


async def test_send_discord_vip_title():
    """VIP ticket must use the VIP TICKET ALERT title."""
    ticket = _make_ticket(vip_detected=True, vip_level=VIPLevel.PLATINUM)

    mock_response = MagicMock(status_code=204)
    with patch("app.services.notification_service.httpx.AsyncClient") as MockClient:
        mock_inst = AsyncMock()
        mock_inst.post = AsyncMock(return_value=mock_response)
        MockClient.return_value.__aenter__ = AsyncMock(return_value=mock_inst)
        MockClient.return_value.__aexit__ = AsyncMock(return_value=False)
        await send_discord(ticket)

    payload = mock_inst.post.call_args.kwargs.get("json") or mock_inst.post.call_args.args[1]
    assert "VIP" in payload["embeds"][0]["title"]


async def test_send_discord_critical_non_vip_title():
    """Non-VIP CRITICAL ticket must use CRITICAL TICKET title."""
    ticket = _make_ticket(vip_detected=False, vip_level=VIPLevel.STANDARD)

    mock_response = MagicMock(status_code=204)
    with patch("app.services.notification_service.httpx.AsyncClient") as MockClient:
        mock_inst = AsyncMock()
        mock_inst.post = AsyncMock(return_value=mock_response)
        MockClient.return_value.__aenter__ = AsyncMock(return_value=mock_inst)
        MockClient.return_value.__aexit__ = AsyncMock(return_value=False)
        await send_discord(ticket)

    payload = mock_inst.post.call_args.kwargs.get("json") or mock_inst.post.call_args.args[1]
    assert "CRITICAL" in payload["embeds"][0]["title"]


async def test_send_discord_color_high():
    """HIGH priority ticket must use yellow/gold color (16776960)."""
    ticket = _make_ticket(
        priority=Priority.HIGH,
        priority_score=72.0,
        vip_detected=False,
        vip_level=VIPLevel.STANDARD,
    )

    mock_response = MagicMock(status_code=204)
    with patch("app.services.notification_service.httpx.AsyncClient") as MockClient:
        mock_inst = AsyncMock()
        mock_inst.post = AsyncMock(return_value=mock_response)
        MockClient.return_value.__aenter__ = AsyncMock(return_value=mock_inst)
        MockClient.return_value.__aexit__ = AsyncMock(return_value=False)
        await send_discord(ticket)

    payload = mock_inst.post.call_args.kwargs.get("json") or mock_inst.post.call_args.args[1]
    assert payload["embeds"][0]["color"] == 16776960


async def test_send_discord_returns_false_on_http_error():
    """Returns False when Discord returns 400."""
    ticket = _make_ticket()

    mock_response = MagicMock(status_code=400, text="Bad Request")
    with patch("app.services.notification_service.httpx.AsyncClient") as MockClient:
        mock_inst = AsyncMock()
        mock_inst.post = AsyncMock(return_value=mock_response)
        MockClient.return_value.__aenter__ = AsyncMock(return_value=mock_inst)
        MockClient.return_value.__aexit__ = AsyncMock(return_value=False)

        result = await send_discord(ticket)

    assert result is False


async def test_send_discord_returns_false_on_network_error():
    """Returns False (never raises) when httpx throws a connection error."""
    ticket = _make_ticket()

    with patch("app.services.notification_service.httpx.AsyncClient") as MockClient:
        mock_inst = AsyncMock()
        mock_inst.post = AsyncMock(side_effect=Exception("Connection refused"))
        MockClient.return_value.__aenter__ = AsyncMock(return_value=mock_inst)
        MockClient.return_value.__aexit__ = AsyncMock(return_value=False)

        result = await send_discord(ticket)

    assert result is False


# ── Email tests ───────────────────────────────────────────────────────────────

async def test_send_email_success():
    """send_email returns True when aiosmtplib.send succeeds."""
    ticket = _make_ticket()

    with patch("app.services.notification_service.aiosmtplib.send", new=AsyncMock()):
        result = await send_email(ticket, recipients=["team@example.com"])

    assert result is True


async def test_send_email_subject_contains_priority_and_ticket_id():
    """Email subject must include priority label and ticket ID."""
    ticket = _make_ticket()
    captured_msg = {}

    async def capture_send(msg, **kwargs):
        captured_msg["subject"] = msg["Subject"]
        captured_msg["to"] = msg["To"]

    with patch("app.services.notification_service.aiosmtplib.send", side_effect=capture_send):
        await send_email(ticket, recipients=["ops@example.com"])

    assert "CRITICAL" in captured_msg["subject"].upper()
    assert ticket.ticket_id in captured_msg["subject"]


async def test_send_email_recipients_from_param():
    """Explicit recipients list must override team routing."""
    ticket = _make_ticket()
    captured = {}

    async def capture_send(msg, **kwargs):
        captured["to"] = msg["To"]

    with patch("app.services.notification_service.aiosmtplib.send", side_effect=capture_send):
        await send_email(ticket, recipients=["custom@example.com"])

    assert "custom@example.com" in captured["to"]


async def test_send_email_returns_false_on_smtp_error():
    """Returns False (never raises) on SMTP failure."""
    ticket = _make_ticket()

    with patch(
        "app.services.notification_service.aiosmtplib.send",
        new=AsyncMock(side_effect=Exception("SMTP auth failed")),
    ):
        result = await send_email(ticket, recipients=["ops@example.com"])

    assert result is False


async def test_send_email_html_contains_ticket_fields():
    """Rendered HTML must contain the ticket ID, employee name, and team."""
    ticket = _make_ticket()
    rendered_html = {}

    async def capture_send(msg, **kwargs):
        for part in msg.walk():
            if part.get_content_type() == "text/html":
                rendered_html["html"] = part.get_payload(decode=True).decode()

    with patch("app.services.notification_service.aiosmtplib.send", side_effect=capture_send):
        await send_email(ticket, recipients=["ops@example.com"])

    html = rendered_html.get("html", "")
    assert ticket.ticket_id in html
    assert ticket.employee_name in html
    assert (ticket.assigned_team or "") in html
    assert "AI Reasoning" in html


# ── notify() concurrent tests ─────────────────────────────────────────────────

async def test_notify_runs_both_concurrently():
    """notify() must call both send_discord and send_email."""
    ticket = _make_ticket()

    discord_called = False
    email_called   = False

    async def mock_discord(t):
        nonlocal discord_called
        discord_called = True
        return True

    async def mock_email(t, recipients=None):
        nonlocal email_called
        email_called = True
        return True

    with (
        patch("app.services.notification_service.send_discord", side_effect=mock_discord),
        patch("app.services.notification_service.send_email",   side_effect=mock_email),
    ):
        result = await notify(ticket)

    assert discord_called is True
    assert email_called   is True
    assert result == {"discord": True, "email": True}


async def test_notify_returns_false_on_partial_failure():
    """notify() returns correct booleans when one channel fails."""
    ticket = _make_ticket()

    with (
        patch("app.services.notification_service.send_discord", new=AsyncMock(return_value=False)),
        patch("app.services.notification_service.send_email",   new=AsyncMock(return_value=True)),
    ):
        result = await notify(ticket)

    assert result["discord"] is False
    assert result["email"]   is True


async def test_notify_handles_exception_gracefully():
    """notify() must not raise even when both channels throw."""
    ticket = _make_ticket()

    with (
        patch("app.services.notification_service.send_discord",
              new=AsyncMock(side_effect=Exception("Discord down"))),
        patch("app.services.notification_service.send_email",
              new=AsyncMock(side_effect=Exception("SMTP down"))),
    ):
        result = await notify(ticket)   # must not raise

    assert result["discord"] is False
    assert result["email"]   is False


# ── Template rendering ────────────────────────────────────────────────────────

def test_email_template_renders_without_error():
    """Jinja2 template must render without raising for a typical ticket."""
    from app.services.notification_service import _jinja_env
    from datetime import datetime, timezone

    template = _jinja_env.get_template("email_alert.html")
    html = template.render(
        header_color="#C0392B",
        header_icon="🚨",
        alert_title="Test Alert",
        priority_label="CRITICAL",
        priority_color="#C0392B",
        vip_detected=True,
        vip_level="PLATINUM",
        vip_confidence_pct=95.0,
        employee_name="Alice CEO",
        role="CEO",
        department="Executive",
        ticket_id="T-ABCD1234",
        issue_title="Email down",
        category="Access",
        subcategory="Email",
        assigned_team="VIP IAM Team",
        urgency_level="critical",
        business_impact="severe",
        priority_score="94.5",
        sla_risk_score=88,
        sla_risk_level="CRITICAL",
        sla_bar_color="#C0392B",
        sla_deadline_str="2026-06-08 14:00 UTC",
        sla_deadline_hours=1,
        ai_reasoning=["Detected CEO", "Calculated CRITICAL", "Assigned VIP team"],
        full_explanation="This is a critical VIP ticket.",
        ticket_url="http://localhost:3000/tickets/T-ABCD1234",
        generated_at="2026-06-08 13:00 UTC",
    )

    assert "T-ABCD1234" in html
    assert "Alice CEO" in html
    assert "PLATINUM" in html
    assert "VIP EMPLOYEE DETECTED" in html
    assert "View Ticket in Dashboard" in html
    assert "AI Reasoning" in html
