"""
Ticket routes — POST returns 202 immediately; AI pipeline runs in a background task.
"""
import asyncio
import math
from typing import Optional

import structlog
from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect, status
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse

from app.api.v1.dependencies import get_current_user, get_ws_user
from app.api.v1.ws_manager import manager as ws_manager
from app.models.ticket import Priority, Ticket, TicketStatus
from app.models.user import User
from app.schemas.ticket_schemas import (
    LiveTicketItem,
    PaginatedTickets,
    TicketCreateRequest,
    TicketReasoningResponse,
    TicketResponse,
    TicketUpdateRequest,
)
from app.services.ticket_service import TicketService
from app.utils.exceptions import NotFoundException
from app.utils.response import success_response

router = APIRouter(prefix="/tickets", tags=["Tickets"])
logger = structlog.get_logger(__name__)
_svc = TicketService()


# ── Background pipeline task ──────────────────────────────────────────────────

async def _process_ticket_pipeline(ticket: Ticket) -> None:
    """
    Background task:
      1. Run the full AI agent pipeline.
      2. Persist results back to MongoDB + Redis.
      3. Publish WebSocket update event.
    """
    try:
        updated = await _svc.run_pipeline_and_update(ticket)

        # Publish update to all WebSocket subscribers via Redis pub/sub
        await ws_manager.publish({
            "event":         "ticket_updated",
            "ticket_id":     updated.ticket_id,
            "priority":      updated.priority.value,
            "priority_score":updated.priority_score,
            "vip_detected":  updated.vip_detected,
            "status":        updated.status.value,
            "sla_risk_score":updated.sla_risk_score,
            "assigned_team": updated.assigned_team,
        })

        logger.info(
            "background_pipeline_complete",
            ticket_id=updated.ticket_id,
            priority=updated.priority.value,
            vip_detected=updated.vip_detected,
            vip_level=str(updated.vip_level),
            priority_score=updated.priority_score,
            ai_reasoning_count=len(updated.ai_reasoning),
        )
    except Exception as exc:
        logger.error(
            "background_pipeline_error",
            ticket_id=ticket.ticket_id,
            error=str(exc),
            exc_info=True,
        )


# ── POST /tickets/ ────────────────────────────────────────────────────────────

