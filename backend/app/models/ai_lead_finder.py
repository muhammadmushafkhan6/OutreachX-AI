import uuid
from datetime import datetime
from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID as Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class AILeadFinderJob(Base):
    __tablename__ = "ai_lead_finder_jobs"
    
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id"), index=True)
    status: Mapped[str] = mapped_column(String(50), default="queued", index=True)
    progress: Mapped[int] = mapped_column(Integer, default=0)
    apify_run_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    filters: Mapped[dict | None] = mapped_column(Text, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    
    user = relationship("User", back_populates="ai_lead_finder_jobs")
    leads = relationship("AILeadFinderLead", back_populates="job", cascade="all, delete-orphan")


class AILeadFinderLead(Base):
    __tablename__ = "ai_lead_finder_leads"
    
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    job_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("ai_lead_finder_jobs.id"), index=True)
    company_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    company_website: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    industry: Mapped[str | None] = mapped_column(String(255), nullable=True)
    company_size: Mapped[str | None] = mapped_column(String(50), nullable=True)
    revenue: Mapped[str | None] = mapped_column(String(255), nullable=True)
    funding: Mapped[str | None] = mapped_column(String(255), nullable=True)
    contact_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    job_title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    business_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    personal_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    linkedin_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    location: Mapped[str | None] = mapped_column(String(255), nullable=True)
    country: Mapped[str | None] = mapped_column(String(255), nullable=True)
    lead_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    ai_business_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    ai_cold_email: Mapped[str | None] = mapped_column(Text, nullable=True)
    ai_whatsapp_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    ai_voice_script: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    
    job = relationship("AILeadFinderJob", back_populates="leads")
