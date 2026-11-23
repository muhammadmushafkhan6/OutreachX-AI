import logging
import re
import uuid
from typing import Any, Optional
from urllib.parse import urlparse

from sqlalchemy import select, or_, func, String
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.job import Job
from app.models.map_lead import MapLead
from app.models.user import User
from app.repositories.job_repository import JobRepository
from app.services.ai_service import AIService
from app.services.maps.apify_scraper import ApifyMapsScraper
from app.services.export_service import ExportService
from app.websocket.manager import ws_manager

logger = logging.getLogger(__name__)
settings = get_settings()

EMAIL_REGEX = re.compile(r"^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$")
SOURCE_EMAIL_PLACEHOLDERS = {"n/a", "none", "null", "undefined", "-", "none@none.com", "na", "none@example.com"}


def _is_valid_email(email: str | None) -> bool:
    if not email or not isinstance(email, str):
        return False
    clean = email.strip().lower()
    if not clean or clean in SOURCE_EMAIL_PLACEHOLDERS:
        return False
    return bool(EMAIL_REGEX.match(clean))


def _normalize_email(email: str) -> str:
    return email.strip().lower()


def _extract_domain(website: str | None) -> str | None:
    if not website or not isinstance(website, str):
        return None
    try:
        parsed = urlparse(website if "://" in website else f"http://{website}")
        domain = (parsed.netloc or parsed.path).lower()
        if domain.startswith("www."):
            domain = domain[4:]
        return domain or None
    except Exception:
        return None


