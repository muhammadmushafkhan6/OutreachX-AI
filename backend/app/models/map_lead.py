import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, Uuid, JSON, func, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class MapLead(Base):
    __tablename__ = "map_leads"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    job_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("jobs.id"), index=True)
    
    business_name: Mapped[str] = mapped_column(String(512), nullable=False)
    category: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    website: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    rating: Mapped[float | None] = mapped_column(Float, nullable=True)
    reviews: Mapped[int | None] = mapped_column(Integer, nullable=True)
    opening_hours: Mapped[str | None] = mapped_column(Text, nullable=True)
    maps_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)

    place_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    lng: Mapped[float | None] = mapped_column(Float, nullable=True)

    emails: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    extra_phones: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    whatsapp: Mapped[str | None] = mapped_column(String(50), nullable=True)
    social_links: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)

    email_sent: Mapped[bool] = mapped_column(Boolean, default=False)
    email_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    whatsapp_sent: Mapped[bool] = mapped_column(Boolean, default=False)
    whatsapp_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    lead_score: Mapped[str] = mapped_column(String(20), default="Medium")
    recommended_service: Mapped[str | None] = mapped_column(String(255), nullable=True)
    ai_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    source: Mapped[str | None] = mapped_column(String(100), nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    job = relationship("Job", back_populates="map_leads")
