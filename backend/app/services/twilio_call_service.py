"""
Twilio Real Phone Calling Service
Handles outbound AI voice calls using Twilio REST API + TwiML conversation flow.
"""
import logging
import json
from typing import Optional

from app.config import get_settings
from app.models.voice_call import VoiceCallSession

logger = logging.getLogger(__name__)
settings = get_settings()


def _get_twilio_client():
    """Lazy import Twilio client to avoid import error if not installed."""
    try:
        from twilio.rest import Client
        return Client(settings.twilio_account_sid, settings.twilio_auth_token)
    except ImportError:
        raise RuntimeError("Twilio package not installed. Run: pip install twilio==9.4.0")
    except Exception as e:
        raise RuntimeError(f"Failed to initialize Twilio client: {e}")


def _get_twiml_response():
    """Lazy import TwiML VoiceResponse."""
    try:
        from twilio.twiml.voice_response import VoiceResponse, Gather, Say, Hangup
        return VoiceResponse, Gather, Say, Hangup
    except ImportError:
        raise RuntimeError("Twilio package not installed. Run: pip install twilio==9.4.0")


def _language_to_twilio_voice(voice_gender: str, language: str) -> tuple[str, str]:
    """
    Map our voice_gender + language to Twilio TTS voice name + language code.
    Returns: (voice_name, language_code)
    """
    VOICE_MAP = {
        # Female voices
        ("female", "roman_urdu"):  ("Polly.Aditi",     "hi-IN"),   # Hindi/Urdu closest in Polly
        ("female", "urdu"):        ("Polly.Aditi",     "hi-IN"),
        ("female", "english_us"):  ("Polly.Joanna",    "en-US"),
        ("female", "english_uk"):  ("Polly.Amy",       "en-GB"),
        # Male voices
        ("male",   "roman_urdu"):  ("Polly.Aditi",     "hi-IN"),   # Twilio neural male in Hindi
        ("male",   "urdu"):        ("Polly.Aditi",     "hi-IN"),
        ("male",   "english_us"):  ("Polly.Matthew",   "en-US"),
        ("male",   "english_uk"):  ("Polly.Brian",     "en-GB"),
    }
    return VOICE_MAP.get((voice_gender, language), ("Polly.Joanna", "en-US"))


def initiate_outbound_call(session: VoiceCallSession) -> str:
    """
    Place a real outbound phone call via Twilio REST API.
    Returns the Twilio Call SID for tracking.
    """
    if not settings.twilio_enabled:
        raise RuntimeError(
            "Twilio is not configured. Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, "
            "and TWILIO_PHONE_NUMBER to your .env file."
        )

    client = _get_twilio_client()
    
    webhook_base = settings.twilio_webhook_base_url.rstrip("/")
    answer_url = f"{webhook_base}/api/v1/voice-agent/twilio/answer?session_id={session.id}"
    status_url = f"{webhook_base}/api/v1/voice-agent/twilio/status?session_id={session.id}"

    call = client.calls.create(
        to=session.phone_number,
        from_=settings.twilio_phone_number,
        url=answer_url,
        status_callback=status_url,
        status_callback_method="POST",
        timeout=30,           # Ring for 30 seconds
        machine_detection="Enable",   # Voicemail detection
        machine_detection_timeout=5,
    )

    logger.info(f"Twilio call initiated: SID={call.sid} → {session.phone_number}")
    return call.sid


def end_active_call(call_sid: str) -> bool:
    """Terminate an active Twilio call by SID."""
    if not settings.twilio_enabled:
        return False
    try:
        client = _get_twilio_client()
        call = client.calls(call_sid).update(status="completed")
        logger.info(f"Twilio call ended: SID={call_sid}, status={call.status}")
        return True
    except Exception as e:
        logger.error(f"Failed to end Twilio call {call_sid}: {e}")
        return False


