import csv
import io
import logging
import re
import uuid
from urllib.parse import urlparse

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ai_analysis import AIAnalysis
from app.models.extracted_data import ExtractedData
from app.models.job import Job
from app.models.log import Log
from app.models.website import Website
from app.models.map_lead import MapLead
from app.models.social_media_lead import SocialMediaLead
from app.models.peaky_lead import PeakyLead
from app.repositories.job_repository import JobRepository
from app.schemas.job import JobResponse
from app.services.ai_service import AIService
from app.services.scraper.html_parser import HTMLParser
from app.services.scraper.contact_enricher import enrich_contact_data
from app.services.scraper.website_fetcher import WebsiteFetcher
from app.services.maps.apify_scraper import ApifyMapsScraper
from app.services.maps.google_places_service import GooglePlacesService
from app.services.social_media.apify_social import ApifySocialScraper
from app.services.peaky_scraper import ApifyPeakyScraper
from app.services.linkedin_scraper import ApifyLinkedInScraper
from app.models.linkedin_lead import LinkedInLead
from app.websocket.manager import ws_manager
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

_NON_BUSINESS_WEBSITE_HOSTS = (
    "google.com",
    "goo.gl",
    "maps.app.goo.gl",
    "facebook.com",
    "instagram.com",
    "twitter.com",
    "x.com",
    "linkedin.com",
    "youtube.com",
    "tiktok.com",
    "wa.me",
    "whatsapp.com",
)


def parse_maps_query(query: str) -> tuple[str, bool]:
    """Return clean Google Maps search text and whether to keep only no-website leads."""
    raw = (query or "").strip()
    filter_no_website = "without website" in raw.lower()
    search_query = re.sub(r"(?i)\s*without website\s*", " ", raw).strip()
    return search_query or raw, filter_no_website


def has_business_website(website: str | None) -> bool:
    if not website:
        return False
    value = str(website).strip().lower()
    if not value or value in {"none", "null", "n/a", "-", "undefined"}:
        return False
    if not value.startswith(("http://", "https://")):
        value = f"https://{value}"
    try:
        host = urlparse(value).netloc.lower().replace("www.", "")
    except Exception:
        return bool(value)
    if not host:
        return False
    return not any(host == h or host.endswith(f".{h}") for h in _NON_BUSINESS_WEBSITE_HOSTS)


