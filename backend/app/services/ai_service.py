import json
import logging
import re
import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

SYSTEM_PROMPT = """You are a business intelligence analyst. Analyze the website content and return ONLY valid JSON with these fields:
{
  "company_name": "string",
  "industry": "string",
  "business_type": "string (e.g. Agency, SaaS, E-commerce)",
  "niche": "string",
  "summary": "2-3 sentence business summary",
  "lead_score": "Low | Medium | High",
  "target_audience": "string",
  "services": ["list of detected services"]
}
No markdown, no explanation — JSON only."""

MAPS_SYSTEM_PROMPT = """You are a business intelligence analyst. Analyze the Google Maps business data and return ONLY valid JSON with these fields:
{
  "business_name": "string",
  "lead_score": "Low | Medium | High",
  "website_exists": boolean,
  "recommended_service": "string (e.g. Website Development, SEO, Google Maps Optimization)",
  "summary": "2-3 sentence business summary focusing on marketing opportunities"
}
No markdown, no explanation — JSON only."""

OUTREACH_SYSTEM_PROMPT = """You are an expert cold outreach copywriter who writes high-converting, friendly, and natural messages for local businesses.

Generate a personalized cold outreach message for WhatsApp.

Rules:
1. Language logic:
   - If the business is in Pakistan (e.g. +92 phone number), write in **Roman Urdu** (conversational, polite, respectful tone).
   - If the business is in any other country, write in **English** (friendly, professional, concise tone).

2. Context logic:
   - If the business has NO website: Focus on how creating a modern, fast website will help them get more customers, build trust, and grow their brand online.
   - If the business HAS a website: Focus on optimizing their website for speed, SEO, or modern redesign to increase customer conversion.

3. Structure:
   - Hook: Mention their specific business name and appreciate their work.
   - Problem/Opportunity: Gently point out the missing website or optimization potential.
   - Value Proposition: State how you can help (affordable, fast, high quality).
   - Low-friction Call to Action (CTA): e.g. "Kya hum is baare mein thodi baat kar sakte hain?" or "Would you be open to a quick 5-minute chat?"

4. Output format: Return ONLY the final message text. No greetings like 'Here is your message:', no quotes, no extra formatting."""

INSTAGRAM_DM_SYSTEM_PROMPT = """You are an expert social media outreach specialist who writes personalized, casual, and high-converting Instagram DMs for businesses and creators.

Generate an Instagram DM based on the provided profile details.

Rules:
1. Tone: Casual, friendly, genuine, non-salesy (sounds like a real person, not a bot).
2. Structure:
   - Genuine compliment about their content/niche
   - Observation about their digital presence (website, branding, or lead capture)
   - Value proposition (how you can help them grow/monetize)
   - Low-friction CTA ("Open to sharing a few ideas?", "Mind if I send a quick tip?")
3. Length: 2-3 short paragraphs max (easy to read on mobile).
4. Output: Return ONLY the DM message text."""

EMAIL_OUTREACH_SYSTEM_PROMPT = """You are an expert cold email copywriter. Generate a personalized B2B cold email outreach template.

Return a JSON object with exactly two fields:
{
  "subject": "Compelling, curiosity-driven subject line (under 60 chars)",
  "html_body": "HTML formatted email body with <p>, <strong>, <br> tags"
}

Guidelines:
- Subject line: Casual, lower-case or sentence case preferred, no spam triggers (avoid FREE, BUY, URGENT, 100%).
- Email body structure:
  * Personalized opening referencing the business
  * Clear observation of their current online presence
  * Your offer: Briefly explain how you can help (website, digital marketing, SEO, etc.)
  * Social proof/credibility: One line about results or experience (optional, keep it subtle)
  * Call to action: Invite a short call/reply with "Would you be open to a quick 10-minute chat this week?"
  * Sign-off: Professional closing with your name (use "Best regards" / "Warm regards")
- Length: 100-200 words total. Concise, not a wall of text.
- No emojis in subject line. Minimal in body.
- Use placeholders like {{business_name}}, {{category}}, {{location}}."""


