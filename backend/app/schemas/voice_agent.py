import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class LeadItem(BaseModel):
    id: Optional[str] = None
    business_name: str
    phone_number: Optional[str] = None
    contact_name: Optional[str] = None
    website: Optional[str] = None
    category: Optional[str] = None
    location: Optional[str] = None
    rating: Optional[float] = None
    reviews: Optional[int] = None
    lead_score: Optional[str] = "Medium"
    recommended_angle: Optional[str] = None


class SheetAnalysisResponse(BaseModel):
    total_leads: int
    leads_with_phone: int
    leads_with_website: int
    top_categories: List[str]
    ai_recommendation_summary: str
    suggested_first_lead: Optional[LeadItem] = None
    leads: List[LeadItem]


class AnalyzeTargetBusinessRequest(BaseModel):
    business_name: str
    phone_number: Optional[str] = None
    contact_name: Optional[str] = None
    website: Optional[str] = None
    category: Optional[str] = None
    location: Optional[str] = None
    voice_gender: str = Field(default="female", description="'male' or 'female'")
    voice_name: str = "Sarah"
    language: str = Field(default="roman_urdu", description="'roman_urdu', 'urdu', 'english_us', 'english_uk'")
    call_objective: str = "book_meeting"


class BusinessDeepAnalysis(BaseModel):
    company_name: str
    detected_strengths: List[str] = Field(default_factory=list)
    pain_points: List[str] = Field(default_factory=list)
    value_proposition: str
    opening_hook: str
    meeting_booking_pitch: str
    objection_responses: Dict[str, str] = Field(default_factory=dict)
    recommended_call_strategy: str


class TargetAnalysisResponse(BaseModel):
    session_id: uuid.UUID
    business_name: str
    phone_number: str
    analysis: BusinessDeepAnalysis
    opening_script: str
    voice_gender: str
    voice_name: str
    language: str


class DialogueTurnRequest(BaseModel):
    session_id: uuid.UUID
    prospect_speech: str
    turn_number: int = 1


class DialogueTurnResponse(BaseModel):
    session_id: uuid.UUID
    agent_reply: str
    sentiment: str = "Neutral"
    is_meeting_agreed: bool = False
    meeting_intent: Optional[Dict[str, Any]] = None
    audio_hint: Optional[Dict[str, Any]] = None


class BookMeetingRequest(BaseModel):
    session_id: uuid.UUID
    meeting_date: str
    meeting_time: str
    attendee_name: Optional[str] = None
    attendee_email: Optional[str] = None
    attendee_phone: Optional[str] = None
    notes: Optional[str] = None


class UpdateSessionCallStatusRequest(BaseModel):
    session_id: uuid.UUID
    call_status: str  # 'completed', 'failed', 'meeting_booked'
    duration_seconds: int = 0
    sentiment: Optional[str] = "Neutral"
    transcript: Optional[List[Dict[str, Any]]] = None


class VoiceCallSessionResponse(BaseModel):
    id: uuid.UUID
    business_name: str
    phone_number: str
    contact_name: Optional[str] = None
    website: Optional[str] = None
    category: Optional[str] = None
    location: Optional[str] = None
    voice_gender: str
    voice_name: str
    language: str
    call_status: str
    call_duration_seconds: int
    sentiment: str
    meeting_booked: bool
    meeting_details: Optional[Dict[str, Any]] = None
    transcript: List[Dict[str, Any]] = Field(default_factory=list)
    twilio_call_sid: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ── Twilio Real Calling Schemas ─────────────────────────────────────────────

class InitiateCallRequest(BaseModel):
    session_id: uuid.UUID


class InitiateCallResponse(BaseModel):
    session_id: uuid.UUID
    twilio_call_sid: str
    call_status: str = "dialing"
    message: str = "Real phone call initiated via Twilio"


class EndCallRequest(BaseModel):
    session_id: uuid.UUID


class CallStatusResponse(BaseModel):
    session_id: uuid.UUID
    twilio_call_sid: Optional[str] = None
    call_status: str
    twilio_status: Optional[str] = None
    call_duration_seconds: int = 0


class TwilioGatherWebhookData(BaseModel):
    """Data Twilio sends to our /gather webhook."""
    SpeechResult: Optional[str] = None
    Confidence: Optional[str] = None
    CallSid: Optional[str] = None
    CallStatus: Optional[str] = None
    From: Optional[str] = None
    To: Optional[str] = None
