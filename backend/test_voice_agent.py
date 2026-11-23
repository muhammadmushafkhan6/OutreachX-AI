import asyncio
from app.services.voice_agent_service import VoiceAgentService

async def main():
    service = VoiceAgentService()
    
    # 1. Test CSV Parsing
    csv_data = """business_name,phone,category,website,location
Al-Madina Auto Works,+923001234567,Automotive Repair,,Lahore
Royal Dental Studio,+923217654321,Dentist,https://royaldental.pk,Islamabad
""".encode('utf-8')
    
    parsed = service.parse_leads_sheet(csv_data, "test_leads.csv")
    print(f"[OK] Parsed {parsed.total_leads} leads. With phone: {parsed.leads_with_phone}")
    print(f"[OK] Summary: {parsed.ai_recommendation_summary}")
    
    # 2. Test Deep Analysis
    analysis = service.analyze_target_business(
        business_data={
            "business_name": "Al-Madina Auto Works",
            "category": "Automotive Repair",
            "phone_number": "+923001234567",
            "location": "Lahore",
            "website": ""
        },
        voice_gender="female",
        language="roman_urdu",
        call_objective="book_meeting"
    )
    print(f"[OK] Opening Hook: {analysis.opening_hook}")
    print(f"[OK] Meeting Pitch: {analysis.meeting_booking_pitch}")
    
    # 3. Test Fallback Dialogue Turn
    turn = service._fallback_dialogue_turn("Kal shaam 4 baje theek hai zoom par baat kar lete hain", "roman_urdu")
    print(f"[OK] Dialogue Turn: {turn}")

if __name__ == "__main__":
    asyncio.run(main())
