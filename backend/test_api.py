
import asyncio
import httpx

async def test_api():
    async with httpx.AsyncClient(base_url="http://localhost:8000") as client:
        # First get a token (we need to login, but let's check jobs first maybe? Wait let's use the DB directly to check what's in job 41c300d0-ca12-4465-82c1-ec170d197acb)
        from sqlalchemy import select
        from app.database import AsyncSessionLocal
        from app.models.job import Job
        from app.models.map_lead import MapLead
        
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(Job).where(Job.id == "41c300d0-ca12-4465-82c1-ec170d197acb"))
            job = result.scalar_one_or_none()
            print("Job details:", job.id, job.mode, job.status)
            
            result_leads = await db.execute(select(MapLead).where(MapLead.job_id == job.id))
            leads = result_leads.scalars().all()
            print("Leads count:", len(leads))
            for lead in leads[:2]:
                print("Lead:", lead.business_name, lead.phone)

if __name__ == "__main__":
    asyncio.run(test_api())
