
import asyncio
import sys
from sqlalchemy import select
from app.database import AsyncSessionLocal
from app.models.job import Job
from app.models.map_lead import MapLead
from app.models.social_media_lead import SocialMediaLead
from app.models.linkedin_company import LinkedInCompany
from app.models.linkedin_employee import LinkedInEmployee


async def list_all_jobs():
    async with AsyncSessionLocal() as db:
        # Get all jobs
        result = await db.execute(select(Job).order_by(Job.created_at.desc()))
        jobs = result.scalars().all()
        print(f"Total jobs: {len(jobs)}")
        for job in jobs:
            print(f"\nJob ID: {job.id}")
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


if __name__ == "__main__":
    asyncio.run(list_all_jobs())
