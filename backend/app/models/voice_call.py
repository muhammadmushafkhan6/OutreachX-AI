import uuid
from datetime import datetime
from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String, Text, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class VoiceCallSession(Base):
    __tablename__ = "voice_call_sessions"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id"), index=True)
    
    # Business & Lead Details
    business_name: Mapped[str] = mapped_column(String(512), index=True, default="Target Business")
    phone_number: Mapped[str] = mapped_column(String(64), default="")
    contact_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    website: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    category: Mapped[str | None] = mapped_column(String(255), nullable=True)
    location: Mapped[str | None] = mapped_column(String(255), nullable=True)
    lead_score: Mapped[str] = mapped_column(String(32), default="Medium")
    
    # AI Persona & Voice Configuration
    voice_gender: Mapped[str] = mapped_column(String(32), default="female")  # 'male' | 'female'
    voice_name: Mapped[str] = mapped_column(String(64), default="Sarah")
    language: Mapped[str] = mapped_column(String(64), default="roman_urdu")  # 'roman_urdu' | 'urdu' | 'english_us' | 'english_uk'
    call_objective: Mapped[str] = mapped_column(String(128), default="book_meeting")
    
    # Intelligence & Script
    business_analysis: Mapped[dict] = mapped_column(JSON, default=dict)
    pitch_strategy: Mapped[dict] = mapped_column(JSON, default=dict)
    
    # Call Status & Execution
    call_status: Mapped[str] = mapped_column(String(64), default="pending")  # 'pending', 'calling', 'in_progress', 'completed', 'failed', 'meeting_booked'
    call_duration_seconds: Mapped[int] = mapped_column(Integer, default=0)
    sentiment: Mapped[str] = mapped_column(String(32), default="Neutral")  # 'Positive', 'Neutral', 'Negative'
    
    # Transcript & Meeting
    transcript: Mapped[list] = mapped_column(JSON, default=list)
    meeting_booked: Mapped[bool] = mapped_column(Boolean, default=False)
    meeting_details: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    
    notes: Mapped[str] = mapped_column(Text, default="")

    # Twilio tracking
    twilio_call_sid: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user = relationship("User")
