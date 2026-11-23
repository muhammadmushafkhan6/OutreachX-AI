from uuid import UUID
from datetime import datetime
from pydantic import BaseModel


class InstagramAccountCreate(BaseModel):
    username: str
    instagram_cookie: str


class InstagramAccountResponse(BaseModel):
    id: UUID
    username: str
    is_active: bool
    last_used_at: datetime | None
    created_at: datetime

    class Config:
        from_attributes = True