def build_twiml_opening(session: VoiceCallSession) -> str:
    """
    Build TwiML for the opening of the call.
    Speaks the AI opening hook and then waits for prospect speech input.
    """
    VoiceResponse, Gather, Say, Hangup = _get_twiml_response()

    voice_name, lang_code = _language_to_twilio_voice(session.voice_gender, session.language)
    webhook_base = settings.twilio_webhook_base_url.rstrip("/")
    gather_url = f"{webhook_base}/api/v1/voice-agent/twilio/gather?session_id={session.id}&turn=1"

    # Get opening hook from pitch strategy
    pitch = session.pitch_strategy or {}
    opening_text = pitch.get("opening_hook") or "Hello! Thank you for taking my call today."

    response = VoiceResponse()

    # Gather speech from prospect (speechTimeout=auto means Twilio detects end of speech)
    gather = Gather(
        input="speech",
        action=gather_url,
        method="POST",
        speechTimeout="auto",
        language=lang_code,
        enhanced="true",        # Twilio enhanced speech recognition
        timeout=8,
    )
    gather.say(opening_text, voice=voice_name)
    response.append(gather)

    # Fallback if no speech detected
    response.say(
        "I did not catch that. Please call us back at your convenience. Thank you!",
        voice=voice_name,
    )
    response.hangup()

    return str(response)


def build_twiml_reply(
    agent_reply: str,
    session_id: str,
    turn_number: int,
    voice_name: str,
    lang_code: str,
    is_final: bool = False,
) -> str:
    """
    Build TwiML for a mid-conversation agent reply.
    Speaks the AI reply and then re-gathers prospect speech for next turn.
    """
    VoiceResponse, Gather, Say, Hangup = _get_twiml_response()

    webhook_base = settings.twilio_webhook_base_url.rstrip("/")
    gather_url = f"{webhook_base}/api/v1/voice-agent/twilio/gather?session_id={session_id}&turn={turn_number + 1}"

    response = VoiceResponse()

    if is_final:
        # Meeting booked or call ending — speak farewell and hang up
        response.say(agent_reply, voice=voice_name)
        response.pause(length=1)
        response.say(
            "Thank you so much for your time today. Looking forward to connecting with you. Goodbye!",
            voice=voice_name,
        )
        response.hangup()
    else:
        # Continue conversation loop
        gather = Gather(
            input="speech",
            action=gather_url,
            method="POST",
            speechTimeout="auto",
            language=lang_code,
            enhanced="true",
            timeout=8,
        )
        gather.say(agent_reply, voice=voice_name)
        response.append(gather)

        # If no speech detected again, gracefully end
        response.say(
            "It seems you may have stepped away. I will follow up with you shortly. Have a great day!",
            voice=voice_name,
        )
        response.hangup()

    return str(response)


def build_twiml_voicemail_detected() -> str:
    """TwiML when voicemail/answering machine is detected."""
    VoiceResponse, Gather, Say, Hangup = _get_twiml_response()

    response = VoiceResponse()
    response.say(
        "Hello! This is an automated message from OutreachX. "
        "We had a quick growth strategy to share with you. "
        "Please call us back at your convenience. Thank you and have a great day!",
        voice="Polly.Joanna",
    )
    response.hangup()
    return str(response)


def build_twiml_not_answered() -> str:
    """Simple hangup TwiML when call fails."""
    VoiceResponse, Gather, Say, Hangup = _get_twiml_response()
    response = VoiceResponse()
    response.hangup()
    return str(response)


def get_call_status(call_sid: str) -> dict:
    """Fetch real-time call status from Twilio."""
    if not settings.twilio_enabled:
        return {"status": "unknown", "duration": 0}
    try:
        client = _get_twilio_client()
        call = client.calls(call_sid).fetch()
        return {
            "status": call.status,          # queued, ringing, in-progress, completed, failed, etc.
            "duration": int(call.duration or 0),
            "start_time": str(call.start_time) if call.start_time else None,
            "end_time": str(call.end_time) if call.end_time else None,
        }
    except Exception as e:
        logger.error(f"Failed to fetch Twilio call status for {call_sid}: {e}")
        return {"status": "error", "duration": 0}
