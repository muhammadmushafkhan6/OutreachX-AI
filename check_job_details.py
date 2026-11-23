
import asyncio
from sqlalchemy import select
from app.database import AsyncSessionLocal
from app.models.job import Job
from app.models.map_lead import MapLead
from app.models.social_media_lead import SocialMediaLead
from app.models.linkedin_company import LinkedInCompany
from app.models.linkedin_employee import LinkedInEmployee


async def check_job(job_id_str):
    async with AsyncSessionLocal() as db:
        job_id = job_id_str
        # Get job
        result = await db.execute(select(Job).where(Job.id == job_id))
        job = result.scalar_one_or_none()
        if job:
            print(f"Job found: {job.id}")
            print(f"  Mode: {job.mode}")
            print(f"  Status: {job.status}")
            print(f"  Query: {job.query}")
            
            # Check leads based on mode
            if job.mode == "maps":
                leads_result = await db.execute(select(MapLead).where(MapLead.job_id == job.id))
                leads = leads_result.scalars().all()
                print(f"  Map leads: {len(leads)}")
            elif job.mode == "social":
                leads_result = await db.execute(select(SocialMediaLead).where(SocialMediaLead.job_id == job.id))
                leads = leads_result.scalars().all()
                print(f"  Social leads: {len(leads)}")
            elif job.mode == "linkedin-company":
                leads_result = await db.execute(select(LinkedInCompany).where(LinkedInCompany.job_id == job.id))
                leads = leads_result.scalars().all()
                print(f"  LinkedIn company leads: {len(leads)}")
            elif job.mode == "linkedin-employee":
                leads_result = await db.execute(select(LinkedInEmployee).where(LinkedInEmployee.job_id == job.id))
                leads = leads_result.scalars().all()
                print(f"  LinkedIn employee leads: {len(leads)}")
        else:
            print("Job not found")


if __name__ == "__main__":
    import sys
    job_id = sys.argv[1] if len(sys.argv) > 1 else "10e156bf-4381-47b3-9fe6-532834771988"
    asyncio.run(check_job(job_id))
