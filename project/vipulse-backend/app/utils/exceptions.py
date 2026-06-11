from fastapi import HTTPException, status


class VIPulseException(HTTPException):
    """Base exception for VIPulse API errors."""

    def __init__(self, status_code: int, error: str, detail: str | None = None):
        super().__init__(status_code=status_code, detail=detail or error)
        self.error = error


class NotFoundException(VIPulseException):
    def __init__(self, resource: str, identifier: str):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            error="not_found",
            detail=f"{resource} '{identifier}' not found.",
        )


class UnauthorizedException(VIPulseException):
    def __init__(self, message: str = "Authentication required."):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            error="unauthorized",
            detail=message,
        )


class ForbiddenException(VIPulseException):
    def __init__(self, message: str = "Insufficient permissions."):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            error="forbidden",
            detail=message,
        )


class ConflictException(VIPulseException):
    def __init__(self, resource: str, field: str, value: str):
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            error="conflict",
            detail=f"{resource} with {field}='{value}' already exists.",
        )


class ValidationException(VIPulseException):
    def __init__(self, message: str):
        super().__init__(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            error="validation_error",
            detail=message,
        )


class ServiceUnavailableException(VIPulseException):
    def __init__(self, service: str):
        super().__init__(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            error="service_unavailable",
            detail=f"Downstream service '{service}' is currently unavailable.",
        )
