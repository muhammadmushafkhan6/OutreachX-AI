import logging
import asyncio
from typing import List, Dict, Any, Optional, Callable
from apify_client import ApifyClient
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

PEAKY_ACTOR = "peakydev/leads-scraper-ppe"


def _get_val(obj, key):
    if isinstance(obj, dict):
        return obj.get(key)
    return getattr(obj, key, None)


def _dataset_id(run: Any) -> str | None:
    return _get_val(run, "defaultDatasetId") or _get_val(run, "default_dataset_id")


def _normalize_peaky_item(item: dict) -> dict | None:
    # Peaky Dev's actor output - let's normalize the fields
    return {
        "first_name": item.get("firstName"),
        "last_name": item.get("lastName"),
        "person_title": item.get("personTitle"),
        "seniority": item.get("seniority"),
        "functional": item.get("functional"),
        "person_country": item.get("personCountry"),
        "person_state": item.get("personState"),
        "company_name": item.get("companyName"),
        "company_domain": item.get("companyDomain"),
        "company_employee_size": item.get("companyEmployeeSize"),
        "company_country": item.get("companyCountry"),
        "company_state": item.get("companyState"),
        "industry": item.get("industry"),
        "revenue": item.get("revenue"),
        "business_model": item.get("businessModel"),
        "work_email": item.get("workEmail"),
        "personal_email": item.get("personalEmail"),
        "phone": item.get("phone"),
        "linkedin_url": item.get("linkedinUrl"),
        "company_linkedin_url": item.get("companyLinkedinUrl"),
    }


class ApifyPeakyScraper:
    """
    Peaky Dev's Leads Scraper via Apify
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

        # Start the actor
        run = await loop.run_in_executor(
            None,
            lambda: self.client.actor(actor_name).start(run_input=run_input),
        )
        run_id = _get_val(run, "id")

        # Poll for status to avoid blocking and show progress
        waited = 0
        max_wait = 600  # 10 minutes max wait for Peaky Dev
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
            logger.info("Starting Apify Peaky Dev Leads Scraper")
            await self._notify("scraping", 25)

            # Prepare input for Peaky Dev's actor
            actor_input = {
                **filters,
                "totalResults": limit,
                "includeEmails": True,
            }

            dataset_items = await self._run_actor(PEAKY_ACTOR, actor_input)

            await self._notify("scraping", 85)

            normalized_results = []
            for item in dataset_items:
                lead = _normalize_peaky_item(item)
                if lead:
                    normalized_results.append(lead)
                if len(normalized_results) >= limit:
                    break

            return normalized_results

        except Exception as e:
            err = str(e).lower()
            if "monthly usage hard limit" in err or "insufficient" in err and "credit" in err:
                logger.error("Apify credits exhausted or limit reached: %s", e)
                raise Exception(
                    "Apify monthly limit reached. Add credits at apify.com or wait for reset."
                ) from e
            logger.error("Peaky Dev scraping failed: %s", e)
            raise e
