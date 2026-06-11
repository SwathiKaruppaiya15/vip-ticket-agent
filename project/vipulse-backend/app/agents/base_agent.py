"""
Abstract base class for all VIPulse AI agents.

Provides:
- Per-agent structlog logger
- Optional ChatGroq LLM instance (lazy-loaded only when the agent actually needs it)
- _call_llm() with 3-retry exponential backoff (1s → 2s → 4s)
- Structured error appending to state["errors"]
"""
import abc
import asyncio
from typing import Any, List, Optional

import structlog
from langchain_core.messages import BaseMessage

from app.orchestrator.state import AgentState


class BaseAgent(abc.ABC):

    def __init__(self, model_name: str = "", temperature: float = 0.1, use_llm: bool = True):
        self.model_name  = model_name
        self.agent_name  = self.__class__.__name__
        self.logger: structlog.stdlib.BoundLogger = structlog.get_logger(self.agent_name)
        self._use_llm    = use_llm and bool(model_name)
        self._llm        = None          # lazy-loaded on first _call_llm()

    # ── LLM (lazy) ────────────────────────────────────────────────────────────

    @property
    def llm(self):
        if self._llm is None and self._use_llm:
            from langchain_groq import ChatGroq
            from app.core.config import settings
            self._llm = ChatGroq(
                model=self.model_name,
                temperature=0.1,
                groq_api_key=settings.GROQ_API_KEY,
            )
        return self._llm

    # ── Contract ──────────────────────────────────────────────────────────────

    @abc.abstractmethod
    async def run(self, state: AgentState) -> AgentState:
        """Enrich *state* and return the updated dict."""

    # ── LLM call with retry ───────────────────────────────────────────────────

    async def _call_llm(self, messages: List[BaseMessage]) -> str:
        """
        Invoke the LLM with exponential-backoff retry.
        Raises the last exception after 3 failed attempts.
        """
        delays = [1, 2, 4]
        last_exc: Optional[Exception] = None

        for attempt, delay in enumerate(delays, start=1):
            try:
                response = await self.llm.ainvoke(messages)
                return response.content.strip()
            except Exception as exc:
                last_exc = exc
                self.logger.warning(
                    "llm_retry",
                    attempt=attempt,
                    delay=delay,
                    error=str(exc),
                )
                if attempt < len(delays):
                    await asyncio.sleep(delay)

        raise last_exc  # type: ignore[misc]

    # ── Logging helpers ───────────────────────────────────────────────────────

    def _log_start(self, ticket_id: str) -> None:
        self.logger.info("agent_start", agent=self.agent_name, ticket_id=ticket_id)

    def _log_complete(self, ticket_id: str, **kwargs: Any) -> None:
        self.logger.info("agent_complete", agent=self.agent_name, ticket_id=ticket_id, **kwargs)

    def _log_error(self, ticket_id: str, error: str) -> None:
        self.logger.error("agent_error", agent=self.agent_name, ticket_id=ticket_id, error=error)

    # ── Error accumulation ────────────────────────────────────────────────────

    def _make_error(self, message: str) -> str:
        return f"[{self.agent_name}] {message}"

    def _error_state(self, message: str) -> dict:
        """Return a partial state dict that appends one error via operator.add."""
        return {"errors": [self._make_error(message)]}
