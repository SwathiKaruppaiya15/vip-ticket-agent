from typing import Any, Optional

from pydantic import BaseModel


class APIResponse(BaseModel):
    """Standard API envelope used for all responses."""
    success: bool
    data: Optional[Any] = None
    error: Optional[str] = None
    trace_id: Optional[str] = None
    message: Optional[str] = None


def success_response(
    data: Any = None,
    message: str = "OK",
    trace_id: str | None = None,
) -> dict:
    return APIResponse(
        success=True,
        data=data,
        message=message,
        trace_id=trace_id,
    ).model_dump(exclude_none=True)


def error_response(
    error: str,
    trace_id: str | None = None,
) -> dict:
    return APIResponse(
        success=False,
        error=error,
        trace_id=trace_id,
    ).model_dump(exclude_none=True)
