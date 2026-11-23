from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, HttpUrl, field_validator


class JobCreateSingle(BaseModel):
    url: str | None = None
    query: str | None = None
    location: str | None = None
    mode: str = "website"  # website | maps | social
    platform: str | None = None  # instagram | tiktok | etc.
    enrich_contacts: bool = False
    use_vortex_actor: bool = False
    use_email_extractor_actor: bool = False

    model_config = {"extra": "allow"}


class JobResponse(BaseModel):
    id: UUID
    type: str
    mode: str
    status: str
    progress: int
    url: str | None = None
    query: str | None = None
    location: str | None = None
    total_urls: int | None = None
    processed_urls: int | None = None
    error_message: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class DashboardStats(BaseModel):
    total_websites: int
    active_jobs: int
    completed_jobs: int
    failed_jobs: int
    total_emails: int
    # New cards
    no_website_businesses: int = 0
    extracted_phones: int = 0
    high_quality_leads: int = 0
    ai_opportunities: int = 0
