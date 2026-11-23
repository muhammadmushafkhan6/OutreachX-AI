import io
import json
import logging
import re
import uuid
from typing import Any, Dict, List, Optional, Tuple

import httpx
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from app.config import get_settings
from app.models.voice_call import VoiceCallSession
from app.schemas.voice_agent import (
    BusinessDeepAnalysis,
    LeadItem,
    SheetAnalysisResponse,
)

logger = logging.getLogger(__name__)
settings = get_settings()


VOICE_ANALYSIS_SYSTEM_PROMPT = """You are an elite B2B AI Voice Calling Strategist and Business Analyst.
Analyze the target business and craft a high-converting voice call strategy specifically designed to book a 10-15 minute discovery/strategy meeting.

Language guidelines:
- If language is 'roman_urdu': write scripts and objection responses in natural, polite Roman Urdu (e.g., "Assalam o Alaikum, umeed hai aap khairiyat se honge...").
- If language is 'urdu': write in Urdu script.
- If language is 'english_us' or 'english_uk': write in natural, crisp conversational English.

Voice Gender Tone:
- If 'male': confident, warm, professional, respectful tone.
- If 'female': engaging, pleasant, articulate, consultative tone.

Return ONLY a valid JSON object matching this structure:
{
  "company_name": "string",
  "detected_strengths": ["string", "string"],
  "pain_points": ["string", "string"],
  "value_proposition": "1 concise sentence value proposition",
  "opening_hook": "Conversational opening line under 25 words",
  "meeting_booking_pitch": "The key 2-sentence meeting booking proposition",
  "objection_responses": {
    "too_busy": "short polite rebuttal pivoting to a quick 5-min zoom",
    "send_email": "quick acknowledgment asking for best email + proposing time",
    "not_interested": "low friction curiosity question",
    "pricing": "value explanation framing meeting as free audit"
  },
  "recommended_call_strategy": "1-2 sentences on how to navigate the call"
}
No markdown formatting, no commentary. JSON only."""


CONVERSATION_SYSTEM_PROMPT = """You are an intelligent, empathetic, and human-sounding AI Voice Calling Agent on a live phone call with a business owner/decision maker.
Your primary objective is to book a quick 10-15 minute online meeting or consultation.

Guidelines:
1. Tone: Natural, conversational, helpful, non-robotic. Keep responses short and punchy (1 to 2 sentences max) so it sounds like real human phone speech.
2. Language: Match the requested language ({language}). If 'roman_urdu', reply in conversational Pakistani Roman Urdu. If 'english', reply in crisp conversational English.
3. Handle Objections: If the prospect is hesitant, acknowledge smoothly and propose a low-friction meeting time (e.g., "Tomorrow at 3 PM or Friday morning?").
4. Meeting Intent: If the prospect agrees to talk, gives a time, or says yes to a meeting, enthusiastically confirm the date/time and mark meeting intent.

Return ONLY a valid JSON object:
{
  "agent_reply": "spoken reply text (1-2 sentences)",
  "sentiment": "Positive | Neutral | Negative",
  "is_meeting_agreed": true | false,
  "meeting_intent": {
    "agreed": true | false,
    "suggested_time": "string or null",
    "notes": "string or null"
  }
}
No markdown, JSON only."""


