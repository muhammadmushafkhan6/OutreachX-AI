from datetime import datetime
from uuid import UUID
from typing import Any, Optional

from pydantic import BaseModel, EmailStr, Field


class OutreachRequest(BaseModel):
    business_name: str
    category: str
    location: str
    phone: str


class OutreachResponse(BaseModel):
    message: str
    phone: str
    status: str = "generated"


class DMTrackRequest(BaseModel):
    lead_id: str
    timestamp: str


# ---------------- Email Schemas ----------------

class EmailGenerateRequest(BaseModel):
    business_name: str
    category: Optional[str] = None
    location: Optional[str] = None
    website: Optional[str] = None
    recipient_name: Optional[str] = None
    tone: str = "professional"
    purpose: str = "introduction"
    services_offered: Optional[str] = None


class EmailGenerateResponse(BaseModel):
    subject: str
    html_body: str
    text_body: str
    status: str = "generated"


class EmailSendRequest(BaseModel):
    to_email: EmailStr
    to_name: Optional[str] = None
    subject: str
    html_body: str
    text_body: Optional[str] = None
    reply_to: Optional[EmailStr] = None
    cc: Optional[list[EmailStr]] = None
    bcc: Optional[list[EmailStr]] = None
    lead_id: Optional[UUID] = None
    lead_type: Optional[str] = None


class EmailSendResponse(BaseModel):
    success: bool
    to: str
    subject: str
    from_email: Optional[str] = None
    error: Optional[str] = None
    sent_email_id: Optional[UUID] = None


class EmailTestResponse(BaseModel):
    configured: bool
    success: bool
    message: str
    from_email: Optional[str] = None


class EmailBulkRecipient(BaseModel):
    email: EmailStr
    name: Optional[str] = None
    business_name: Optional[str] = None
    category: Optional[str] = None
    location: Optional[str] = None
    phone: Optional[str] = None
    lead_id: Optional[UUID] = None
    lead_type: Optional[str] = None


class EmailBulkSendRequest(BaseModel):
    recipients: list[EmailBulkRecipient]
    subject_template: str
    html_template: str
    text_template: Optional[str] = None
    reply_to: Optional[EmailStr] = None
    delay_seconds: float = 1.0
    campaign_name: Optional[str] = None


class EmailBulkSendResponse(BaseModel):
    total: int
    success_count: int
    failed_count: int
    results: list[dict[str, Any]]
    campaign_id: Optional[UUID] = None


class EmailTemplateBase(BaseModel):
    name: str
    subject: str
    html_body: str
    text_body: Optional[str] = None
    variables: Optional[dict[str, Any]] = None
    is_default: bool = False


class EmailTemplateCreate(EmailTemplateBase):
    pass


class EmailTemplateUpdate(BaseModel):
    name: Optional[str] = None
    subject: Optional[str] = None
    html_body: Optional[str] = None
    text_body: Optional[str] = None
    variables: Optional[dict[str, Any]] = None
    is_default: Optional[bool] = None


class EmailTemplateOut(EmailTemplateBase):
    id: UUID
    user_id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SentEmailOut(BaseModel):
    id: UUID
    user_id: UUID
    campaign_id: Optional[UUID] = None
    lead_id: Optional[UUID] = None
    lead_type: Optional[str] = None
    to_email: str
    to_name: Optional[str] = None
    from_email: str
    subject: str
    status: str
    error_message: Optional[str] = None
    sent_at: Optional[datetime] = None
    opened_at: Optional[datetime] = None
    clicked_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class EmailCampaignBase(BaseModel):
    name: str
    subject: str
    html_body: str
    text_body: Optional[str] = None
    from_name: Optional[str] = None
    reply_to: Optional[str] = None
    delay_seconds: int = 1


class EmailCampaignCreate(EmailCampaignBase):
    template_id: Optional[UUID] = None


class EmailCampaignOut(EmailCampaignBase):
    id: UUID
    user_id: UUID
    template_id: Optional[UUID] = None
    status: str
    total_recipients: int
    sent_count: int
    failed_count: int
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class EmailCampaignStartRequest(BaseModel):
    recipients: list[EmailBulkRecipient]

