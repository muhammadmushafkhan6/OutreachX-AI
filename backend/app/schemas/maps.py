import uuid
from datetime import datetime
from pydantic import BaseModel


class MapLeadResponse(BaseModel):
    id: uuid.UUID
    job_id: uuid.UUID
    business_name: str
    category: str | None = None
    phone: str | None = None
    address: str | None = None
    website: str | None = None
    email: str | None = None
    rating: float | None = None
    reviews: int | None = None
    opening_hours: str | None = None
    maps_url: str | None = None

    place_id: str | None = None
    lat: float | None = None
    lng: float | None = None

    emails: list[str] | None = None
    extra_phones: list[str] | None = None
    whatsapp: str | None = None
    social_links: dict | None = None

    email_sent: bool = False
    email_sent_at: datetime | None = None
    whatsapp_sent: bool = False
    whatsapp_sent_at: datetime | None = None

    lead_score: str = "Medium"
    recommended_service: str | None = None
    ai_summary: str | None = None
    source: str | None = None
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


class SocialMediaLeadResponse(BaseModel):
    id: uuid.UUID
    job_id: uuid.UUID
    platform: str
    username: str
    full_name: str | None = None
    bio: str | None = None
    followers_count: int | None = None
    following_count: int | None = None
    posts_count: int | None = None
    website: str | None = None
    email: str | None = None
    phone: str | None = None
    profile_url: str | None = None
    profile_pic_url: str | None = None
    lead_score: str
    recommended_service: str | None = None
    ai_summary: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class PeakyLeadResponse(BaseModel):
    id: uuid.UUID
    job_id: uuid.UUID

    # Person details
    first_name: str | None = None
    last_name: str | None = None
    person_title: str | None = None
    seniority: str | None = None
    functional: str | None = None
    person_country: str | None = None
    person_state: str | None = None

    # Company details
    company_name: str | None = None
    company_domain: str | None = None
    company_employee_size: str | None = None
    company_country: str | None = None
    company_state: str | None = None
    industry: str | None = None
    revenue: str | None = None
    business_model: str | None = None

    # Contact details
    work_email: str | None = None
    personal_email: str | None = None
    phone: str | None = None
    linkedin_url: str | None = None
    company_linkedin_url: str | None = None

    # AI/Business logic fields
    lead_score: str
    recommended_service: str | None = None
    ai_summary: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class LinkedInLeadResponse(BaseModel):
    id: uuid.UUID
    job_id: uuid.UUID

    # Person details
    first_name: str | None = None
    last_name: str | None = None
    full_name: str | None = None
    job_title: str | None = None
    seniority: str | None = None

    # Company details
    company_name: str | None = None
    company_website: str | None = None
    company_size: str | None = None
    industry: str | None = None

    # Location
    country: str | None = None
    city: str | None = None
    location: str | None = None

    # Contact details
    work_email: str | None = None
    personal_email: str | None = None
    phone: str | None = None
    linkedin_url: str | None = None
    company_linkedin_url: str | None = None

    # AI/Business logic fields
    lead_score: str
    recommended_service: str | None = None
    ai_summary: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}
