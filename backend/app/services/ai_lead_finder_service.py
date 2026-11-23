import logging
import asyncio
import json
from typing import List, Dict, Any, Optional, Callable
from apify_client import ApifyClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.config import get_settings
from app.models import AILeadFinderJob, AILeadFinderLead
from app.services.ai_service import AIService

logger = logging.getLogger(__name__)
settings = get_settings()


def _get_val(obj, key):
    if isinstance(obj, dict): return obj.get(key)
    return getattr(obj, key, None)


def _dataset_id(run: Any) -> str | None:
    return _get_val(run, "defaultDatasetId") or _get_val(run, "default_dataset_id")


class AILeadFinderService:
    def __init__(self, db: AsyncSession, notify_callback: Optional[Callable[[str, int], Any]] = None):
        self.db = db
        self.notify_callback = notify_callback
        self.client = ApifyClient(settings.apify_api_token) if settings.apify_api_token else None
        self.ai_service = AIService()

    async def _notify(self, status: str, progress: int):
        if self.notify_callback:
            if asyncio.iscoroutinefunction(self.notify_callback):
                await self.notify_callback(status, progress)
            else:
                self.notify_callback(status, progress)

    async def start_job(
        self,
        user_id: str,
        filters: Dict[str, Any],
    ) -> AILeadFinderJob:
        job = AILeadFinderJob(
            user_id=user_id,
            status="queued",
            progress=0,
            filters=json.dumps(filters),
        )
        self.db.add(job)
        await self.db.commit()
        await self.db.refresh(job)
        return job

    async def run_job(self, job_id: str):
        job = await self.db.get(AILeadFinderJob, job_id)
        if not job:
            raise Exception("Job not found")

        if not self.client:
            raise Exception("Apify API token not configured")

        filters = json.loads(job.filters) if job.filters else {}

        try:
            await self._update_job(job, "processing", 10)

            # Prepare Apify input (using a sample Leads Finder actor - adjust as needed based on actual actor you use)
            # Example actor: apify/leads-finder or similar
            run_input: dict[str, Any] = {
                "searchQuery": filters.get("keywords", "business leads"),
                "countryCodes": [filters.get("country", "us")] if filters.get("country") else [],
                "industry": filters.get("industry"),
                "companySize": filters.get("company_size"),
                "maxResults": filters.get("number_of_leads", 20),
            }

            logger.info("Starting Apify Leads Finder job: %s", job_id)
            await self._update_job(job, "scraping", 25)

            loop = asyncio.get_running_loop()

            # Start the actor - replace with actual actor ID you want to use!
            # Example: apify/leads-finder or your specific actor
            run = await loop.run_in_executor(
                None,
                lambda: self.client.actor("apify/leads-finder").start(run_input=run_input),
            )
            run_id = _get_val(run, "id")
            job.apify_run_id = run_id
            await self.db.commit()

            # Poll for status
            waited = 0
            max_wait = 600  # 10 minutes
            while waited < max_wait:
                run = await loop.run_in_executor(
                    None,
                    lambda: self.client.run(run_id).get(),
                )
                status = _get_val(run, "status")

                if status == "SUCCEEDED":
                    break
                elif status in ["FAILED", "ABORTED", "TIMED-OUT"]:
                    raise Exception(f"Apify actor failed with status: {status}")

                waited += 10
                progress = 25 + min(45, int((waited / 300) * 45))
                await self._update_job(job, "scraping", progress)
                await asyncio.sleep(10)

            await self._update_job(job, "scraping", 70)

            # Get dataset items
            dataset_id = _dataset_id(run)
            if not dataset_id:
                raise Exception("No dataset ID returned from Apify")

            dataset_items = await loop.run_in_executor(
                None,
                lambda: self.client.dataset(dataset_id).list_items().items,
            )

            await self._update_job(job, "analyzing", 80)

            # Normalize and store leads
            leads_to_add = []
            for item in dataset_items:
                # Normalize the Apify output to our model fields - adjust based on actual actor output!
                lead = AILeadFinderLead(
                    job_id=job.id,
                    company_name=item.get("companyName"),
                    company_website=item.get("companyWebsite"),
                    industry=item.get("industry"),
                    company_size=item.get("companySize"),
                    revenue=item.get("revenue"),
                    funding=item.get("funding"),
                    contact_name=item.get("contactName"),
                    job_title=item.get("jobTitle"),
                    business_email=item.get("businessEmail"),
                    personal_email=item.get("personalEmail"),
                    phone_number=item.get("phoneNumber"),
                    linkedin_url=item.get("linkedinUrl"),
                    location=item.get("location"),
                    country=filters.get("country"),
                )
                leads_to_add.append(lead)

            self.db.add_all(leads_to_add)
            await self.db.commit()

            # Run AI analysis on leads
            await self._run_ai_analysis(job_id, leads_to_add)

            await self._update_job(job, "completed", 100)
            logger.info("AI Lead Finder job completed: %s", job_id)

        except Exception as e:
            logger.exception("AI Lead Finder job failed: %s", job_id)
            await self._update_job(job, "failed", 0, error_message=str(e))
            raise e

    async def _run_ai_analysis(self, job_id: str, leads: List[AILeadFinderLead]):
        for i, lead in enumerate(leads):
            progress = 80 + int((i / len(leads)) * 20)
            await self._notify("analyzing", progress)

            try:
                # Run AI analysis if website exists
                if lead.company_website:
                    # TODO: Actually scrape the website and analyze
                    # For now, we'll generate mock AI content
                    lead.ai_business_summary = f"{lead.company_name} is a company in the {lead.industry} industry."
                    lead.lead_score = 75
                    lead.ai_cold_email = f"Hi {lead.contact_name},\n\nI came across {lead.company_name} and was impressed by your work in {lead.industry}...\n\nBest regards"
                    lead.ai_whatsapp_message = f"Hi {lead.contact_name}! I noticed {lead.company_name} is doing great work in {lead.industry}. Wanted to connect..."
                    lead.ai_voice_script = f"Hello {lead.contact_name}, this is [Your Name] calling from [Your Company]. I noticed {lead.company_name}..."
                else:
                    lead.ai_business_summary = f"{lead.company_name} appears to be a {lead.industry} company without a website."
                    lead.lead_score = 85
            except Exception as e:
                logger.warning("Failed to run AI analysis for lead %s: %s", lead.id, e)
                lead.lead_score = 50

        await self.db.commit()

    async def _update_job(self, job: AILeadFinderJob, status: str, progress: int, error_message: str = None):
        job.status = status
        job.progress = progress
        if error_message:
            job.error_message = error_message
        await self.db.commit()
        await self._notify(status, progress)

    async def get_job_leads(
        self,
        job_id: str,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[List[AILeadFinderLead], int]:
        offset = (page - 1) * page_size
        stmt_count = select(func.count()).select_from(AILeadFinderLead).where(AILeadFinderLead.job_id == job_id)
        result_count = await self.db.execute(stmt_count)
        total = result_count.scalar()

        stmt = select(AILeadFinderLead).where(AILeadFinderLead.job_id == job_id).offset(offset).limit(page_size)
        result = await self.db.execute(stmt)
        leads = result.scalars().all()

        return leads, total
