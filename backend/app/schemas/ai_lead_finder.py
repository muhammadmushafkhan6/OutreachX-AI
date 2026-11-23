from pydantic import BaseModel, Field
from typing import List, Optional, Any
from datetime import datetime
import uuid


# Filter schemas
class AILeadFinderFilters(BaseModel):
    job_titles: Optional[List[str]] = Field(default=None, description="Job titles to filter (e.g., Founder, CEO, Marketing Manager)")
    country: Optional[str] = Field(default=None, description="Country to filter leads")
    state_region: Optional[str] = Field(default=None, description="State/Region to filter leads")
    city: Optional[str] = Field(default=None, description="City to filter leads")
    industry: Optional[str] = Field(default=None, description="Industry to filter leads")
    company_size: Optional[str] = Field(default=None, description="Company size (e.g., 1-10, 11-50, 51-200, 201-500, 500+)")
    company_revenue: Optional[str] = Field(default=None, description="Company revenue range")
    funding: Optional[str] = Field(default=None, description="Funding information")
    company_website: Optional[str] = Field(default="any", description="Has Website, No Website, Any")
    email_status: Optional[str] = Field(default="any", description="Verified, Any")
    keywords: Optional[str] = Field(default=None, description="Keywords to search")
    number_of_leads: Optional[int] = Field(default=20, description="Number of leads to fetch")


# Lead schema
class AILeadFinderLeadResponse(BaseModel):
    id: uuid.UUID
    job_id: uuid.UUID
    company_name: Optional[str] = None
    company_website: Optional[str] = None
    industry: Optional[str] = None
    company_size: Optional[str] = None
    revenue: Optional[str] = None
    funding: Optional[str] = None
    contact_name: Optional[str] = None
    job_title: Optional[str] = None
    business_email: Optional[str] = None
    personal_email: Optional[str] = None
    phone_number: Optional[str] = None
    linkedin_url: Optional[str] = None
    location: Optional[str] = None
    country: Optional[str] = None
    lead_score: Optional[int] = None
    ai_business_summary: Optional[str] = None
    ai_cold_email: Optional[str] = None
    ai_whatsapp_message: Optional[str] = None
    ai_voice_script: Optional[str] = None
    created_at: datetime


# Job schema
class AILeadFinderJobResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    status: str
    progress: int
    apify_run_id: Optional[str] = None
    filters: Optional[dict] = None
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime


# Request schemas
class StartAILeadFinderRequest(BaseModel):
    filters: AILeadFinderFilters


# Response schemas
class StartAILeadFinderResponse(BaseModel):
    job_id: uuid.UUID
    message: str


class PaginatedAILeadFinderLeadsResponse(BaseModel):
    leads: List[AILeadFinderLeadResponse]
    total: int
    page: int
    page_size: int
