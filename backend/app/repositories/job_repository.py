import uuid
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.extracted_data import ExtractedData
from app.models.job import Job
from app.models.map_lead import MapLead


class JobRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, job_id: uuid.UUID, user_id: uuid.UUID | None = None) -> Job | None:
        q = select(Job).where(Job.id == job_id)
        if user_id:
            q = q.where(Job.user_id == user_id)
        result = await self.db.execute(q)
        return result.scalar_one_or_none()

    async def list_by_user(self, user_id: uuid.UUID, limit: int = 50) -> list[Job]:
        result = await self.db.execute(
            select(Job).where(Job.user_id == user_id).order_by(Job.created_at.desc()).limit(limit)
        )
        return list(result.scalars().all())

    async def create(
        self,
        user_id: uuid.UUID,
        job_type: str,
        mode: str = "website",
        url: str | None = None,
        query: str | None = None,
        location: str | None = None,
        total_urls: int | None = None,
        platform: str | None = None,
        meta: dict | None = None,
    ) -> Job:
        job = Job(
            user_id=user_id,
            type=job_type,
            mode=mode,
            platform=platform,
            url=url,
            query=query,
            location=location,
            total_urls=total_urls,
            meta=meta,
            status="queued",
            progress=0,
        )
        self.db.add(job)
        await self.db.flush()
        await self.db.refresh(job)
        return job

    async def update_status(
        self,
        job: Job,
        status: str,
        progress: int | None = None,
        error_message: str | None = None,
        processed_urls: int | None = None,
    ) -> Job:
        job.status = status
        job.updated_at = datetime.now(timezone.utc)
        if progress is not None:
            job.progress = progress
        if error_message is not None:
            job.error_message = error_message
        if processed_urls is not None:
            job.processed_urls = processed_urls

        await self.db.flush()
        try:
            await self.db.refresh(job)
        except Exception:
            # If refresh fails (e.g. detached), we'll handle it in the caller
            pass
        return job

    async def get_dashboard_stats(self, user_id: uuid.UUID) -> dict:
        jobs_q = await self.db.execute(select(Job).where(Job.user_id == user_id))
        jobs = list(jobs_q.scalars().all())

        active = sum(1 for j in jobs if j.status not in ("completed", "failed"))
        completed = sum(1 for j in jobs if j.status == "completed")
        failed = sum(1 for j in jobs if j.status == "failed")
        total_websites = sum(j.processed_urls or (1 if j.type == "single" and j.status == "completed" else 0) for j in jobs)

        emails_q = await self.db.execute(
            select(func.count()).select_from(ExtractedData).join(Job).where(Job.user_id == user_id)
        )
        extracted_count = emails_q.scalar() or 0

        # Count total emails across extracted rows
        ext_rows = await self.db.execute(
            select(ExtractedData.emails).join(Job).where(Job.user_id == user_id)
        )
        total_emails = sum(len(row[0] or []) for row in ext_rows.all())

        # Maps specific stats
        no_website_q = await self.db.execute(
            select(func.count(MapLead.id)).join(Job).where(Job.user_id == user_id, MapLead.website == None)
        )
        no_website = no_website_q.scalar() or 0

        phones_q = await self.db.execute(
            select(func.count(MapLead.id)).join(Job).where(Job.user_id == user_id, MapLead.phone != None)
        )
        phones = phones_q.scalar() or 0

        high_leads_q = await self.db.execute(
            select(func.count(MapLead.id)).join(Job).where(Job.user_id == user_id, MapLead.lead_score == "High")
        )
        high_leads = high_leads_q.scalar() or 0

        return {
            "total_websites": total_websites,
            "active_jobs": active,
            "completed_jobs": completed,
            "failed_jobs": failed,
            "total_emails": total_emails,
            "no_website_businesses": no_website,
            "extracted_phones": phones,
            "high_quality_leads": high_leads,
            "ai_opportunities": high_leads, # Reusing for now
        }

    async def get_latest_extracted(self, job_id: uuid.UUID) -> ExtractedData | None:
        result = await self.db.execute(
            select(ExtractedData).where(ExtractedData.job_id == job_id).order_by(ExtractedData.created_at.desc()).limit(1)
        )
        return result.scalar_one_or_none()
