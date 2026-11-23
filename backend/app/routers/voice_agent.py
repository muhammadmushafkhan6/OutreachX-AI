import io
import uuid
from typing import List, Optional
from datetime import datetime

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status, Body
from fastapi.responses import PlainTextResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.voice_call import VoiceCallSession
from app.schemas.voice_agent import (
    AnalyzeTargetBusinessRequest,
    BookMeetingRequest,
    CallStatusResponse,
    DialogueTurnRequest,
    DialogueTurnResponse,
    EndCallRequest,
    InitiateCallRequest,
    InitiateCallResponse,
    SheetAnalysisResponse,
    TargetAnalysisResponse,
    UpdateSessionCallStatusRequest,
    VoiceCallSessionResponse,
)
from app.services.voice_agent_service import VoiceAgentService
import app.services.twilio_call_service as twilio_svc
from app.config import get_settings
import logging

logger = logging.getLogger(__name__)
settings = get_settings()

router = APIRouter(prefix="/voice-agent", tags=["AI Voice Agent"])


# ───────────────────────────────────────────────────────────────────────────
# 1. Upload Leads Sheet
# ───────────────────────────────────────────────────────────────────────────
@router.post("/upload-sheet", response_model=SheetAnalysisResponse)
async def upload_leads_sheet(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload and analyze leads sheet (CSV / Excel)."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file uploaded")

    ext = file.filename.lower().split(".")[-1]
    if ext not in ["csv", "xlsx", "xls"]:
        raise HTTPException(
            status_code=400,
            detail="Unsupported file format. Please upload a .csv, .xlsx, or .xls file.",
        )

    content = await file.read()
    service = VoiceAgentService(db)
    try:
        analysis = service.parse_leads_sheet(content, file.filename)
        return analysis
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process leads sheet: {str(e)}")


