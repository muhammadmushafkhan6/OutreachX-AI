import uuid
from datetime import datetime

from sqlalchemy import JSON, DateTime, ForeignKey, String, Text, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class AIAnalysis(Base):
    __tablename__ = "ai_analysis"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    job_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("jobs.id"), index=True)
    company_name: Mapped[str] = mapped_column(String(512), default="")
    industry: Mapped[str] = mapped_column(String(255), default="")
    business_type: Mapped[str] = mapped_column(String(255), default="")
    niche: Mapped[str] = mapped_column(String(255), default="")
    summary: Mapped[str] = mapped_column(Text, default="")
    lead_score: Mapped[str] = mapped_column(String(20), default="Medium")
    target_audience: Mapped[str] = mapped_column(Text, default="")
    services: Mapped[list] = mapped_column(JSON, default=list)
    raw_response: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    job = relationship("Job", back_populates="ai_analyses")
