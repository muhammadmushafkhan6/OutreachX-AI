from uuid import UUID

from pydantic import BaseModel


class ExtractedDataResponse(BaseModel):
    id: UUID
    job_id: UUID
    url: str
    company_name: str | None = None
    title: str | None = None
    meta_description: str | None = None
    emails: list[str] = []
    phones: list[str] = []
    social_links: dict[str, str] = {}
    services: list[str] = []
    pricing: str | None = None
    contact_pages: list[str] = []
    business_text: str | None = None
    tech_stack: list[str] = []

    model_config = {"from_attributes": True}


class AIAnalysisResponse(BaseModel):
    id: UUID
    job_id: UUID
    company_name: str
    industry: str
    business_type: str
    niche: str
    summary: str
    lead_score: str
    target_audience: str
    services: list[str] = []

    model_config = {"from_attributes": True}
