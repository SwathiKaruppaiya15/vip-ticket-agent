from typing import Optional

from pydantic import BaseModel, EmailStr, Field, model_validator

from app.models.user import UserRole


# ── Request schemas ───────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    username: str      = Field(..., min_length=3, max_length=50, examples=["johndoe"])
    email:    EmailStr = Field(..., examples=["john@company.com"])
    password: str      = Field(..., min_length=8, max_length=128, examples=["mypassword"])
    role:     UserRole = Field(UserRole.SUPPORT_AGENT, examples=["support_agent"])


class LoginRequest(BaseModel):
    email:    EmailStr = Field(..., examples=["admin@vipulse.ai"])
    password: str      = Field(..., examples=["admin123"])


class RefreshRequest(BaseModel):
    refresh_token: str


class ChangeInitialCredentialsRequest(BaseModel):
    """
    Used at PUT /auth/change-initial-credentials.
    Validates that new_password == confirm_password server-side as well.
    """
    new_email:        EmailStr = Field(..., examples=["you@yourcompany.com"])
    current_password: str      = Field(..., min_length=1, examples=["admin123"])
    new_password:     str      = Field(..., min_length=8, max_length=128,
                                       examples=["StrongPass@123"])
    confirm_password: str      = Field(..., min_length=8, max_length=128,
                                       examples=["StrongPass@123"])

    @model_validator(mode="after")
    def passwords_must_match(self) -> "ChangeInitialCredentialsRequest":
        if self.new_password != self.confirm_password:
            raise ValueError("new_password and confirm_password do not match.")
        return self


# ── Response schemas ──────────────────────────────────────────────────────────

class TokenResponse(BaseModel):
    access_token:            str
    refresh_token:           str
    token_type:              str  = "bearer"
    expires_in:              int          # seconds
    must_change_credentials: bool = False  # flag for first-login flow


class UserResponse(BaseModel):
    user_id:                 str
    username:                str
    email:                   str
    role:                    UserRole
    is_active:               bool
    must_change_credentials: bool = False
    is_first_login:          bool = False

    model_config = {"from_attributes": True}


class AuthResponse(BaseModel):
    user:   UserResponse
    tokens: TokenResponse
