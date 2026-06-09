"""
Ticket Service — business logic layer between API routes and the agent pipeline.
Phase 3: adds Redis caching, department filter, and cache invalidation.
"""
import json
from datetime import datetime, timedelta, timezone
from typing import Optional

import structlog

from app.core.redis_client import get_redis
from app.models.ticket import Priority, Ticket, TicketStatus, VIPLevel
from app.orchestrator.graph import process_ticket
from app.orchestrator.state import AgentState
from app.schemas.ticket_schemas import TicketCreateRequest, TicketUpdateRequest
from app.utils.exceptions import NotFoundException

logger = structlog.get_logger(__name__)

# Redis key helpers
_TICKET_KEY = "ticket:{ticket_id}"
_TICKET_TTL = 3600          # 1 hour

# Priority / VIP label → enum maps
_PRIORITY_MAP: dict[str, Priority] = {
    "LOW": Priority.LOW,
    "MEDIUM": Priority.MEDIUM,
    "HIGH": Priority.HIGH,
    "CRITICAL": Priority.CRITICAL,
}
_VIP_LEVEL_MAP: dict[str, VIPLevel] = {
    "STANDARD": VIPLevel.STANDARD,
    "SILVER": VIPLevel.SILVER,
    "GOLD": VIPLevel.GOLD,
    "PLATINUM": VIPLevel.PLATINUM,
}


def _ticket_cache_key(ticket_id: str) -> str:
    return _TICKET_KEY.format(ticket_id=ticket_id)


