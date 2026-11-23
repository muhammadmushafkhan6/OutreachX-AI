import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class PeakyLead(Base):
    __tablename__ = "peaky_leads"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    job_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("jobs.id"), index=True)

    # Person details
    first_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    last_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    person_title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    seniority: Mapped[str | None] = mapped_column(String(255), nullable=True)
    functional: Mapped[str | None] = mapped_column(String(255), nullable=True)
    person_country: Mapped[str | None] = mapped_column(String(255), nullable=True)
    person_state: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Company details
    company_name: Mapped[str | None] = mapped_column(String(512), nullable=True)
    company_domain: Mapped[str | None] = mapped_column(String(512), nullable=True)
    company_employee_size: Mapped[str | None] = mapped_column(String(255), nullable=True)
    company_country: Mapped[str | None] = mapped_column(String(255), nullable=True)
    company_state: Mapped[str | None] = mapped_column(String(255), nullable=True)
    industry: Mapped[str | None] = mapped_column(String(255), nullable=True)
    revenue: Mapped[str | None] = mapped_column(String(255), nullable=True)
    business_model: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Contact details
    work_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    personal_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    linkedin_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    company_linkedin_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)

    # AI/Business logic fields
    lead_score: Mapped[str] = mapped_column(String(20), default="Medium")
    recommended_service: Mapped[str | None] = mapped_column(String(255), nullable=True)
    ai_summary: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    job = relationship("Job", back_populates="peaky_leads")