class VoiceAgentService:
    def __init__(self, db: Optional[AsyncSession] = None):
        self.db = db

    def _call_ai_json(self, system_prompt: str, user_content: str, temperature: float = 0.4) -> dict:
        """Call Gemini / OpenAI in JSON mode with fallback."""
        # 1. Try Gemini
        if settings.gemini_api_key:
            try:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{settings.gemini_model}:generateContent?key={settings.gemini_api_key}"
                combined = f"{system_prompt}\n\nData:\n{user_content}"
                payload = {
                    "contents": [{"parts": [{"text": combined}]}],
                    "generationConfig": {
                        "temperature": temperature,
                        "responseMimeType": "application/json",
                    },
                }
                with httpx.Client(timeout=30.0) as client:
                    resp = client.post(url, json=payload)
                    if resp.status_code == 200:
                        data = resp.json()
                        candidates = data.get("candidates", [])
                        if candidates:
                            raw = candidates[0]["content"]["parts"][0]["text"]
                            return json.loads(raw)
            except Exception as e:
                logger.warning(f"Voice Agent Gemini call failed: {e}")

        # 2. Try OpenAI
        if settings.openai_api_key and settings.enable_openai:
            try:
                from openai import OpenAI
                client = OpenAI(api_key=settings.openai_api_key)
                response = client.chat.completions.create(
                    model=settings.openai_model,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_content},
                    ],
                    temperature=temperature,
                    response_format={"type": "json_object"},
                )
                raw = response.choices[0].message.content or "{}"
                return json.loads(raw)
            except Exception as e:
                logger.warning(f"Voice Agent OpenAI call failed: {e}")

        raise Exception("No AI provider succeeded")

    def parse_leads_sheet(self, file_content: bytes, filename: str) -> SheetAnalysisResponse:
        """Parse CSV or Excel file and extract structured leads list."""
        rows: List[Dict[str, Any]] = []
        lower_name = filename.lower()

        try:
            if lower_name.endswith(".csv"):
                import csv
                text_stream = io.StringIO(file_content.decode("utf-8", errors="ignore"))
                reader = csv.DictReader(text_stream)
                for r in reader:
                    rows.append({k.strip().lower(): v.strip() for k, v in r.items() if k})
            elif lower_name.endswith((".xlsx", ".xls")):
                import openpyxl
                wb = openpyxl.load_workbook(io.BytesIO(file_content), data_only=True)
                sheet = wb.active
                headers = [str(cell.value or "").strip().lower() for cell in next(sheet.iter_rows(values_only=True))]
                for row_values in sheet.iter_rows(min_row=2, values_only=True):
                    row_dict = {}
                    for h, val in zip(headers, row_values):
                        if h:
                            row_dict[h] = str(val).strip() if val is not None else ""
                    if any(row_dict.values()):
                        rows.append(row_dict)
        except Exception as e:
            logger.error(f"Error parsing leads sheet: {e}")
            raise ValueError(f"Could not parse file {filename}: {str(e)}")

        leads: List[LeadItem] = []
        for idx, r in enumerate(rows[:500]):  # cap at 500 leads for efficiency
            biz_name = (
                r.get("business_name")
                or r.get("company_name")
                or r.get("company")
                or r.get("title")
                or r.get("name")
                or r.get("store_name")
                or f"Lead #{idx + 1}"
            )
            phone = (
                r.get("phone")
                or r.get("phone_number")
                or r.get("mobile")
                or r.get("contact_number")
                or r.get("tel")
                or r.get("telephone")
                or ""
            )
            contact = r.get("contact_name") or r.get("owner") or r.get("person") or r.get("first_name") or ""
            website = r.get("website") or r.get("url") or r.get("web") or r.get("domain") or ""
            category = r.get("category") or r.get("industry") or r.get("type") or r.get("niche") or "Business"
            location = r.get("location") or r.get("city") or r.get("address") or r.get("country") or ""
            
            # Score determination
            has_phone = bool(phone and phone.strip())
            has_website = bool(website and website.strip())
            
            lead_score = "High" if (has_phone and not has_website) else ("High" if has_phone else "Medium")
            rec_angle = (
                "Call to offer Website Creation & High-converting Google Presence"
                if not has_website
                else "Call to offer AI Automation, Website Speed & SEO Optimization"
            )

            leads.append(
                LeadItem(
                    id=str(uuid.uuid4()),
                    business_name=biz_name,
                    phone_number=phone if has_phone else None,
                    contact_name=contact if contact else None,
                    website=website if has_website else None,
                    category=category,
                    location=location if location else None,
                    lead_score=lead_score,
                    recommended_angle=rec_angle,
                )
            )

        total_leads = len(leads)
        leads_with_phone = sum(1 for l in leads if l.phone_number)
        leads_with_website = sum(1 for l in leads if l.website)
        
        categories = {}
        for l in leads:
            c = l.category or "Other"
            categories[c] = categories.get(c, 0) + 1
        top_categories = sorted(categories.keys(), key=lambda x: categories[x], reverse=True)[:5]

        # Smart pick for first suggested lead
        suggested_lead = next((l for l in leads if l.phone_number and l.lead_score == "High"), None)
        if not suggested_lead and leads:
            suggested_lead = leads[0]

        summary_text = (
            f"Successfully parsed {total_leads} leads ({leads_with_phone} with direct phone numbers). "
            f"Key industries detected: {', '.join(top_categories) if top_categories else 'General Businesses'}. "
            f"AI recommends starting with high-scoring prospects lacking a modern website for maximum conversion."
        )

        return SheetAnalysisResponse(
            total_leads=total_leads,
            leads_with_phone=leads_with_phone,
            leads_with_website=leads_with_website,
            top_categories=top_categories,
            ai_recommendation_summary=summary_text,
            suggested_first_lead=suggested_lead,
            leads=leads,
        )

    def analyze_target_business(
        self,
        business_data: Dict[str, Any],
        voice_gender: str = "female",
        language: str = "roman_urdu",
        call_objective: str = "book_meeting",
    ) -> BusinessDeepAnalysis:
        """Deep analysis of target business + calling pitch generation."""
        biz_name = business_data.get("business_name") or "Business"
        category = business_data.get("category") or "Local Business"
        website = business_data.get("website") or ""
        location = business_data.get("location") or ""
        phone = business_data.get("phone_number") or ""

        user_content = f"""
Target Business Name: {biz_name}
Industry/Category: {category}
Website: {website if website else 'No website found'}
Location: {location}
Phone: {phone}
Selected Voice Gender: {voice_gender}
Selected Language: {language}
Call Objective: {call_objective}
"""

        try:
            res = self._call_ai_json(VOICE_ANALYSIS_SYSTEM_PROMPT, user_content, temperature=0.5)
            return BusinessDeepAnalysis(
                company_name=res.get("company_name", biz_name),
                detected_strengths=res.get("detected_strengths", ["Established local reputation", "Active customer base"]),
                pain_points=res.get("pain_points", ["Missing automated online lead capture", "Competitors ranking higher online"]),
                value_proposition=res.get("value_proposition", f"Help {biz_name} generate 2x more qualified inquiries with modern web & automated booking."),
                opening_hook=res.get("opening_hook", f"Hi, I noticed {biz_name}'s great work in {location or category} and had a quick question regarding your customer inquiries."),
                meeting_booking_pitch=res.get("meeting_booking_pitch", f"We built a tailored growth strategy for {biz_name}. Would you have 10 minutes this Thursday to walk through it?"),
                objection_responses=res.get("objection_responses", {
                    "too_busy": "I completely understand! That's exactly why I wanted to schedule just 5 minutes at your convenience.",
                    "send_email": "Sure thing! What is your best direct email address, and would 3 PM tomorrow suit you for a quick check-in?",
                    "not_interested": "Fair enough! Out of curiosity, are you currently accepting new clients this month?",
                    "pricing": "Our discovery call is 100% free with actionable insights you can implement immediately."
                }),
                recommended_call_strategy=res.get("recommended_call_strategy", "Build fast rapport, emphasize revenue upside, and secure a firm meeting calendar slot."),
            )
        except Exception as e:
            logger.error(f"Fallback deep analysis: {e}")
            return self._fallback_deep_analysis(business_data, voice_gender, language)

    def _fallback_deep_analysis(self, data: Dict[str, Any], voice_gender: str, language: str) -> BusinessDeepAnalysis:
        name = data.get("business_name") or "Business"
        category = data.get("category") or "Services"
        has_web = bool(data.get("website"))
        
        if language in ("roman_urdu", "urdu"):
            if not has_web:
                hook = f"Assalam o Alaikum! Maine aapka business '{name}' dekha. Kaam bohat zabardast hai, bas digital presence se related aik important baat karni thi."
                pitch = f"Hum aapke business ke liye fast website aur automated booking setup kar rahe hain jis se direct customer calls barhein. Kya kal 3 baje 10 minute ki quick meeting possible hai?"
            else:
                hook = f"Assalam o Alaikum! Maine '{name}' ki website check ki. Aapka setup acha hai, aur customer conversion 2x karne ke hawale se aik suggestion thi."
                pitch = f"Humne aapke competitors aur local market ko analyze kiya hai. Kya is hafte Wednesday ya Thursday ko 10 minute zoom call par brief discuss kar sakte hain?"
            
            objections = {
                "too_busy": "Bilkul samajh sakta hoon aap busy hain, is liye bas 5 se 10 minute mang raha hoon jab aap free hon.",
                "send_email": "Zaroor, aap apna email bata dein main details bhej deta hoon, sath hi kal ek brief call schedule kar lete hain.",
                "not_interested": "Koi masla nahi! Sirf yeh pochna tha ke kya aap mazeed naye clients target kar rahe hain?",
                "pricing": "Pehli consultation aur audit bilkul free hai, aapko pasand aye tab hi agay baat karenge."
            }
        else:
            if not has_web:
                hook = f"Hi! I was checking out {name} in your area and noticed your strong local presence."
                pitch = f"We help businesses in {category} generate 2x more direct bookings with high-converting online funnels. Would you be open to a 10-minute discovery call this Thursday?"
            else:
                hook = f"Hi! I came across {name}'s website and was really impressed with your offerings."
                pitch = f"We have identified 3 quick growth tweaks for your website that can boost your monthly client conversion. Could we do a quick 10-minute walkthrough this week?"

            objections = {
                "too_busy": "I totally understand you're busy! That's why I only need 10 quick minutes when you have downtime.",
                "send_email": "Absolutely! What's your direct email? I'll send the brief overview and we can connect briefly tomorrow.",
                "not_interested": "Understood! Out of curiosity, are you fully booked with clients right now or looking to grow?",
                "pricing": "The strategy session is completely free with no obligations whatsoever."
            }

        return BusinessDeepAnalysis(
            company_name=name,
            detected_strengths=["Strong regional market presence", "Proven customer interest"],
            pain_points=["Missed online capture potential", "Manual booking friction"],
            value_proposition=f"Boost customer acquisition and automated meeting scheduling for {name}.",
            opening_hook=hook,
            meeting_booking_pitch=pitch,
            objection_responses=objections,
            recommended_call_strategy="Engage warmly, introduce the tailored opportunity, and lock in a 10-minute calendar invite.",
        )

    def process_dialogue_turn(
        self,
        session: VoiceCallSession,
        prospect_speech: str,
        turn_number: int,
    ) -> Dict[str, Any]:
        """Process real-time speech dialogue turn from prospect and generate intelligent response."""
        transcript_history = session.transcript or []
        history_text = "\n".join([f"{t.get('speaker', 'user')}: {t.get('text', '')}" for t in transcript_history[-6:]])

        biz_name = session.business_name
        analysis = session.business_analysis or {}
        pitch = session.pitch_strategy or {}
        language = session.language
        voice_gender = session.voice_gender

        system_prompt = CONVERSATION_SYSTEM_PROMPT.format(language=language)
        user_content = f"""
Business Name: {biz_name}
Analysis: {json.dumps(analysis)}
Pitch Strategy: {json.dumps(pitch)}
Voice Gender: {voice_gender}
Language: {language}

Conversation History so far:
{history_text}

Prospect just said: "{prospect_speech}"

Provide the next conversational response to advance toward booking the meeting.
"""

        try:
            ai_res = self._call_ai_json(system_prompt, user_content, temperature=0.6)
            reply = ai_res.get("agent_reply", "")
            sentiment = ai_res.get("sentiment", "Neutral")
            is_meeting_agreed = bool(ai_res.get("is_meeting_agreed", False))
            meeting_intent = ai_res.get("meeting_intent", {})

            # Regex check as additional heuristic for meeting agreement
            lower_speech = prospect_speech.lower()
            if any(w in lower_speech for w in ["sure", "yes", "okay", "theek hai", "zaroor", "kal", "tomorrow", "send invite", "interested", "3 pm", "2 pm", "zoom"]):
                is_meeting_agreed = True

            return {
                "agent_reply": reply,
                "sentiment": sentiment,
                "is_meeting_agreed": is_meeting_agreed,
                "meeting_intent": meeting_intent,
            }
        except Exception as e:
            logger.error(f"Fallback dialogue turn error: {e}")
            return self._fallback_dialogue_turn(prospect_speech, language)

    def _fallback_dialogue_turn(self, speech: str, language: str) -> Dict[str, Any]:
        lower = speech.lower()
        is_agreed = any(w in lower for w in ["yes", "sure", "okay", "theek hai", "zaroor", "interested", "tomorrow", "kal", "book"])
        
        if language in ("roman_urdu", "urdu"):
            if is_agreed:
                reply = "Bohat khoob! Main aapko meeting details aur calendar invite share kar deta hoon. Baat karke bohat acha laga!"
            elif "busy" in lower or "masroof" in lower:
                reply = "Ji bilkul samajh sakta hoon. Kya hum kal shaam 4 baje sirf 5 minute ke liye connect karein?"
            elif "email" in lower:
                reply = "Zaroor, aap apna email note karwa dein, main complete proposal bhej deta hoon aur kal follow-up kar lunga."
            else:
                reply = "Ji theek hai! Hamari taraf se aapke business ke liye complete strategy ready hai, kya is Thursday ko 10 minute mil sakte hain?"
        else:
            if is_agreed:
                reply = "Fantastic! I'll lock that in on our calendar and send over the invite right away. Looking forward to our chat!"
            elif "busy" in lower:
                reply = "Totally understand your busy schedule! Would tomorrow at 3 PM or Friday morning work better for a quick 5-minute call?"
            elif "email" in lower:
                reply = "Sure thing! What is the best email to reach you, and I will send the summary right over."
            else:
                reply = "That makes total sense. We have put together some great ideas for your growth, could we do a quick 10-minute sync this week?"

        return {
            "agent_reply": reply,
            "sentiment": "Positive" if is_agreed else "Neutral",
            "is_meeting_agreed": is_agreed,
            "meeting_intent": {"agreed": is_agreed, "notes": "Handled via smart speech response"},
        }