class TicketService:

    # ── Create ────────────────────────────────────────────────────────────────

    async def create_ticket(
        self,
        payload: TicketCreateRequest,
        created_by: str,
    ) -> Ticket:
        """
        1. Build a Ticket document (generates stable ticket_id).
        2. Save skeleton to DB immediately so the ID is reserved.
        3. Run AI pipeline in the background (caller uses asyncio.create_task).
           This method returns BEFORE pipeline finishes (202 pattern).
        """
        ticket = Ticket(
            employee_id=payload.employee_id,
            employee_name=payload.employee_name,
            role=payload.role,
            department=payload.department,
            issue_title=payload.issue_title,
            issue_description=payload.issue_description,
            severity=payload.severity,
            created_by=created_by,
        )
        await ticket.insert()
        return ticket

    async def run_pipeline_and_update(self, ticket: Ticket) -> Ticket:
        """
        Called from the background task.
        Runs the agent pipeline and writes results back to the DB + cache.
        """
        final_state: AgentState = await process_ticket({
            "ticket_id":         ticket.ticket_id,
            "employee_id":       ticket.employee_id,
            "employee_name":     ticket.employee_name,
            "role":              ticket.role,
            "department":        ticket.department,
            "issue_title":       ticket.issue_title,
            "issue_description": ticket.issue_description,
            "severity":          ticket.severity,
        })

        # Log what the pipeline produced for observability
        logger.info(
            "pipeline_state_received",
            ticket_id=ticket.ticket_id,
            vip_detected=final_state.get("vip_detected"),
            vip_level=final_state.get("vip_level"),
            vip_confidence=final_state.get("vip_confidence"),
            priority_label=final_state.get("priority_label"),
            priority_score=final_state.get("priority_score"),
            ai_reasoning_count=len(final_state.get("ai_reasoning") or []),
            errors=final_state.get("errors", []),
        )

        # Build the update payload
        priority_label = (final_state.get("priority_label") or "MEDIUM").upper()
        vip_str = (final_state.get("vip_level") or "STANDARD").upper()
        deadline_hours = final_state.get("sla_deadline_hours", 24)

        updates = {
            "category":         final_state.get("category") or None,
            "subcategory":      final_state.get("subcategory") or None,
            "priority":         _PRIORITY_MAP.get(priority_label, Priority.MEDIUM).value,
            "priority_score":   final_state.get("priority_score", 0.0),
            "vip_detected":     final_state.get("vip_detected", False),
            "vip_level":        _VIP_LEVEL_MAP.get(vip_str, VIPLevel.STANDARD).value,
            # vip_confidence stored 0-1 in model; pipeline outputs 0-100
            "vip_confidence":   final_state.get("vip_confidence", 0.0) / 100.0,
            "urgency_level":    final_state.get("urgency_level", "low"),
            "business_impact":  final_state.get("business_impact", "minimal"),
            "assigned_team":    final_state.get("assigned_team") or None,
            "assigned_agent":   None,
            "sla_risk_score":   final_state.get("sla_risk_score", 0.0),
            "sla_deadline":     datetime.now(timezone.utc) + timedelta(hours=deadline_hours),
            "ai_reasoning":     final_state.get("ai_reasoning", []),
            "discord_notified": final_state.get("discord_sent", False),
            "email_notified":   final_state.get("email_sent", False),
            "updated_at":       datetime.now(timezone.utc),
        }

        await ticket.update({"$set": updates})

        # CRITICAL: invalidate Redis cache before reading back, so we get
        # the freshly written MongoDB document (not the stale cached skeleton)
        await self._invalidate_cache(ticket.ticket_id)
        updated = await self.get_ticket(ticket.ticket_id)

        # ── Post-pipeline notifications (real Ticket object, not proxy) ───────
        # The NotificationAgent may have already fired during the pipeline for
        # fast-tracked CRITICAL+VIP tickets.  Only re-notify if both flags are
        # still False (i.e. the agent was skipped on the fast-track path or
        # the agent itself failed).
        should_notify = (
            updated.vip_detected
            or updated.priority.value in ("high", "critical")
            or updated.sla_risk_score >= 75
        )
        if should_notify and not (updated.discord_notified and updated.email_notified):
            try:
                from app.services.notification_service import notify as _notify
                notif_results = await _notify(updated)
                notify_updates: dict = {"updated_at": datetime.now(timezone.utc)}
                if notif_results.get("discord") and not updated.discord_notified:
                    notify_updates["discord_notified"] = True
                if notif_results.get("email") and not updated.email_notified:
                    notify_updates["email_notified"] = True
                if len(notify_updates) > 1:
                    await updated.update({"$set": notify_updates})
                    updated = await self.get_ticket(ticket.ticket_id)
            except Exception as exc:
                logger.warning(
                    "post_pipeline_notify_failed",
                    ticket_id=ticket.ticket_id,
                    error=str(exc),
                )

        # Cache the enriched ticket
        await self._cache_ticket(updated)
        return updated

    # ── Read ──────────────────────────────────────────────────────────────────

    async def get_ticket(self, ticket_id: str) -> Ticket:
        # 1. Try Redis cache
        cached = await self._get_cached_ticket(ticket_id)
        if cached:
            return cached

        # 2. Fallback to MongoDB
        ticket = await Ticket.find_one(Ticket.ticket_id == ticket_id)
        if not ticket:
            raise NotFoundException("Ticket", ticket_id)

        await self._cache_ticket(ticket)
        return ticket

    async def list_tickets(
        self,
        page: int = 1,
        page_size: int = 20,
        status: Optional[TicketStatus] = None,
        priority: Optional[Priority] = None,
        vip_only: bool = False,
        department: Optional[str] = None,
        created_by: Optional[str] = None,
        search: Optional[str] = None,
    ) -> tuple[list[Ticket], int]:
        # Always exclude soft-deleted tickets from list view
        query: dict = {"is_deleted": {"$ne": True}}
        if status:
            query["status"] = status.value
        if priority:
            query["priority"] = priority.value
        if vip_only:
            query["vip_detected"] = True
        if department:
            query["department"] = department
        if created_by:
            query["created_by"] = created_by
        if search:
            import re
            pattern = re.compile(re.escape(search.strip()), re.IGNORECASE)
            query["$or"] = [
                {"ticket_id":    {"$regex": pattern.pattern, "$options": "i"}},
                {"employee_name":{"$regex": pattern.pattern, "$options": "i"}},
                {"issue_title":  {"$regex": pattern.pattern, "$options": "i"}},
            ]

        skip = (page - 1) * page_size
        tickets = await Ticket.find(query).sort("-created_at").skip(skip).limit(page_size).to_list()
        total   = await Ticket.find(query).count()
        return tickets, total

    # ── Update ────────────────────────────────────────────────────────────────

    async def update_ticket(
        self,
        ticket_id: str,
        payload: TicketUpdateRequest,
    ) -> Ticket:
        ticket = await self.get_ticket(ticket_id)
        updates = payload.model_dump(exclude_none=True)
        updates["updated_at"] = datetime.now(timezone.utc)

        if updates.get("status") == TicketStatus.RESOLVED.value or \
           updates.get("status") == TicketStatus.RESOLVED:
            updates["resolved_at"] = datetime.now(timezone.utc)

        # Normalise enum values to strings for the $set
        if "status" in updates and isinstance(updates["status"], TicketStatus):
            updates["status"] = updates["status"].value
        if "priority" in updates and isinstance(updates["priority"], Priority):
            updates["priority"] = updates["priority"].value

        await ticket.update({"$set": updates})

        # Invalidate cache
        await self._invalidate_cache(ticket_id)

        return await self.get_ticket(ticket_id)

    # ── Soft Delete ───────────────────────────────────────────────────────────

    async def soft_delete_ticket(self, ticket_id: str, deleted_by: str) -> None:
        """
        Soft delete — sets is_deleted=True and records audit fields.
        The ticket remains in MongoDB but is invisible to all normal queries.
        Only admins can see/restore it via direct DB queries.
        """
        ticket = await Ticket.find_one(Ticket.ticket_id == ticket_id)
        if not ticket:
            raise NotFoundException("Ticket", ticket_id)

        await ticket.update({"$set": {
            "is_deleted":  True,
            "deleted_at":  datetime.now(timezone.utc),
            "deleted_by":  deleted_by,
            "updated_at":  datetime.now(timezone.utc),
        }})
        await self._invalidate_cache(ticket_id)
        logger.info("ticket_soft_deleted", ticket_id=ticket_id, deleted_by=deleted_by)

    # ── Hard Delete (kept for internal use) ───────────────────────────────────

    async def delete_ticket(self, ticket_id: str) -> None:
        """Hard delete — use soft_delete_ticket in production."""
        ticket = await self.get_ticket(ticket_id)
        await ticket.delete()
        await self._invalidate_cache(ticket_id)

    # ── Live feed ─────────────────────────────────────────────────────────────

    async def get_live_tickets(self, limit: int = 20) -> list[Ticket]:
        """Top open tickets sorted by priority_score descending."""
        return (
            await Ticket.find({"status": TicketStatus.OPEN.value})
            .sort("-priority_score")
            .limit(limit)
            .to_list()
        )

    # ── Cache helpers ─────────────────────────────────────────────────────────

    async def _cache_ticket(self, ticket: Ticket) -> None:
        try:
            redis = get_redis()
            data = ticket.model_dump(mode="json")
            await redis.set(
                _ticket_cache_key(ticket.ticket_id),
                json.dumps(data, default=str),
                ex=_TICKET_TTL,
            )
        except Exception as exc:
            logger.warning("ticket_cache_write_failed", error=str(exc))

    async def _get_cached_ticket(self, ticket_id: str) -> Optional[Ticket]:
        try:
            redis = get_redis()
            raw = await redis.get(_ticket_cache_key(ticket_id))
            if raw:
                data = json.loads(raw)
                return Ticket.model_validate(data)
        except Exception as exc:
            logger.warning("ticket_cache_read_failed", error=str(exc))
        return None

    async def _invalidate_cache(self, ticket_id: str) -> None:
        try:
            redis = get_redis()
            await redis.delete(_ticket_cache_key(ticket_id))
        except Exception as exc:
            logger.warning("ticket_cache_invalidate_failed", error=str(exc))