@router.post("/", status_code=status.HTTP_202_ACCEPTED)
async def create_ticket(
    payload: TicketCreateRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Create ticket immediately (202 Accepted) and kick off the AI pipeline
    as a fire-and-forget background task.  The client should poll
    GET /tickets/{ticket_id} or listen on the WebSocket for the enriched result.
    """
    ticket = await _svc.create_ticket(payload, created_by=current_user.user_id)

    # Fire-and-forget — does NOT block the response
    asyncio.create_task(_process_ticket_pipeline(ticket))

    # Use jsonable_encoder to safely handle datetime, ObjectId, and Beanie fields
    ticket_data = TicketResponse.model_validate(ticket.model_dump(mode="json"))
    return JSONResponse(
        status_code=status.HTTP_202_ACCEPTED,
        content=jsonable_encoder(
            success_response(
                data=ticket_data.model_dump(mode="json"),
                message="Ticket accepted. AI pipeline processing in background.",
            )
        ),
    )


# ── GET /tickets/ ─────────────────────────────────────────────────────────────

@router.get("/", response_model=None)
async def list_tickets(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    status: Optional[TicketStatus] = Query(None, description="Filter by status"),
    priority: Optional[Priority] = Query(None, description="Filter by priority"),
    vip_only: bool = Query(False, description="Return only VIP tickets"),
    department: Optional[str] = Query(None, description="Filter by department"),
    search: Optional[str] = Query(None, description="Search by ticket ID or employee name"),
    current_user: User = Depends(get_current_user),
):
    """
    Paginated ticket list with role-aware filtering:
    - ADMIN / MANAGER: see all tickets
    - SUPPORT_AGENT / VIEWER: see only their own submitted tickets
    """
    # Role-aware scoping
    from app.models.user import UserRole
    owner_filter: Optional[str] = None
    if current_user.role not in (UserRole.ADMIN, UserRole.MANAGER):
        owner_filter = current_user.user_id

    tickets, total = await _svc.list_tickets(
        page=page,
        page_size=page_size,
        status=status,
        priority=priority,
        vip_only=vip_only,
        department=department,
        created_by=owner_filter,
        search=search,
    )
    pages = max(1, math.ceil(total / page_size))

    return success_response(
        data=PaginatedTickets(
            items=[TicketResponse.model_validate(t.model_dump(mode="json")) for t in tickets],
            total=total,
            page=page,
            pages=pages,
            page_size=page_size,
            has_next=page < pages,
            has_prev=page > 1,
        ).model_dump(mode="json"),
    )


# ── GET /tickets/{ticket_id} ──────────────────────────────────────────────────

@router.get("/{ticket_id}")
async def get_ticket(
    ticket_id: str,
    current_user: User = Depends(get_current_user),
):
    """Return a single ticket with full AI reasoning. Cached in Redis for 1 hour."""
    ticket = await _svc.get_ticket(ticket_id)
    return success_response(
        data=TicketResponse.model_validate(ticket.model_dump(mode="json")).model_dump(mode="json"),
    )


# ── PATCH /tickets/{ticket_id} ────────────────────────────────────────────────

@router.patch("/{ticket_id}")
async def update_ticket(
    ticket_id: str,
    payload: TicketUpdateRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Update ticket status or assignment.
    SUPPORT_AGENT can only update their own tickets.
    ADMIN / MANAGER can update any ticket.
    """
    from app.models.user import UserRole
    ticket = await _svc.get_ticket(ticket_id)

    # Ownership check for non-admin/manager roles
    if current_user.role not in (UserRole.ADMIN, UserRole.MANAGER):
        if ticket.created_by != current_user.user_id:
            from app.utils.exceptions import ForbiddenException
            raise ForbiddenException("You can only update your own tickets.")
    ticket = await _svc.update_ticket(ticket_id, payload)

    # Broadcast update to WebSocket subscribers
    await ws_manager.publish({
        "event": "ticket_updated",
        "ticket_id": ticket.ticket_id,
        "status": ticket.status.value,
        "priority": ticket.priority.value,
        "assigned_team": ticket.assigned_team,
        "updated_by": current_user.user_id,
    })

    return success_response(
        data=TicketResponse.model_validate(ticket.model_dump(mode="json")).model_dump(mode="json"),
        message="Ticket updated.",
    )


# ── DELETE /tickets/{ticket_id} ───────────────────────────────────────────────

@router.delete("/{ticket_id}", status_code=status.HTTP_200_OK)
async def delete_ticket(
    ticket_id: str,
    current_user: User = Depends(get_current_user),
):
    """
    Soft-delete a ticket with role-based access control.

    Rules:
    - ADMIN    → can delete any ticket
    - MANAGER  → can delete tickets in any department (soft-delete)
    - SUPPORT  → can only delete their own submitted tickets
    - VIEWER   → cannot delete (403 Forbidden)
    """
    from app.models.user import UserRole
    from app.utils.exceptions import ForbiddenException

    # Viewers cannot delete anything
    if current_user.role == UserRole.VIEWER:
        raise ForbiddenException("Viewers do not have permission to delete tickets.")

    # Non-admin/manager: can only delete own tickets
    if current_user.role not in (UserRole.ADMIN, UserRole.MANAGER):
        ticket = await _svc.get_ticket(ticket_id)
        if ticket.is_deleted:
            raise NotFoundException("Ticket", ticket_id)
        if ticket.created_by != current_user.user_id:
            raise ForbiddenException("You can only delete your own tickets.")

    # Perform soft delete with audit trail
    await _svc.soft_delete_ticket(ticket_id, deleted_by=current_user.user_id)

    # Broadcast deletion event to WebSocket subscribers
    await ws_manager.publish({
        "event":      "ticket_deleted",
        "ticket_id":  ticket_id,
        "deleted_by": current_user.user_id,
    })

    logger.info(
        "ticket_deleted",
        ticket_id=ticket_id,
        deleted_by=current_user.user_id,
        role=current_user.role.value,
    )

    return success_response(message="Ticket deleted successfully.")


# ── GET /tickets/{ticket_id}/reasoning ───────────────────────────────────────

@router.get("/{ticket_id}/reasoning")
async def get_ticket_reasoning(
    ticket_id: str,
    current_user: User = Depends(get_current_user),
):
    """
    Return the detailed AI explainability payload for a ticket:
      ai_reasoning bullets, full_explanation paragraph, all agent scores.
    """
    ticket = await _svc.get_ticket(ticket_id)

    # full_explanation is not persisted in the Ticket model (it lives in AgentState).
    # We expose what we have; the field is populated if the ticket was processed fully.
    reasoning_data = TicketReasoningResponse(
        ticket_id=ticket.ticket_id,
        priority_score=ticket.priority_score,
        priority_label=ticket.priority.value.upper(),
        vip_detected=ticket.vip_detected,
        vip_level=ticket.vip_level.value if ticket.vip_level else None,
        vip_confidence=ticket.vip_confidence,
        sla_risk_score=ticket.sla_risk_score,
        sla_deadline=ticket.sla_deadline,
        ai_reasoning=ticket.ai_reasoning,
        full_explanation="",   # enriched by ExplainabilityAgent; not stored in DB model
        category=ticket.category,
        subcategory=ticket.subcategory,
        assigned_team=ticket.assigned_team,
        urgency_level=ticket.urgency_level,
        business_impact=ticket.business_impact,
    )

    return success_response(data=reasoning_data.model_dump())


# ── WebSocket /ws/tickets ─────────────────────────────────────────────────────

@router.websocket("/ws/tickets")
async def websocket_tickets(
    websocket: WebSocket,
    token: str = Query(..., description="JWT access token for authentication"),
):
    """
    Real-time ticket event stream.

    Connect:  ws://host/api/v1/tickets/ws/tickets?token=<access_token>
    Events emitted:
      • ticket_updated  — after any PATCH or after the AI pipeline completes
    """
    # Authenticate via token query param
    try:
        user = await get_ws_user(token=token)
    except Exception:
        await websocket.close(code=4001, reason="Unauthorized")
        return

    await ws_manager.connect(websocket)
    logger.info("ws_client_connected", user_id=user.user_id)

    try:
        while True:
            # Keep connection alive; client may send pings
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
        logger.info("ws_client_disconnected", user_id=user.user_id)
    except Exception as exc:
        logger.error("ws_error", user_id=user.user_id, error=str(exc))
        ws_manager.disconnect(websocket)
