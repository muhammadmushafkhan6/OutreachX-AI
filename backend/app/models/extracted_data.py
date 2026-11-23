import uuid
from datetime import datetime

from sqlalchemy import JSON, DateTime, ForeignKey, String, Text, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class ExtractedData(Base):
    __tablename__ = "extracted_data"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    job_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("jobs.id"), index=True)
    website_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("websites.id"), nullable=True)
    url: Mapped[str] = mapped_column(String(2048), nullable=False)
    company_name: Mapped[str | None] = mapped_column(String(512), nullable=True)
    title: Mapped[str | None] = mapped_column(String(512), nullable=True)
    meta_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    emails: Mapped[list] = mapped_column(JSON, default=list)
    phones: Mapped[list] = mapped_column(JSON, default=list)
    social_links: Mapped[dict] = mapped_column(JSON, default=dict)
    services: Mapped[list] = mapped_column(JSON, default=list)
    pricing: Mapped[str | None] = mapped_column(Text, nullable=True)
    contact_pages: Mapped[list] = mapped_column(JSON, default=list)
    business_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    tech_stack: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    job = relationship("Job", back_populates="extracted_data")