# ───────────────────────────────────────────────────────────────────────────
# 2. Analyze Target Business + Create Session
# ───────────────────────────────────────────────────────────────────────────
@router.post("/analyze-target", response_model=TargetAnalysisResponse)
async def analyze_target_business(
    req: AnalyzeTargetBusinessRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Perform in-depth analysis on target business, generate pitch & initialize call session."""
    service = VoiceAgentService(db)
    biz_data = req.model_dump()

    deep_analysis = service.analyze_target_business(
        business_data=biz_data,
        voice_gender=req.voice_gender,
        language=req.language,
        call_objective=req.call_objective,
    )

    session = VoiceCallSession(
        user_id=current_user.id,
        business_name=req.business_name,
        phone_number=req.phone_number or "",
        contact_name=req.contact_name,
        website=req.website,
        category=req.category,
        location=req.location,
        voice_gender=req.voice_gender,
        voice_name=req.voice_name,
        language=req.language,
        call_objective=req.call_objective,
        business_analysis=deep_analysis.model_dump(),
        pitch_strategy={
            "opening_hook": deep_analysis.opening_hook,
            "meeting_booking_pitch": deep_analysis.meeting_booking_pitch,
            "objections": deep_analysis.objection_responses,
        },
        transcript=[
            {
                "speaker": "agent",
                "text": deep_analysis.opening_hook,
                "timestamp": datetime.now().strftime("%H:%M:%S"),
            }
        ],
        call_status="pending",
    )

    db.add(session)
    await db.commit()
    await db.refresh(session)

    return TargetAnalysisResponse(
        session_id=session.id,
        business_name=session.business_name,
        phone_number=session.phone_number,
        analysis=deep_analysis,
        opening_script=deep_analysis.opening_hook,
        voice_gender=req.voice_gender,
        voice_name=req.voice_name,
        language=req.language,
    )


# ───────────────────────────────────────────────────────────────────────────
# 3. Initiate Real Twilio Outbound Call
# ───────────────────────────────────────────────────────────────────────────
@router.post("/initiate-call", response_model=InitiateCallResponse)
async def initiate_real_call(
    req: InitiateCallRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Place a real outbound phone call to the prospect via Twilio."""
    stmt = select(VoiceCallSession).where(
        VoiceCallSession.id == req.session_id,
        VoiceCallSession.user_id == current_user.id,
    )
    result = await db.execute(stmt)
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(status_code=404, detail="Call session not found")

    if not session.phone_number or session.phone_number.strip() == "":
        raise HTTPException(
            status_code=400,
            detail="No phone number associated with this lead. Please select a lead with a phone number."
        )

    if not settings.twilio_enabled:
        raise HTTPException(
            status_code=503,
            detail="Twilio is not configured. Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER to .env"
        )

    if settings.twilio_webhook_base_url == "https://placeholder.ngrok.io":
        raise HTTPException(
            status_code=400,
            detail="Twilio webhook URL is not set. Run ngrok and update TWILIO_WEBHOOK_BASE_URL in .env"
        )

    try:
        call_sid = twilio_svc.initiate_outbound_call(session)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.error(f"Twilio call initiation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to initiate call: {str(e)}")

    # Save the Twilio SID and update status
    session.twilio_call_sid = call_sid
    session.call_status = "calling"
    await db.commit()

    return InitiateCallResponse(
        session_id=session.id,
        twilio_call_sid=call_sid,
        call_status="calling",
        message=f"📞 Real phone call placed to {session.phone_number} via Twilio",
    )


# ───────────────────────────────────────────────────────────────────────────
# 4. End Active Twilio Call
# ───────────────────────────────────────────────────────────────────────────
@router.post("/end-call", response_model=VoiceCallSessionResponse)
async def end_active_call(
    req: EndCallRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Terminate the active Twilio call and update session."""
    stmt = select(VoiceCallSession).where(
        VoiceCallSession.id == req.session_id,
        VoiceCallSession.user_id == current_user.id,
    )
    result = await db.execute(stmt)
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(status_code=404, detail="Call session not found")

    # End via Twilio if we have a SID
    if session.twilio_call_sid:
        twilio_svc.end_active_call(session.twilio_call_sid)

    # Get final duration from Twilio if possible
    duration = session.call_duration_seconds
    if session.twilio_call_sid:
        twilio_status = twilio_svc.get_call_status(session.twilio_call_sid)
        duration = twilio_status.get("duration", duration)

    session.call_status = "meeting_booked" if session.meeting_booked else "completed"
    session.call_duration_seconds = duration
    await db.commit()
    await db.refresh(session)
    return session


# ───────────────────────────────────────────────────────────────────────────
# 5. Poll Real-Time Call Status (Frontend polling every 3s during call)
# ───────────────────────────────────────────────────────────────────────────
@router.get("/call-status/{session_id}", response_model=CallStatusResponse)
async def get_live_call_status(
    session_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Poll Twilio for live call status during active call."""
    stmt = select(VoiceCallSession).where(
        VoiceCallSession.id == session_id,
    )
    result = await db.execute(stmt)
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(status_code=404, detail="Call session not found")

    twilio_status = None
    if session.twilio_call_sid:
        ts = twilio_svc.get_call_status(session.twilio_call_sid)
        twilio_status = ts.get("status")
        raw_duration = ts.get("duration", 0)

        # Sync Twilio real duration back into DB during active call
        if raw_duration and raw_duration != session.call_duration_seconds:
            session.call_duration_seconds = raw_duration
            await db.commit()

        # Auto-update session status based on Twilio
        if twilio_status in ("completed", "failed", "canceled", "no-answer", "busy"):
            if session.call_status not in ("completed", "failed", "meeting_booked"):
                session.call_status = "completed" if twilio_status == "completed" else "failed"
                await db.commit()

    return CallStatusResponse(
        session_id=session.id,
        twilio_call_sid=session.twilio_call_sid,
        call_status=session.call_status,
        twilio_status=twilio_status,
        call_duration_seconds=session.call_duration_seconds,
    )


# ───────────────────────────────────────────────────────────────────────────
# 6. Twilio Webhook — Answer (when prospect picks up the phone)
# ───────────────────────────────────────────────────────────────────────────
@router.post(
    "/twilio/answer",
    response_class=PlainTextResponse,
    include_in_schema=False,  # Hidden from public API docs
)
async def twilio_answer_webhook(
    request: Request,
    session_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """
    Public Twilio webhook — called when prospect answers the phone.
    Returns TwiML XML to speak the AI opening hook and gather speech response.
    """
    form_data = await request.form()
    answered_by = form_data.get("AnsweredBy", "human")
    call_sid = form_data.get("CallSid", "")

    stmt = select(VoiceCallSession).where(VoiceCallSession.id == session_id)
    result = await db.execute(stmt)
    session = result.scalar_one_or_none()

    if not session:
        from twilio.twiml.voice_response import VoiceResponse
        r = VoiceResponse()
        r.say("Call session not found. Goodbye!")
        r.hangup()
        return PlainTextResponse(str(r), media_type="text/xml")

    # Update session status to connected
    session.call_status = "in_progress"
    if call_sid:
        session.twilio_call_sid = call_sid
    await db.commit()

    # Voicemail / machine detected
    if answered_by in ("machine_start", "machine_end_beep", "machine_end_silence", "fax"):
        twiml = twilio_svc.build_twiml_voicemail_detected()
        session.call_status = "completed"
        session.notes = f"Reached voicemail/machine: {answered_by}"
        await db.commit()
        return PlainTextResponse(twiml, media_type="text/xml")

    # Human answered — deliver opening hook + gather
    twiml = twilio_svc.build_twiml_opening(session)
    return PlainTextResponse(twiml, media_type="text/xml")


# ───────────────────────────────────────────────────────────────────────────
# 7. Twilio Webhook — Gather (speech input from prospect mid-call)
# ───────────────────────────────────────────────────────────────────────────
@router.post(
    "/twilio/gather",
    response_class=PlainTextResponse,
    include_in_schema=False,
)
async def twilio_gather_webhook(
    request: Request,
    session_id: uuid.UUID,
    turn: int = 1,
    db: AsyncSession = Depends(get_db),
):
    """
    Public Twilio webhook — called after prospect speaks.
    Processes speech with AI, generates reply, returns TwiML to continue call.
    """
    form_data = await request.form()
    speech_result = form_data.get("SpeechResult", "")
    confidence = form_data.get("Confidence", "0")

    stmt = select(VoiceCallSession).where(VoiceCallSession.id == session_id)
    result = await db.execute(stmt)
    session = result.scalar_one_or_none()

    if not session:
        from twilio.twiml.voice_response import VoiceResponse
        r = VoiceResponse()
        r.say("We have encountered an error. Goodbye!")
        r.hangup()
        return PlainTextResponse(str(r), media_type="text/xml")

    voice_name, lang_code = twilio_svc._language_to_twilio_voice(session.voice_gender, session.language)

    if not speech_result or speech_result.strip() == "":
        # No speech detected — re-prompt
        twiml = twilio_svc.build_twiml_reply(
            "I am sorry, I did not catch that. Could you please repeat?",
            str(session_id),
            turn,
            voice_name,
            lang_code,
        )
        return PlainTextResponse(twiml, media_type="text/xml")

    # Update transcript with prospect speech
    now_str = datetime.now().strftime("%H:%M:%S")
    updated_transcript = list(session.transcript or [])
    updated_transcript.append({
        "speaker": "prospect",
        "text": speech_result,
        "timestamp": now_str,
        "confidence": confidence,
    })

    # AI processes the dialogue turn
    service = VoiceAgentService()
    turn_result = service.process_dialogue_turn(
        session=session,
        prospect_speech=speech_result,
        turn_number=turn,
    )

    agent_reply = turn_result["agent_reply"]
    is_meeting_agreed = turn_result.get("is_meeting_agreed", False)

    # Append agent reply to transcript
    updated_transcript.append({
        "speaker": "agent",
        "text": agent_reply,
        "timestamp": datetime.now().strftime("%H:%M:%S"),
    })

    session.transcript = updated_transcript
    session.sentiment = turn_result.get("sentiment", "Neutral")

    if is_meeting_agreed:
        session.meeting_booked = True
        session.sentiment = "Positive"
        session.call_status = "meeting_booked"

    await db.commit()

    # Return TwiML — if meeting agreed, deliver final message + hangup
    twiml = twilio_svc.build_twiml_reply(
        agent_reply,
        str(session_id),
        turn,
        voice_name,
        lang_code,
        is_final=is_meeting_agreed,
    )
    return PlainTextResponse(twiml, media_type="text/xml")


# ───────────────────────────────────────────────────────────────────────────
# 8. Twilio Webhook — Call Status Callback (background status updates)
# ───────────────────────────────────────────────────────────────────────────
@router.post(
    "/twilio/status",
    response_class=PlainTextResponse,
    include_in_schema=False,
)
async def twilio_status_webhook(
    request: Request,
    session_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """
    Twilio status callback — receives real-time call lifecycle events.
    Updates DB session status automatically.
    """
    form_data = await request.form()
    call_status = form_data.get("CallStatus", "")
    call_duration = form_data.get("CallDuration", "0")

    stmt = select(VoiceCallSession).where(VoiceCallSession.id == session_id)
    result = await db.execute(stmt)
    session = result.scalar_one_or_none()

    if session:
        TWILIO_TO_SESSION_STATUS = {
            "ringing": "calling",
            "in-progress": "in_progress",
            "completed": "completed",
            "failed": "failed",
            "busy": "failed",
            "no-answer": "failed",
            "canceled": "failed",
        }
        new_status = TWILIO_TO_SESSION_STATUS.get(call_status)
        if new_status and session.call_status not in ("meeting_booked", "completed", "failed"):
            session.call_status = new_status

        try:
            duration = int(call_duration)
            if duration > 0:
                session.call_duration_seconds = duration
        except ValueError:
            pass

        await db.commit()
        logger.info(f"Twilio status update for session {session_id}: {call_status} ({call_duration}s)")

    return PlainTextResponse("", media_type="text/xml")


# ───────────────────────────────────────────────────────────────────────────
# 9. Dialogue Turn (Simulation / In-Browser Mode)
# ───────────────────────────────────────────────────────────────────────────
@router.post("/dialogue-turn", response_model=DialogueTurnResponse)
async def dialogue_turn(
    req: DialogueTurnRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Handle real-time speech turn (browser simulation mode)."""
    stmt = select(VoiceCallSession).where(
        VoiceCallSession.id == req.session_id,
        VoiceCallSession.user_id == current_user.id,
    )
    result = await db.execute(stmt)
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(status_code=404, detail="Call session not found")

    service = VoiceAgentService(db)
    turn_result = service.process_dialogue_turn(
        session=session,
        prospect_speech=req.prospect_speech,
        turn_number=req.turn_number,
    )

    now_str = datetime.now().strftime("%H:%M:%S")
    updated_transcript = list(session.transcript or [])
    updated_transcript.append({"speaker": "prospect", "text": req.prospect_speech, "timestamp": now_str})
    updated_transcript.append({"speaker": "agent", "text": turn_result["agent_reply"], "timestamp": now_str})

    session.transcript = updated_transcript
    session.sentiment = turn_result.get("sentiment", "Neutral")
    session.call_status = "in_progress"

    if turn_result.get("is_meeting_agreed"):
        session.meeting_booked = True
        session.sentiment = "Positive"

    await db.commit()

    return DialogueTurnResponse(
        session_id=session.id,
        agent_reply=turn_result["agent_reply"],
        sentiment=turn_result.get("sentiment", "Neutral"),
        is_meeting_agreed=turn_result.get("is_meeting_agreed", False),
        meeting_intent=turn_result.get("meeting_intent"),
        audio_hint={"voice": session.voice_name, "gender": session.voice_gender},
    )


# ───────────────────────────────────────────────────────────────────────────
# 10. Book Meeting
# ───────────────────────────────────────────────────────────────────────────
@router.post("/book-meeting", response_model=VoiceCallSessionResponse)
async def book_meeting(
    req: BookMeetingRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Save booked meeting details for a call session."""
    stmt = select(VoiceCallSession).where(
        VoiceCallSession.id == req.session_id,
        VoiceCallSession.user_id == current_user.id,
    )
    result = await db.execute(stmt)
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(status_code=404, detail="Call session not found")

    session.meeting_booked = True
    session.call_status = "meeting_booked"
    session.sentiment = "Positive"
    session.meeting_details = {
        "meeting_date": req.meeting_date,
        "meeting_time": req.meeting_time,
        "attendee_name": req.attendee_name or session.contact_name or session.business_name,
        "attendee_email": req.attendee_email,
        "attendee_phone": req.attendee_phone or session.phone_number,
        "notes": req.notes,
        "booked_at": datetime.now().isoformat(),
    }

    await db.commit()
    await db.refresh(session)
    return session


# ───────────────────────────────────────────────────────────────────────────
# 11. Update Call Status (manual)
# ───────────────────────────────────────────────────────────────────────────
@router.post("/update-status", response_model=VoiceCallSessionResponse)
async def update_call_status(
    req: UpdateSessionCallStatusRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update call session status, duration, and final transcript when call ends."""
    stmt = select(VoiceCallSession).where(
        VoiceCallSession.id == req.session_id,
        VoiceCallSession.user_id == current_user.id,
    )
    result = await db.execute(stmt)
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(status_code=404, detail="Call session not found")

    session.call_status = req.call_status
    session.call_duration_seconds = req.duration_seconds
    if req.sentiment:
        session.sentiment = req.sentiment
    if req.transcript:
        session.transcript = req.transcript

    await db.commit()
    await db.refresh(session)
    return session


# ───────────────────────────────────────────────────────────────────────────
# 12. Call History
# ───────────────────────────────────────────────────────────────────────────
@router.get("/history", response_model=List[VoiceCallSessionResponse])
async def get_call_history(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all past voice call sessions and meetings booked for the user."""
    stmt = (
        select(VoiceCallSession)
        .where(VoiceCallSession.user_id == current_user.id)
        .order_by(desc(VoiceCallSession.created_at))
        .limit(100)
    )
    result = await db.execute(stmt)
    sessions = result.scalars().all()
    return sessions


# ───────────────────────────────────────────────────────────────────────────
# 13. Session Details
# ───────────────────────────────────────────────────────────────────────────
@router.get("/session/{session_id}", response_model=VoiceCallSessionResponse)
async def get_session_details(
    session_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get single call session details."""
    stmt = select(VoiceCallSession).where(
        VoiceCallSession.id == session_id,
        VoiceCallSession.user_id == current_user.id,
    )
    result = await db.execute(stmt)
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(status_code=404, detail="Call session not found")
    return session