class EmailOutreachService:
    """
    Orchestrates the Email Outreach flow:
      - scrapes Google Maps email leads via x_guru Apify actor,
      - cleans & validates emails,
      - deduplicates leads,
      - saves leads with source tracking,
      - runs lead scoring pipeline.
    """

    SOURCE = "google_maps_email_extractor"

    def __init__(self, db: AsyncSession):
        self.db = db
        self.job_repo = JobRepository(db)
        self.ai = AIService()
        self.export_svc = ExportService()

    async def _notify_job(self, job: Job, payload: dict[str, Any] | None = None):
        try:
            await self.db.flush_or_refresh(job)
            base = {
                "job_id": str(job.id),
                "status": job.status,
                "progress": job.progress,
                "error": job.error_message,
            }
            if payload:
                base.update(payload)
            await ws_manager.broadcast_job(job.id, base)
        except Exception as e:
            logger.error(f"EmailOutreach WS notification failed: {e}")

    async def flush_or_refresh(self, job: Job):
        try:
            await self.db.commit()
            await self.db.refresh(job)
        except Exception:
            await self.db.rollback()
            raise

    async def create_job_and_scrape(
        self,
        user: User,
        keyword: str,
        location: str | None,
        max_results: int = 100,
    ) -> tuple[Job, dict[str, Any]]:
        if not settings.apify_api_token:
            raise ValueError("apify_token_missing")

        kw = (keyword or "").strip()
        loc = (location or "").strip() or None
        if not kw:
            raise ValueError("keyword_required")
        if not loc:
            raise ValueError("location_required")
        if max_results < 1 or max_results > 100000:
            raise ValueError("invalid_max_results")

        meta = {
            "scraper": "x_guru/google-maps-email-extractor",
            "contactResultMode": "emailsOnly",
            "includePersonalData": False,
            "email_outreach": True,
        }

        job = await self.job_repo.create(
            user_id=user.id,
            job_type="single",
            mode="email_outreach",
            query=kw,
            location=loc,
            meta=meta,
        )
        await self.flush_or_refresh(job)
        stats = {
            "businesses_found": 0,
            "emails_found": 0,
            "duplicates_removed": 0,
            "valid_leads": 0,
        }

        async def notify(status: str, progress: int):
            try:
                await self.job_repo.update_status(job, status, progress=progress)
                await self.flush_or_refresh(job)
                await self._notify_job(job, {"stats": stats})
            except Exception as e:
                logger.error(f"EmailOutreach progress notification failed: {e}")

        scraper = ApifyMapsScraper(notify_callback=notify)
        try:
            await self.job_repo.update_status(job, "processing", progress=5)
            await self.flush_or_refresh(job)
            await self._notify_job(job, {"stats": stats, "step": "Starting scraper..."})

            raw_leads = await scraper.scrape_xguru_email_extractor(
                keyword=kw,
                location=loc,
                max_results=max_results,
                contact_result_mode="emailsOnly",
                include_personal_data=False,
            )

            stats["businesses_found"] = len(raw_leads)
            await self.job_repo.update_status(job, "scraping", progress=50)
            await self.flush_or_refresh(job)
            await self._notify_job(job, {"stats": stats, "step": "Cleaning leads..."})

        except Exception as scrape_err:
            err_lower = str(scrape_err).lower()
            if "apify_token_missing" in err_lower or "token" in err_lower:
                msg = "Apify API token is not configured."
            elif any(k in err_lower for k in ["usage", "limit", "credit", "balance", "insufficient"]):
                    msg = f"Apify credits or limit reached: {scrape_err}"
            else:
                msg = f"The Apify scraper failed: {scrape_err}"
            await self.job_repo.update_status(job, "failed", error_message=str(scrape_err)[:1000])
            await self.flush_or_refresh(job)
            await self._notify_job(job)
            raise ValueError(msg) from scrape_err

        cleaned_leads: list[dict[str, Any]] = []
        email_set: set[str] = set()
        website_set: set[str] = set()
        maps_url_set: set[str] = set()
        place_set: set[str] = set()
        dedup_set: set[str] = set()

        for lead in raw_leads:
            try:
                # ----- Email normalization -----
                raw_email_list = lead.get("emails") or []
                if isinstance(raw_email_list, list):
                    normalized_emails = [
                    _normalize_email(e) for e in raw_email_list
                    if _is_valid_email(e)
                ]
                else:
                    normalized_emails = []
                direct = lead.get("email")
                if _is_valid_email(direct):
                    nd = _normalize_email(str(direct))
                    if nd not in normalized_emails:
                        normalized_emails.insert(0, nd)

                if not normalized_emails:
                    continue  # Skip leads without valid emails

                stats["emails_found"] += 1
                primary_email = normalized_emails[0]

                # ----- Website normalization -----
                website_raw = lead.get("website")
                website_val = website_raw if isinstance(website_raw, str) and website_raw.strip() else None
                domain = _extract_domain(website_val)

                # ----- Google Maps identifiers -----
                maps_url = (lead.get("maps_url") or "").strip() or None
                place_id = (lead.get("place_id") or lead.get("cid") or "").strip() or None
                business_name = (lead.get("business_name") or "").strip()
                location_val = (lead.get("location") or lead.get("address") or "").strip()

                if not business_name:
                    continue

                # ----- Deduplication -----
                is_dup = False
                for em in normalized_emails:
                    if em in email_set:
                        is_dup = True
                        break
                if not is_dup and domain and domain in website_set:
                    is_dup = True
                if not is_dup and maps_url and maps_url in maps_url_set:
                    is_dup = True
                if not is_dup and place_id and place_id in place_set:
                    is_dup = True
                if not is_dup:
                    combo = f"{business_name.lower()}|{location_val.lower()}"
                    if combo in dedup_set:
                        is_dup = True
                if is_dup:
                    stats["duplicates_removed"] += 1
                    continue

                for em in normalized_emails:
                    email_set.add(em)
                if domain:
                    website_set.add(domain)
                if maps_url:
                    maps_url_set.add(maps_url)
                if place_id:
                    place_set.add(place_id)
                dedup_set.add(combo)

                cleaned_leads.append({
                    **lead,
                    "email": primary_email,
                    "emails": normalized_emails,
                    "website": website_val,
                    "_domain": domain,
                })
            except Exception as bad_lead:
                logger.warning("Skipping bad Email Outreach lead: %s", bad_lead)
                continue

        if not cleaned_leads:
            await self.job_repo.update_status(
                job, "completed", progress=100, processed_urls=0
            )
            await self.flush_or_refresh(job)
            await self._notify_job(job, {"stats": stats, "step": "No valid email leads found."})
            return job, stats

        await self.job_repo.update_status(job, "analyzing", progress=70)
        await self.flush_or_refresh(job)
        await self._notify_job(job, {"stats": stats, "step": "Analyzing websites & scoring leads..."})

        map_leads_to_add: list[MapLead] = []
        for lead in cleaned_leads:
            try:
                ai_res = self.ai.analyze_map_lead(lead)
                website = lead.get("website")
                has_website = bool(website and website.strip() and website.lower() not in {"n/a", "none", "null", "-"})
                lead_score = "High" if not has_website else ai_res.get("lead_score", "Medium")
                rec_service = (
                    "Website Development"
                    if not has_website
                    else ai_res.get("recommended_service")
                )
                phones_raw = lead.get("extra_phones")
                phone = lead.get("phone")
                extra_phones = phones_raw if isinstance(phones_raw, list) else ([phones_raw = []
                if phone and isinstance(phone, str) and phone not in extra_phones:
                    extra_phones.insert(0, phone)
                socials = lead.get("social_links")
                if not isinstance(socials, dict):
                    socials = {}

                map_leads_to_add.append(MapLead(
                    job_id=job.id,
                    business_name=lead["business_name"],
                    category=lead.get("category"),
                    phone=phone if isinstance(phone, str) else None,
                    address=lead.get("address"),
                    website=website,
                    email=lead.get("email"),
                    emails=lead.get("emails"),
                    extra_phones=extra_phones,
                    whatsapp=lead.get("whatsapp"),
                    social_links=socials,
                    place_id=lead.get("place_id"),
                    lat=lead.get("lat"),
                    lng=lead.get("lng"),
                    rating=lead.get("rating"),
                    reviews=lead.get("reviews"),
                    opening_hours=lead.get("opening_hours"),
                    maps_url=lead.get("maps_url"),
                    lead_score=lead_score,
                    recommended_service=rec_service,
                    ai_summary=ai_res.get("summary"),
                    source=self.SOURCE,
                ))
                stats["valid_leads"] += 1
            except Exception as save_err:
                logger.error("Failed to save Email Outreach lead row: %s", save_err)
                continue

        self.db.add_all(map_leads_to_add)
        await self.job_repo.update_status(
            job, "completed", progress=100, processed_urls=len(map_leads_to_add)
        )
        await self.flush_or_refresh(job)
        await self._notify_job(job, {"stats": stats, "step": "Completed."})

        return job, stats

    async def list_leads(
        self,
        user: User,
        has_email: Optional[bool] = None,
        has_website: Optional[bool] = None,
        no_website: Optional[bool] = None,
        lead_score: Optional[str] = None,
        location: Optional[str] = None,
        category: Optional[str] = None,
        limit: int = 200,
        skip_db_existing_dedup: bool = True,
    ) -> list[MapLead]:
        """
        List all Email Outreach leads (source=self.SOURCE) belonging to the user,
        with the existing filters.
        """
        from app.models.job import Job as JobModel

        stmt = (
            select(MapLead)
            .join(JobModel, MapLead.job_id == JobModel.id)
            .where(JobModel.user_id == user.id)
        )
        if skip_db_existing_dedup:
            stmt = stmt.where(
                or_(MapLead.source == self.SOURCE,
                    JobModel.mode == "email_outreach")
            )

        if has_email is True:
            stmt = stmt.where(MapLead.email.isnot(None) & func.length(func.coalesce(MapLead.email, "") != "")
        elif has_email is False:
            stmt = stmt.where(
                or_(MapLead.email.is_(None),
                    func.length(func.coalesce(MapLead.email, "")) == "")
            )

        if has_website is True:
            stmt = stmt.where(MapLead.website.isnot(None) & func.length(func.coalesce(MapLead.website, "") != "")
        elif has_website is False:
            stmt = stmt.where(
                or_(MapLead.website.is_(None),
                    func.length(func.coalesce(MapLead.website, "") == "")
                )
            )
        if no_website:
            stmt = stmt.where(
                or_(MapLead.website.is_(None),
                    func.length(func.coalesce(MapLead.website, "") == "")
                )
            )
        if lead_score:
            stmt = stmt.where(MapLead.lead_score.ilike(f"%{lead_score}%"))

        if location:
            stmt = stmt.where(MapLead.address.ilike(f"%{location}%"))

        if category:
            stmt = stmt.where(MapLead.category.ilike(f"%{category}%"))

        stmt = stmt.order_by(MapLead.created_at.desc()).limit(limit)

        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def export_leads(
        self,
        user: User,
        fmt: str,
        filters: dict | None = None,
    ) -> str:
        leads = await self.list_leads(user=user, **(filters or {}), limit=10000)
        rows: list[dict[str, Any]] = []
        for lead in leads:
            socials = lead.social_links or {}
            if isinstance(socials, dict):
                social_str = ", ".join(
                    f"{k}: {v}" for k, v in socials.items() if v)
            else:
                social_str = ""
            rows.append({
                "id": str(lead.id),
                "business_name": lead.business_name,
                "email": lead.email,
                "all_emails": ", ".join(lead.emails) if lead.emails else "",
                "phone": lead.phone,
                "extra_phones": ", ".join(lead.extra_phones) if lead.extra_phones else "",
                "website": lead.website,
                "address": lead.address,
                "category": lead.category,
                "rating": lead.rating,
                "reviews": lead.reviews,
                "google_maps_url": lead.maps_url,
                "place_id": lead.place_id,
                "whatsapp": lead.whatsapp,
                "social_links": social_str,
                "lead_score": lead.lead_score,
                "recommended_service": lead.recommended_service,
                "ai_summary": lead.ai_summary,
                "source": lead.source or self.SOURCE,
                "created_at": str(lead.created_at),
            })

        job_id = uuid.uuid4()
        path = self.export_svc.export(job_id, fmt, leads=rows)
        return str(path)
