import logging
import asyncio
from typing import List, Dict, Any, Optional, Callable
from apify_client import ApifyClient
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# Reuse the same Apify actor as Peaky Dev — different filters produce LinkedIn-focused leads
LINKEDIN_ACTOR = "peakydev/leads-scraper-ppe"


def _get_val(obj, key):
    if isinstance(obj, dict):
        return obj.get(key)
    return getattr(obj, key, None)


def _dataset_id(run: Any) -> str | None:
    return _get_val(run, "defaultDatasetId") or _get_val(run, "default_dataset_id")


def _normalize_linkedin_item(item: dict) -> dict:
    """Normalize Apify actor output to LinkedInLead fields."""
    first_name = item.get("firstName") or item.get("first_name") or ""
    last_name = item.get("lastName") or item.get("last_name") or ""
    full_name = item.get("fullName") or item.get("full_name") or f"{first_name} {last_name}".strip() or None
    country = item.get("personCountry") or item.get("companyCountry") or None
    city = item.get("personState") or item.get("personCity") or item.get("city") or None
    location_parts = [p for p in [city, country] if p]
    location = ", ".join(location_parts) if location_parts else None

    return {
        "first_name": first_name or None,
        "last_name": last_name or None,
        "full_name": full_name,
        "job_title": item.get("personTitle") or item.get("jobTitle") or None,
        "seniority": item.get("seniority") or None,
        "company_name": item.get("companyName") or None,
        "company_website": item.get("companyDomain") or item.get("companyWebsite") or None,
        "company_size": item.get("companyEmployeeSize") or item.get("companySize") or None,
        "industry": item.get("industry") or None,
        "country": country,
        "city": city,
        "location": location,
        "work_email": item.get("workEmail") or None,
        "personal_email": item.get("personalEmail") or None,
        "phone": item.get("phone") or None,
        "linkedin_url": item.get("linkedinUrl") or item.get("profileUrl") or None,
        "company_linkedin_url": item.get("companyLinkedinUrl") or None,
    }


class ApifyLinkedInScraper:
    """
    LinkedIn B2B Leads Scraper via Apify (peakydev/leads-scraper-ppe actor).
    Uses LinkedIn-focused filter parameters rather than Peaky Dev defaults.
    """

    def __init__(self, notify_callback: Optional[Callable[[str, int], Any]] = None):
        self.notify_callback = notify_callback
        self.client = ApifyClient(settings.apify_api_token) if settings.apify_api_token else None

    async def _notify(self, status: str, progress: int):
        if self.notify_callback:
            if asyncio.iscoroutinefunction(self.notify_callback):
                await self.notify_callback(status, progress)
            else:
                self.notify_callback(status, progress)

    async def _run_actor(self, actor_name: str, run_input: dict) -> list:
        loop = asyncio.get_running_loop()

        run = await loop.run_in_executor(
            None,
            lambda: self.client.actor(actor_name).start(run_input=run_input),
        )
        run_id = _get_val(run, "id")

        waited = 0
        max_wait = 600  # 10 minutes max
        while waited < max_wait:
            run = await loop.run_in_executor(
                None,
                lambda: self.client.run(run_id).get(),
            )
            status = _get_val(run, "status")

            if status == "SUCCEEDED":
                break
            elif status in ["FAILED", "ABORTED", "TIMED-OUT"]:
                return []

            waited += 5
            await asyncio.sleep(5)

        dataset_id = _dataset_id(run)
        if not dataset_id:
            return []
        return await loop.run_in_executor(
            None,
            lambda: self.client.dataset(dataset_id).list_items().items,
        )

    async def scrape(self, filters: dict, limit: int = 100) -> List[Dict[str, Any]]:
        if not self.client:
            logger.error("Apify API Token missing")
            raise Exception("apify_token_missing")

        await self._notify("processing", 10)

        try:
            logger.info("Starting Apify LinkedIn Leads Scraper")
            await self._notify("scraping", 25)

            # Build actor input from LinkedIn-focused filters
            actor_input: dict = {
                "totalResults": limit,
                "includeEmails": True,
            }

            # Map frontend filter keys to actor input keys
            # Merge keywords + industry into a single keywords string to avoid
            # the actor's strict custom industry taxonomy validation.
            keyword_parts = []
            if filters.get("keywords"):
                keyword_parts.append(filters["keywords"])
            if filters.get("industry"):
                keyword_parts.append(filters["industry"])
            if keyword_parts:
                actor_input["keywords"] = " ".join(keyword_parts)

            if filters.get("jobTitle"):
                actor_input["personTitle"] = [filters["jobTitle"]] if isinstance(filters["jobTitle"], str) else filters["jobTitle"]
            if filters.get("companyName"):
                actor_input["companyName"] = [filters["companyName"]] if isinstance(filters["companyName"], str) else filters["companyName"]
            if filters.get("companySize"):
                actor_input["companyEmployeeSize"] = [filters["companySize"]] if isinstance(filters["companySize"], str) else filters["companySize"]
            if filters.get("country"):
                actor_input["personCountry"] = [filters["country"]] if isinstance(filters["country"], str) else filters["country"]
            if filters.get("city"):
                actor_input["personState"] = [filters["city"]] if isinstance(filters["city"], str) else filters["city"]
            if filters.get("seniority"):
                actor_input["seniority"] = [filters["seniority"]] if isinstance(filters["seniority"], str) else filters["seniority"]

            dataset_items = await self._run_actor(LINKEDIN_ACTOR, actor_input)

            # Apify sometimes returns error messages as dataset items on free tier
            if dataset_items and isinstance(dataset_items[0], dict):
                first = dataset_items[0]
                error_msg = first.get("error") or first.get("message") or first.get("errorMessage") or ""
                if not error_msg and len(first) <= 2:
                    # Very sparse item — check all string values for Apify error patterns
                    error_msg = " ".join(str(v) for v in first.values() if isinstance(v, str))
                if "monthly" in error_msg.lower() or "limit" in error_msg.lower() or "exceeded" in error_msg.lower():
                    raise Exception(f"Apify free tier limit reached: {error_msg.strip()}")

            await self._notify("scraping", 85)

            normalized_results = []
            for item in dataset_items:
                lead = _normalize_linkedin_item(item)
                if lead:
                    normalized_results.append(lead)
                if len(normalized_results) >= limit:
                    break

            return normalized_results

        except Exception as e:
            err = str(e).lower()
            if "monthly usage hard limit" in err or ("insufficient" in err and "credit" in err):
                logger.error("Apify credits exhausted: %s", e)
                raise Exception(
                    "Apify monthly limit reached. Add credits at apify.com or wait for reset."
                ) from e
            logger.error("LinkedIn scraping failed: %s", e)
            raise e