class AIService:
    def _call_ai_json(self, system_prompt: str, user_content: str, temperature: float = 0.3) -> dict:
        """Call Gemini (Primary) or OpenAI (Fallback) in JSON mode."""
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
                with httpx.Client(timeout=25.0) as client:
                    resp = client.post(url, json=payload)
                    if resp.status_code == 200:
                        data = resp.json()
                        candidates = data.get("candidates", [])
                        if candidates:
                            raw = candidates[0]["content"]["parts"][0]["text"]
                            return json.loads(raw)
                    else:
                        logger.warning(f"Gemini API returned status {resp.status_code}: {resp.text}")
            except Exception as gemini_err:
                logger.warning(f"Gemini JSON generation error: {gemini_err}")

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
            except Exception as openai_err:
                logger.warning(f"OpenAI JSON generation error: {openai_err}")

        raise Exception("No AI provider succeeded")

    def _call_ai_text(self, system_prompt: str, user_content: str, temperature: float = 0.7) -> str:
        """Call Gemini (Primary) or OpenAI (Fallback) in Text mode."""
        # 1. Try Gemini
        if settings.gemini_api_key:
            try:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{settings.gemini_model}:generateContent?key={settings.gemini_api_key}"
                combined = f"{system_prompt}\n\nData:\n{user_content}"
                payload = {
                    "contents": [{"parts": [{"text": combined}]}],
                    "generationConfig": {
                        "temperature": temperature,
                    },
                }
                with httpx.Client(timeout=25.0) as client:
                    resp = client.post(url, json=payload)
                    if resp.status_code == 200:
                        data = resp.json()
                        candidates = data.get("candidates", [])
                        if candidates:
                            text = candidates[0]["content"]["parts"][0]["text"]
                            return text.strip()
                    else:
                        logger.warning(f"Gemini API returned status {resp.status_code}: {resp.text}")
            except Exception as gemini_err:
                logger.warning(f"Gemini Text generation error: {gemini_err}")

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
                )
                return (response.choices[0].message.content or "").strip()
            except Exception as openai_err:
                logger.warning(f"OpenAI Text generation error: {openai_err}")

        raise Exception("No AI provider succeeded")

    def analyze(self, business_text: str, extracted: dict) -> dict:
        """Analyze scraped website content using Gemini/OpenAI."""
        user_content = f"""Website data:
Company: {extracted.get('company_name')}
Title: {extracted.get('title')}
Services found: {extracted.get('services')}
Emails: {extracted.get('emails')}

Content excerpt:
{business_text[:4000]}
"""
        try:
            return self._call_ai_json(SYSTEM_PROMPT, user_content, temperature=0.3)
        except Exception as e:
            logger.error("AI Website analysis fallback: %s", e)
            return self._fallback_analysis(extracted)

    def analyze_map_lead(self, lead_data: dict) -> dict:
        """Fast, intelligent lead scoring and opportunity generation (0ms latency)."""
        name = lead_data.get("business_name") or "Business"
        category = lead_data.get("category") or "Local Business"
        website = lead_data.get("website")
        has_website = bool(website and str(website).strip() != "")
        rating = lead_data.get("rating") or 0.0
        reviews = lead_data.get("reviews") or 0
        has_email = bool(lead_data.get("email") or (lead_data.get("emails") and len(lead_data.get("emails")) > 0))

        if not has_website:
            lead_score = "High"
            rec_service = "Complete Website Build + Local SEO + Google Profile Optimization"
            summary = f"Prime Prospect: {name} has {reviews} reviews on Google Maps with a {rating}★ rating but NO website. High conversion potential for web design and lead funnels."
        elif not has_email:
            lead_score = "High" if reviews > 20 else "Medium"
            rec_service = "Website Speed Optimization + Lead Capture Funnels"
            summary = f"{name} operates in {category}. Website is active ({website}). Opportunity for conversion optimization and automated customer booking."
        else:
            lead_score = "High" if rating >= 4.0 and reviews >= 10 else "Medium"
            rec_service = "AI Automation + Modern Rebranding & Outreach"
            summary = f"Verified established {category}: {name} with direct email and active digital footprint. Ideal candidate for growth automation."

        return {
            "business_name": name,
            "lead_score": lead_score,
            "website_exists": has_website,
            "recommended_service": rec_service,
            "summary": summary,
        }

    @staticmethod
    def _is_pakistan_phone(phone: str | None) -> bool:
        if not phone:
            return False
        clean_phone = re.sub(r"\D", "", str(phone))
        return clean_phone.startswith("92") or (
            len(clean_phone) == 11 and clean_phone.startswith("03")
        )

    def generate_outreach_message(self, business_data: dict, phone: str) -> str:
        """Generate personalized WhatsApp message using Gemini/OpenAI."""
        is_pakistan = self._is_pakistan_phone(phone)
        biz_name = business_data.get('business_name') or 'your business'
        category = (business_data.get('category') or 'business').lower()
        user_content = f"Business Name: {biz_name}\nCategory: {category}\nIs Pakistan: {is_pakistan}"

        try:
            return self._call_ai_text(
                OUTREACH_SYSTEM_PROMPT.replace("{business_name}", biz_name),
                user_content,
                temperature=0.8,
            )
        except Exception as e:
            logger.error("AI outreach generation fallback: %s", e)
            return self._fallback_outreach_message(business_data, is_pakistan)

    def _fallback_outreach_message(self, data: dict, is_pakistan: bool) -> str:
        name = data.get('business_name') or 'your business'
        category = (data.get('category') or 'business').lower()
        
        if is_pakistan:
            if "school" in category or "academy" in category or "education" in category:
                return f"Assalam o Alaikum! Maine aapka school '{name}' online dekha. Kaam toh aapka bohat acha hai, par aapki koi professional website nahi mili. Aaj kal parents sabse pehle online check karte hain. Agar ek achi website ban jaye toh parents ka trust bhi barhega aur admission mein bhi asani hogi. Kya hum is baare mein baat kar sakte hain?"
            
            return f"Assalam o Alaikum! Maine aapka business '{name}' Google Maps par dekha. Kaam aapka acha hai par website na hone ki wajah se online reach kam hai. Aaj kal log online search karte hain aur website se trust barhta hai. Main aapke liye ek fast aur sasti website bana sakta hoon. Agar aap interested hain toh bataye ga. Shukriya!"
        
        return f"Hi! I came across {name} online and noticed you don’t have a professional website yet. In today’s market, customers trust businesses more when they have a modern online presence. A website can help you attract more customers, increase trust, and grow your business 24/7. I create fast, modern, and mobile-friendly websites tailored for businesses like yours. If you’d like to take your business to the next level online, I’d be happy to help."

    def _fallback_analysis(self, extracted: dict) -> dict:
        return {
            "company_name": extracted.get("company_name") or "Business",
            "industry": "Unknown",
            "business_type": "Unknown",
            "niche": "Unknown",
            "summary": "Automated extraction summary.",
            "lead_score": "Medium",
            "target_audience": "General",
            "services": extracted.get("services") or [],
        }

    def generate_instagram_dm(self, instagram_data: dict) -> str:
        """Generate personalized Instagram DM using Gemini/OpenAI."""
        username = instagram_data.get('username') or 'there'
        full_name = instagram_data.get('full_name') or username
        bio = instagram_data.get('bio') or ''
        followers = instagram_data.get('followers_count') or 0
        website = instagram_data.get('website')
        
        user_content = f"""
Username: {username}
Full Name: {full_name}
Bio: {bio}
Followers: {followers}
Has Website: {'Yes' if website else 'No'}
"""
        try:
            return self._call_ai_text(INSTAGRAM_DM_SYSTEM_PROMPT, user_content, temperature=0.9)
        except Exception as e:
            logger.error("AI Instagram DM generation fallback: %s", e)
            return self._fallback_instagram_dm(instagram_data)

    def _fallback_instagram_dm(self, data: dict) -> str:
        username = data.get('username') or 'there'
        full_name = data.get('full_name') or username
        has_website = bool(data.get('website'))
        
        if has_website:
            return f"Hey {full_name}! Loved going through your profile – your content is great! I noticed you already have a website. I was wondering if you've ever thought about optimizing it to get more clients or customers? I help businesses like yours with their digital presence, and I'd love to share some ideas if you're open to it!"
        else:
            return f"Hey {full_name}! Your Instagram profile looks amazing – great content! I couldn't help but notice you don't have a website linked. Having a professional website really helps businesses grow and get more clients. Would you be open to chatting about how I could help you set one up? No pressure at all!"

    def generate_email_template(self, email_data: dict) -> dict:
        """Generate personalized email outreach template using Gemini/OpenAI."""
        biz_name = email_data.get('business_name') or '{{business_name}}'
        category = email_data.get('category') or '{{category}}'
        location = email_data.get('location') or '{{location}}'
        recipient = email_data.get('recipient_name')
        website = email_data.get('website')
        tone = email_data.get('tone') or 'professional'
        purpose = email_data.get('purpose') or 'introduction'
        services = email_data.get('services_offered') or 'professional website design & digital marketing services'

        user_content = f"""
Business: {biz_name}
Category: {category}
Location: {location}
Website: {website or 'None found'}
Recipient Name: {recipient or 'Not provided - use Hi there'}
Tone: {tone}
Purpose: {purpose}
Services I offer: {services}

IMPORTANT: Use {{business_name}}, {{category}}, {{location}} as placeholders in the email.
"""
        try:
            result = self._call_ai_json(EMAIL_OUTREACH_SYSTEM_PROMPT, user_content, temperature=0.7)
            if not result.get("subject") or not result.get("html_body"):
                return self._fallback_email_template(email_data)
            if "text_body" not in result:
                from html import unescape
                text = re.sub(r"<[^>]+>", "", result["html_body"])
                result["text_body"] = unescape(text)
            return result
        except Exception as e:
            logger.error("AI email template generation fallback: %s", e)
            return self._fallback_email_template(email_data)

    def _fallback_email_template(self, data: dict) -> dict:
        biz_name = "{{business_name}}"
        category = "{{category}}"
        location = "{{location}}"
        recipient = data.get("recipient_name")
        greeting = f"Hi {recipient}," if recipient else "Hi there,"
        has_website = bool(data.get("website"))

        subject = f"Quick idea for {biz_name}"

        if has_website:
            html_body = f"""
<p>{greeting}</p>
<p>I came across <strong>{biz_name}</strong> in the {category} space in {location} and was genuinely impressed with what you're building. Your business has solid foundations, and I noticed you already have a website up.</p>
<p>I was reaching out because I help businesses like yours optimize their digital presence to get more consistent leads and customers. Whether it's improving your current website's performance, adding SEO to rank higher on Google, or building a proper sales funnel — these small changes often translate into real revenue growth.</p>
<p>Would you be open to a quick 10-minute chat this week? No hard sell, just a quick call where I can share 2-3 actionable ideas specific to {biz_name}. Completely free.</p>
<p>Let me know what works for you — or simply reply with "interested" and I'll send over a few time slots.</p>
<p>Best regards<br>
Outreach Team</p>
""".strip()
        else:
            html_body = f"""
<p>{greeting}</p>
<p>I recently came across <strong>{biz_name}</strong> in the {category} industry in {location}. You're doing great work locally, and that's exactly why I'm reaching out.</p>
<p>I noticed {biz_name} doesn't have a professional website yet — which means you're missing out on customers who search online for {category} services in {location}. Today, 90% of customers research a business online before contacting them. A strong website builds trust instantly.</p>
<p>I build fast, mobile-friendly, and affordable websites that help local businesses get more calls and walk-in customers. The investment usually pays for itself within the first few new clients.</p>
<p>Would you be open to a quick 10-minute chat this week? I can show you examples and share 2-3 ideas specific to {biz_name}. No pressure, just value.</p>
<p>Just reply with "interested" and I'll send over a few convenient time slots.</p>
<p>Warm regards<br>
Outreach Team</p>
""".strip()

        from html import unescape
        text_body = unescape(re.sub(r"<[^>]+>", "", html_body))
        text_body = re.sub(r"\n{3,}", "\n\n", text_body).strip()

        return {
            "subject": subject,
            "html_body": html_body,
            "text_body": text_body,
        }