class JobService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.job_repo = JobRepository(db)
        self.scraper = WebsiteFetcher()
        self.parser = HTMLParser()
        self.ai = AIService()
        self.maps_scraper = ApifyMapsScraper(notify_callback=self._notify_status)

    async def _notify_status(self, status: str, progress: int):
        """Callback for scraper to notify progress."""
        # This needs a job reference, so we'll use a wrapper or update manually in process methods
        pass

    async def _notify(self, job: Job):
        try:
            # Create a safe dictionary for serialization to avoid lazy-loading issues
            job_data = {
                "id": job.id,
                "type": job.type,
                "mode": job.mode,
                "status": job.status,
                "progress": job.progress,
                "url": job.url,
                "query": job.query,
                "total_urls": job.total_urls,
                "processed_urls": job.processed_urls,
                "error_message": job.error_message,
                "created_at": job.created_at,
                "updated_at": job.updated_at,
            }
            # Use the dictionary to validate the response model
            payload = JobResponse.model_validate(job_data).model_dump(mode="json")
            await ws_manager.broadcast_job(job.id, payload)
        except Exception as e:
            logger.warning("Job notify failed for %s: %s", job.id, e)

    async def _log(self, job_id: uuid.UUID, message: str, level: str = "info"):
        self.db.add(Log(job_id=job_id, message=message, level=level))
        await self.db.flush()

    async def _set_status(self, job: Job, status: str, progress: int) -> None:
        await self.job_repo.update_status(job, status, progress=progress)
        await self.db.commit()
        await self._notify(job)

    async def process_single_url(self, job_id: uuid.UUID, url: str) -> None:
        job = await self.job_repo.get_by_id(job_id)
        if not job:
            return

        try:
            await self._set_status(job, "processing", 5)
            await self._log(job.id, f"Starting scrape for {url}")
            await self.db.commit()

            await self._set_status(job, "scraping", 20)

            html = await self.scraper.fetch_html(url)
            parsed = urlparse(url)

            website = Website(job_id=job.id, url=url, status="scraped", raw_html=html[:500000])
            self.db.add(website)
            await self.db.flush()

            base_origin = f"{parsed.scheme}://{parsed.netloc}"
            extracted_dict = self.parser.parse(html, base_origin)
            await self._log(job.id, "Scanning contact / about pages for email & phone")
            await self.db.commit()
            extracted_dict = await enrich_contact_data(
                self.scraper, self.parser, url, extracted_dict
            )
            website.cleaned_html = extracted_dict.get("cleaned_html", "")[:500000]

            extracted = ExtractedData(
                job_id=job.id,
                website_id=website.id,
                url=url,
                **{k: extracted_dict[k] for k in extracted_dict if k != "cleaned_html"},
            )
            self.db.add(extracted)
            await self.db.flush()

            await self._set_status(job, "ai_analyzing", 60)
            await self._log(job.id, "Running AI analysis")
            await self.db.commit()

            ai_result = self.ai.analyze(extracted_dict.get("business_text", ""), extracted_dict)
            analysis = AIAnalysis(
                job_id=job.id,
                company_name=ai_result.get("company_name", ""),
                industry=ai_result.get("industry", ""),
                business_type=ai_result.get("business_type", ""),
                niche=ai_result.get("niche", ""),
                summary=ai_result.get("summary", ""),
                lead_score=ai_result.get("lead_score", "Medium"),
                target_audience=ai_result.get("target_audience", ""),
                services=ai_result.get("services", []),
                raw_response=ai_result,
            )
            self.db.add(analysis)

            await self.job_repo.update_status(job, "completed", progress=100, processed_urls=1)
            await self._log(job.id, "Job completed successfully")
            await self.db.commit()
            await self._notify(job)

        except Exception as e:
            logger.exception("Job %s failed", job_id)
            msg = str(e).strip() or f"{type(e).__name__} (no message)"
            await self.job_repo.update_status(job, "failed", error_message=msg[:1000])
            await self._log(job.id, str(e), level="error")
            await self.db.commit()
            await self._notify(job)

    async def process_bulk(self, job_id: uuid.UUID, urls: list[str]) -> None:
        job = await self.job_repo.get_by_id(job_id)
        if not job:
            return

        total = len(urls)
        job.total_urls = total
        await self.db.flush()

        for i, url in enumerate(urls):
            try:
                progress = int((i / total) * 100)
                await self.job_repo.update_status(job, "scraping", progress=progress, processed_urls=i)
                await self._notify(job)

                html = await self.scraper.fetch_html(url)
                parsed = urlparse(url)
                base = f"{parsed.scheme}://{parsed.netloc}"

                website = Website(job_id=job.id, url=url, status="scraped")
                self.db.add(website)
                await self.db.flush()

                extracted_dict = self.parser.parse(html, base)
                extracted_dict = await enrich_contact_data(
                    self.scraper, self.parser, url, extracted_dict
                )
                self.db.add(
                    ExtractedData(
                        job_id=job.id,
                        website_id=website.id,
                        url=url,
                        **{k: extracted_dict[k] for k in extracted_dict if k != "cleaned_html"},
                    )
                )
                await self.db.flush()

            except Exception as e:
                await self._log(job.id, f"Failed URL {url}: {e}", level="error")

        # Single AI summary for bulk (last URL's aggregate or first)
        try:
            await self.job_repo.update_status(job, "ai_analyzing", progress=90)
            await self._notify(job)

            ext = await self.job_repo.get_latest_extracted(job.id)
            if ext:
                extracted_dict = {
                    "company_name": ext.company_name,
                    "title": ext.title,
                    "meta_description": ext.meta_description,
                    "services": ext.services,
                    "emails": ext.emails,
                    "business_text": ext.business_text,
                }
                ai_result = self.ai.analyze(ext.business_text or "", extracted_dict)
                self.db.add(
                    AIAnalysis(
                        job_id=job.id,
                        company_name=ai_result.get("company_name", ""),
                        industry=ai_result.get("industry", ""),
                        business_type=ai_result.get("business_type", ""),
                        niche=ai_result.get("niche", ""),
                        summary=ai_result.get("summary", ""),
                        lead_score=ai_result.get("lead_score", "Medium"),
                        target_audience=ai_result.get("target_audience", ""),
                        services=ai_result.get("services", []),
                        raw_response=ai_result,
                    )
                )

            await self.job_repo.update_status(job, "completed", progress=100, processed_urls=total)
            await self._notify(job)
        except Exception as e:
            msg = str(e).strip() or f"{type(e).__name__} (no message)"
            await self.job_repo.update_status(job, "failed", error_message=msg[:1000])
            await self._notify(job)

    async def process_maps_search(self, job_id: uuid.UUID, query: str, location: str | None = None) -> None:
        job = await self.job_repo.get_by_id(job_id)
        if not job:
            return

        # Setup local notification for this job
        async def notify(status: str, progress: int):
            try:
                await self.job_repo.update_status(job, status, progress=progress)
                # Commit every update in background tasks so UI polling works
                await self.db.commit()
                await self._notify(job)
            except Exception as e:
                logger.error(f"Notification failed: {e}")

        scraper = ApifyMapsScraper(notify_callback=notify)
        search_query, filter_no_website = parse_maps_query(query)

        # Incorporate location into search query if provided
        final_query = search_query
        if location and location.lower() not in search_query.lower():
            final_query = f"{search_query} in {location}"

        leads = []
        try:
            # 1. Try Ultra-Fast Direct Google Places API first if configured
            if settings.google_maps_api_key:
                try:
                    await self._log(
                        job.id,
                        f"Launching High-Speed Google Places Engine for: {final_query}"
                        + (" (no-website filter ON)" if filter_no_website else ""),
                    )
                    gp_service = GooglePlacesService(notify_callback=notify)
                    leads = await gp_service.search_places(
                        query=final_query,
                        limit=50 if filter_no_website else 100,
                        only_without_website=filter_no_website,
                    )
                    await self._log(job.id, f"Google Places API returned {len(leads)} verified businesses in ~3 seconds!")
                except Exception as gp_err:
                    logger.warning(f"Google Places API direct search failed ({gp_err}), falling back to Apify...")
                    await self._log(job.id, f"Google Places API fallback: {gp_err}", level="warning")
                    leads = []

            # 2. Fallback to Apify if Google Places API didn't return leads
            if not leads:
                try:
                    await self._log(
                        job.id,
                        f"Launching Apify cloud agents for: {final_query}"
                        + (" (no-website filter ON)" if filter_no_website else ""),
                    )
                    enrich_contacts = bool(job.meta and job.meta.get("enrich_contacts"))
                    use_vortex = bool(job.meta and job.meta.get("use_vortex_actor"))
                    use_email_extractor = bool(job.meta and job.meta.get("use_email_extractor_actor"))
                    leads = await scraper.scrape(
                        final_query,
                        limit=50 if filter_no_website else 100,
                        only_without_website=filter_no_website,
                        enrich_contacts=enrich_contacts,
                        use_vortex_actor=use_vortex,
                        use_email_extractor_actor=use_email_extractor,
                    )
                except Exception as apify_err:
                    err_msg = str(apify_err).lower()
                    if any(k in err_msg for k in ["usage", "limit", "credit", "balance", "insufficient"]):
                        await self._log(job.id, "Apify credits exhausted or limit reached. Switching to local engine...", level="warning")
                        try:
                            from app.services.scraper.maps_scraper.scraper_v3 import GoogleMapsScraperV3

                            local_scraper = GoogleMapsScraperV3(notify_callback=notify)
                            leads = await local_scraper.scrape(
                                search_query,
                                max_results=20,
                                only_without_website=filter_no_website,
                            )
                        except ImportError as local_err:
                            await self._log(job.id, f"Local maps fallback unavailable: {local_err}", level="error")
                            raise apify_err from local_err
                    else:
                        await self._log(job.id, f"Apify error: {apify_err}", level="error")
                        raise apify_err
            
            # Deduplication logic using business name and address
            seen_leads = set()
            unique_leads = []
            
            # Extract potential location from query (e.g., "dubai" from "biryani shops in dubai")
            location_keyword = ""
            query_lower = search_query.lower()
            if " in " in query_lower:
                location_keyword = query_lower.split(" in ")[-1].strip()
            
            for lead in leads:
                # Create a unique key for deduplication
                name = (lead.get('business_name') or "").strip()
                addr = (lead.get('address') or "").strip()
                
                if not name:
                    continue

                website_raw = lead.get("website")
                has_website = has_business_website(website_raw)
                if filter_no_website and has_website:
                    continue
                    
                lead_key = f"{name.lower()}|{addr.lower()}"
                
                if lead_key in seen_leads:
                    continue
                
                # Trust Google Maps results for the query, but we can do a soft check 
                # if location_keyword is provided and very specific
                if location_keyword:
                    # We only filter if the result is completely unrelated (very rare with Apify)
                    # For now, let's remove the strict filtering as it blocks valid results 
                    # like "Hyderabad" when searching for "Hyderabad Sindh"
                    pass
                
                seen_leads.add(lead_key)
                unique_leads.append(lead)

            leads = unique_leads
            total = len(leads)
            if total == 0:
                msg = (
                    "No businesses without a website found"
                    if filter_no_website
                    else "No businesses found in Apify dataset"
                )
                await self._log(job.id, msg, level="warning")
                await self.job_repo.update_status(job, "completed", progress=100, processed_urls=0)
                await self.db.commit()
                await self._notify(job)
                return

            await self._log(job.id, f"Extracted {total} real businesses. Finalizing results...")

            map_leads_to_add = []
            for i, lead in enumerate(leads):
                ai_res = self.ai.analyze_map_lead(lead)

                website_raw = lead.get("website")
                website = website_raw if has_business_website(website_raw) else None

                email = lead.get("email")
                emails_list = lead.get("emails")
                if not email and emails_list:
                    if isinstance(emails_list, list) and emails_list:
                        email = emails_list[0]
                phone = lead.get("phone")
                extra_phones = lead.get("extra_phones")
                whatsapp = lead.get("whatsapp")
                social_links = lead.get("social_links")
                place_id = lead.get("place_id")
                lat = lead.get("lat")
                lng = lead.get("lng")
                opening_hours = lead.get("opening_hours")

                lead_score = "High" if not website else ai_res.get("lead_score", "Medium")
                rec_service = (
                    "Website Development"
                    if not website
                    else ai_res.get("recommended_service")
                )

                map_leads_to_add.append(MapLead(
                    job_id=job.id,
                    business_name=lead["business_name"],
                    category=lead["category"],
                    phone=phone,
                    address=lead["address"],
                    website=website,
                    email=email,
                    emails=emails_list if isinstance(emails_list, list) else None,
                    extra_phones=extra_phones if isinstance(extra_phones, list) else None,
                    whatsapp=whatsapp,
                    social_links=social_links if isinstance(social_links, dict) else None,
                    place_id=place_id,
                    lat=lat,
                    lng=lng,
                    rating=lead["rating"],
                    reviews=lead["reviews"],
                    opening_hours=opening_hours,
                    maps_url=lead["maps_url"],
                    lead_score=lead_score,
                    recommended_service=rec_service,
                    ai_summary=ai_res.get("summary"),
                ))

            self.db.add_all(map_leads_to_add)
            await self.job_repo.update_status(job, "completed", progress=100, processed_urls=total)
            await self._log(job.id, f"Successfully extracted {total} leads from Google Maps via Apify")
            await self.db.commit()
            await self._notify(job)

        except Exception as e:
            logger.exception("Maps job %s failed", job_id)
            msg = str(e).strip() or f"{type(e).__name__} (no message)"
            await self.job_repo.update_status(job, "failed", error_message=msg[:1000])
            await self._log(job.id, str(e), level="error")
            await self.db.commit()
            await self._notify(job)

    async def process_social_media_search(self, job_id: uuid.UUID, query: str, location: str | None = None, platform: str = "instagram") -> None:
        job = await self.job_repo.get_by_id(job_id)
        if not job:
            return

        async def notify(status: str, progress: int):
            try:
                await self.job_repo.update_status(job, status, progress=progress)
                # Commit every update in background tasks so UI polling works
                await self.db.commit()
                await self._notify(job)
            except Exception as e:
                logger.error(f"Notification failed: {e}")

        scraper = ApifySocialScraper(notify_callback=notify)

        # Incorporate location if provided
        final_query = query
        if location:
            final_query = f"{query} {location}"

        try:
            await self._log(job.id, f"Launching Social Media agents for: {final_query} (Platform: {platform})")
            if platform == "tiktok":
                leads = await scraper.scrape_tiktok(final_query, limit=20)
            else:
                leads = await scraper.scrape_instagram(final_query, limit=20)
            
            # Deduplication logic using username
            seen_usernames = set()
            unique_leads = []
            for lead in leads:
                username = (lead.get('username') or "").lower().strip()
                if not username or username in seen_usernames:
                    continue
                seen_usernames.add(username)
                unique_leads.append(lead)
            
            leads = unique_leads
            total = len(leads)
            if total == 0:
                await self._log(job.id, "No social profiles found", level="warning")
                await self.job_repo.update_status(job, "completed", progress=100, processed_urls=0)
                await self.db.commit()
                await self._notify(job)
                return

            await self._log(job.id, f"Extracted {total} unique social profiles. Finalizing results...")

            social_leads_to_add = []
            for i, lead in enumerate(leads):
                # Basic scoring for social leads
                website = lead.get("website")
                email = lead.get("email")
                phone = lead.get("phone")
                
                # Handle bio extracted contacts
                if not email and lead.get("emails_in_bio"):
                    email = lead["emails_in_bio"][0] if isinstance(lead["emails_in_bio"], list) and lead["emails_in_bio"] else None
                if not phone and lead.get("phones_in_bio"):
                    phone = lead["phones_in_bio"][0] if isinstance(lead["phones_in_bio"], list) and lead["phones_in_bio"] else None
                
                has_website = bool(website)
                lead_score = "High" if not has_website else "Medium"
                rec_service = "Website Development" if not has_website else "Social Media Management"
                
                # Determine platform name
                platform_name = "Instagram"
                if platform == "tiktok":
                    platform_name = "TikTok"
                
                # Format followers/posts nicely for summary
                f_count = lead.get('followers_count', 0) or 0
                social_leads_to_add.append(SocialMediaLead(
                    job_id=job.id,
                    platform=platform_name,
                    username=lead["username"],
                    full_name=lead["full_name"],
                    bio=lead["bio"],
                    followers_count=f_count,
                    following_count=lead.get("following_count", 0),
                    posts_count=lead.get("posts_count", 0),
                    website=website,
                    email=email,
                    phone=phone,
                    profile_url=lead["profile_url"],
                    profile_pic_url=lead["profile_pic_url"],
                    lead_score=lead_score,
                    recommended_service=rec_service,
                    ai_summary=f"{platform_name} profile for @{lead['username']}. {f_count:,} followers."
                ))

            self.db.add_all(social_leads_to_add)
            await self.job_repo.update_status(job, "completed", progress=100, processed_urls=total)
            await self._log(job.id, f"Successfully extracted {total} social leads")
            await self.db.commit()
            await self._notify(job)

        except Exception as e:
            logger.exception("Social media job %s failed", job_id)
            msg = str(e).strip() or f"{type(e).__name__} (no message)"
            await self.job_repo.update_status(job, "failed", error_message=msg[:1000])
            await self._log(job.id, str(e), level="error")
            await self.db.commit()
            await self._notify(job)

    async def process_peaky_search(self, job_id: uuid.UUID, filters: dict | None = None) -> None:
        job = await self.job_repo.get_by_id(job_id)
        if not job:
            return

        async def notify(status: str, progress: int):
            try:
                await self.job_repo.update_status(job, status, progress=progress)
                await self.db.commit()
                await self._notify(job)
            except Exception as e:
                logger.error(f"Notification failed: {e}")

        scraper = ApifyPeakyScraper(notify_callback=notify)

        # Use default filters if none provided
        if not filters:
            filters = {
                "personCountry": ["United States"],
                "seniority": ["Founder", "CEO", "President"],
                "totalResults": 50,
            }

        try:
            await self._log(job.id, f"Launching Peaky Dev Leads Scraper with filters: {filters}")
            leads = await scraper.scrape(filters, limit=filters.get("totalResults", 50))

            total = len(leads)
            if total == 0:
                await self._log(job.id, "No leads found", level="warning")
                await self.job_repo.update_status(job, "completed", progress=100, processed_urls=0)
                await self.db.commit()
                await self._notify(job)
                return

            await self._log(job.id, f"Extracted {total} leads. Finalizing results...")

            peaky_leads_to_add = []
            for i, lead in enumerate(leads):
                # Basic scoring
                has_email = bool(lead.get("work_email") or lead.get("personal_email"))
                has_phone = bool(lead.get("phone"))
                lead_score = "High" if has_email and has_phone else "Medium" if has_email else "Low"
                rec_service = "Lead Outreach" if has_email else "Email Enrichment"

                peaky_leads_to_add.append(PeakyLead(
                    job_id=job.id,
                    first_name=lead.get("first_name"),
                    last_name=lead.get("last_name"),
                    person_title=lead.get("person_title"),
                    seniority=lead.get("seniority"),
                    functional=lead.get("functional"),
                    person_country=lead.get("person_country"),
                    person_state=lead.get("person_state"),
                    company_name=lead.get("company_name"),
                    company_domain=lead.get("company_domain"),
                    company_employee_size=lead.get("company_employee_size"),
                    company_country=lead.get("company_country"),
                    company_state=lead.get("company_state"),
                    industry=lead.get("industry"),
                    revenue=lead.get("revenue"),
                    business_model=lead.get("business_model"),
                    work_email=lead.get("work_email"),
                    personal_email=lead.get("personal_email"),
                    phone=lead.get("phone"),
                    linkedin_url=lead.get("linkedin_url"),
                    company_linkedin_url=lead.get("company_linkedin_url"),
                    lead_score=lead_score,
                    recommended_service=rec_service,
                    ai_summary=f"{lead.get('first_name') or ''} {lead.get('last_name') or ''} - {lead.get('person_title') or ''} at {lead.get('company_name') or ''}",
                ))

            self.db.add_all(peaky_leads_to_add)
            await self.job_repo.update_status(job, "completed", progress=100, processed_urls=total)
            await self._log(job.id, f"Successfully extracted {total} Peaky leads")
            await self.db.commit()
            await self._notify(job)

        except Exception as e:
            logger.exception("Peaky lead job %s failed", job_id)
            msg = str(e).strip() or f"{type(e).__name__} (no message)"
            await self.job_repo.update_status(job, "failed", error_message=msg[:1000])
            await self._log(job.id, str(e), level="error")
            await self.db.commit()
            await self._notify(job)

    async def process_linkedin_search(self, job_id: uuid.UUID, filters: dict | None = None) -> None:
        job = await self.job_repo.get_by_id(job_id)
        if not job:
            return

        # Keep job_id as a plain value — we'll re-fetch the ORM object after
        # any intermediate commits (notify callbacks) expire it.
        async def notify(status: str, progress: int):
            try:
                # Re-fetch job each time so we always work on a fresh ORM object
                fresh_job = await self.job_repo.get_by_id(job_id)
                if fresh_job:
                    await self.job_repo.update_status(fresh_job, status, progress=progress)
                    await self.db.commit()
                    await self._notify(fresh_job)
            except Exception as e:
                logger.error(f"Notification failed: {e}")

        scraper = ApifyLinkedInScraper(notify_callback=notify)

        if not filters:
            filters = {}

        limit = int(filters.pop("totalResults", 100))

        try:
            await self._log(job_id, f"Launching LinkedIn Leads Scraper with filters: {filters}, limit: {limit}")
            leads = await scraper.scrape(filters, limit=limit)

            # Re-fetch job after scraper returns — notify callbacks have
            # committed intermediate updates, expiring the old ORM object.
            job = await self.job_repo.get_by_id(job_id)
            if not job:
                return

            total = len(leads)
            if total == 0:
                await self._log(job_id, "No LinkedIn leads found", level="warning")
                await self.job_repo.update_status(job, "completed", progress=100, processed_urls=0)
                await self.db.commit()
                await self._notify(job)
                return

            await self._log(job_id, f"Extracted {total} LinkedIn leads. Saving to database...")

            linkedin_leads_to_add = []
            for lead in leads:
                has_email = bool(lead.get("work_email") or lead.get("personal_email"))
                has_phone = bool(lead.get("phone"))
                lead_score = "High" if has_email and has_phone else "Medium" if has_email else "Low"
                rec_service = "B2B Outreach" if has_email else "Email Enrichment"

                first = lead.get("first_name") or ""
                last  = lead.get("last_name") or ""
                full_name = lead.get("full_name") or f"{first} {last}".strip() or None
                title = lead.get("job_title") or ""
                company = lead.get("company_name") or ""
                ai_summary = f"{full_name or ''} - {title} at {company}".strip(" -") or None

                linkedin_leads_to_add.append(LinkedInLead(
                    job_id=job_id,           # use the plain UUID, not expired ORM attr
                    first_name=lead.get("first_name"),
                    last_name=lead.get("last_name"),
                    full_name=full_name,
                    job_title=lead.get("job_title"),
                    seniority=lead.get("seniority"),
                    company_name=lead.get("company_name"),
                    company_website=lead.get("company_website"),
                    company_size=lead.get("company_size"),
                    industry=lead.get("industry"),
                    country=lead.get("country"),
                    city=lead.get("city"),
                    location=lead.get("location"),
                    work_email=lead.get("work_email"),
                    personal_email=lead.get("personal_email"),
                    phone=lead.get("phone"),
                    linkedin_url=lead.get("linkedin_url"),
                    company_linkedin_url=lead.get("company_linkedin_url"),
                    lead_score=lead_score,
                    recommended_service=rec_service,
                    ai_summary=ai_summary,
                ))

            self.db.add_all(linkedin_leads_to_add)
            await self.job_repo.update_status(job, "completed", progress=100, processed_urls=total)
            await self._log(job_id, f"Successfully saved {total} LinkedIn leads")
            await self.db.commit()
            await self._notify(job)

        except Exception as e:
            logger.exception("LinkedIn lead job %s failed: %s", job_id, e)
            try:
                # Rollback any failed transaction before attempting to save error state
                await self.db.rollback()
                # Re-fetch a clean job object after rollback
                job = await self.job_repo.get_by_id(job_id)
                if job:
                    msg = str(e).strip() or f"{type(e).__name__} (no message)"
                    await self.job_repo.update_status(job, "failed", error_message=msg[:1000])
                    await self._log(job_id, str(e), level="error")
                    await self.db.commit()
                    await self._notify(job)
            except Exception as inner:
                logger.error("Failed to mark LinkedIn job as failed: %s", inner)


    @staticmethod
    def parse_csv_urls(content: bytes) -> list[str]:
        text = content.decode("utf-8-sig")
        reader = csv.DictReader(io.StringIO(text))
        urls = []
        for row in reader:
            url = row.get("url") or row.get("URL") or row.get("website") or ""
            url = url.strip()
            if url:
                if not url.startswith(("http://", "https://")):
                    url = f"https://{url}"
                urls.append(url)
        return urls
