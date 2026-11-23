import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, Uuid, JSON, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Job(Base):
    __tablename__ = "jobs"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id"), index=True)
    type: Mapped[str] = mapped_column(String(20), nullable=False)  # single | bulk
    mode: Mapped[str] = mapped_column(String(20), default="website")  # website | maps | social | peaky | linkedin
    platform: Mapped[str | None] = mapped_column(String(50), nullable=True)  # instagram | tiktok | etc.
    status: Mapped[str] = mapped_column(String(100), default="queued", index=True)
    progress: Mapped[int] = mapped_column(Integer, default=0)
    url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    query: Mapped[str | None] = mapped_column(String(512), nullable=True)
    location: Mapped[str | None] = mapped_column(String(255), nullable=True)
    total_urls: Mapped[int | None] = mapped_column(Integer, nullable=True)
    processed_urls: Mapped[int] = mapped_column(Integer, default=0)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    meta: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    user = relationship("User", back_populates="jobs")
    websites = relationship("Website", back_populates="job", cascade="all, delete-orphan")
    extracted_data = relationship("ExtractedData", back_populates="job", cascade="all, delete-orphan")
    ai_analyses = relationship("AIAnalysis", back_populates="job", cascade="all, delete-orphan")
    map_leads = relationship("MapLead", back_populates="job", cascade="all, delete-orphan")
    social_media_leads = relationship("SocialMediaLead", back_populates="job", cascade="all, delete-orphan")
    peaky_leads = relationship("PeakyLead", back_populates="job", cascade="all, delete-orphan")
    linkedin_leads = relationship("LinkedInLead", back_populates="job", cascade="all, delete-orphan")
    exports = relationship("Export", back_populates="job", cascade="all, delete-orphan")
    logs = relationship("Log", back_populates="job", cascade="all, delete-orphan")
