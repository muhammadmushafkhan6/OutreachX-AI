from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


class UserCreate(BaseModel):
    full_name: str = Field(min_length=2, max_length=255)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: UUID
    email: str
    full_name: str
    instagram_username: str | None = None
    is_active: bool = True
    role: str = "user"
    plan: str = "starter"
    created_at: datetime

    model_config = {"from_attributes": True}


class UserUpdate(BaseModel):
    full_name: str | None = None
    email: EmailStr | None = None
    instagram_username: str | None = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


# ── Admin Schemas ──────────────────────────────────────────────────────────

class AdminUserListItem(BaseModel):
    id: UUID
    email: str
    full_name: str
    instagram_username: str | None = None
    is_active: bool
    role: str
    plan: str
    created_at: datetime
    total_jobs: int = 0
    total_leads: int = 0

    model_config = {"from_attributes": True}


class AdminUserCreate(BaseModel):
    full_name: str = Field(min_length=2, max_length=255)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    role: str = "user"
    plan: str = "starter"
    is_active: bool = True


class AdminUpdateStatusRequest(BaseModel):
    is_active: bool


class AdminUpdateRoleRequest(BaseModel):
    role: str = Field(pattern="^(admin|user)$")


class AdminUpdatePlanRequest(BaseModel):
    plan: str = Field(pattern="^(free|starter|pro|enterprise)$")


class AdminStatsResponse(BaseModel):
    total_users: int
    active_users: int
    blocked_users: int
    admin_users: int
    total_jobs: int
    total_leads: int
