import logging
import asyncio
import re
from typing import List, Dict, Any, Optional, Callable
from apify_client import ApifyClient
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

INSTAGRAM_ACTOR = "apify/instagram-scraper"
INSTAGRAM_DM_ACTOR = "jaruja/instagram-direct-message"
TIKTOK_ACTOR = "clockworks/tiktok-scraper"


def _get_val(obj, key):
    if isinstance(obj, dict): return obj.get(key)
    return getattr(obj, key, None)


def _dataset_id(run: Any) -> str | None:
    return _get_val(run, "defaultDatasetId") or _get_val(run, "default_dataset_id")


def _normalize_instagram_item(item: dict) -> dict | None:
    username = (
        item.get("username")
        or item.get("ownerUsername")
        or (item.get("owner") or {}).get("username")
    )
    if not username:
        return None

    bio = item.get("biography") or item.get("description") or item.get("bio") or ""
    emails_in_bio = re.findall(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}", bio)
    # Improved phone regex for more global support
    phones_in_bio = re.findall(r"(\+?\d{1,4}[-.\s]?\(?\d{1,3}?\)?[-.\s]?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{1,9})", bio)

    pic = item.get("profilePicUrl")
    if not pic:
        hd = item.get("hdProfilePicUrlInfo")
        if isinstance(hd, dict):
            pic = hd.get("url")

    return {
        "username": username,
        "full_name": item.get("fullName") or item.get("ownerFullName") or item.get("name") or username,
        "bio": bio,
        "followers_count": item.get("followersCount") or item.get("followers") or 0,
        "following_count": item.get("followsCount") or item.get("followingCount") or 0,
        "posts_count": item.get("postsCount") or item.get("mediaCount") or 0,
        "website": item.get("externalUrl") or item.get("external_url") or item.get("website"),
        "profile_url": f"https://www.instagram.com/{username}/",
        "profile_pic_url": pic,
        "email": item.get("email") or item.get("business_email") or (emails_in_bio[0] if emails_in_bio else None),
        "phone": item.get("phone") or item.get("business_phone_number") or (phones_in_bio[0] if phones_in_bio else None),
    }


def _normalize_tiktok_item(item: dict) -> dict | None:
    # Check if item has authorMeta (from video search)
    author_meta = item.get("authorMeta", {})
    
    username = (
        item.get("uniqueId")
        or item.get("unique_id")
        or item.get("username")
        or (item.get("author") or {}).get("uniqueId")
        or author_meta.get("name")
    )
    if not username:
        return None

    bio = (
        item.get("signature") 
        or item.get("bio") 
        or item.get("description") 
        or author_meta.get("signature") 
        or ""
    )
    emails_in_bio = re.findall(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}", bio)
    phones_in_bio = re.findall(r"(\+?\d{1,4}[-.\s]?\(?\d{1,3}?\)?[-.\s]?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{1,9})", bio)

    avatar_thumb = (
        item.get("avatarThumb") 
        or (item.get("author") or {}).get("avatarThumb") 
        or author_meta.get("avatar")
    )

    return {
        "username": username,
        "full_name": (
            item.get("nickname") 
            or item.get("full_name") 
            or author_meta.get("nickName")
            or username
        ),
        "bio": bio,
        "followers_count": (
            item.get("followerCount") 
            or item.get("followers_count") 
            or item.get("stats", {}).get("followerCount") 
            or author_meta.get("fans") 
            or 0
        ),
        "following_count": (
            item.get("followingCount") 
            or item.get("following_count") 
            or item.get("stats", {}).get("followingCount") 
            or author_meta.get("following") 
            or 0
        ),
        "posts_count": (
            item.get("videoCount") 
            or item.get("videos_count") 
            or item.get("stats", {}).get("videoCount") 
            or author_meta.get("video") 
            or 0
        ),
        "website": item.get("bioLink") or item.get("bio_link") or None,
        "profile_url": (
            item.get("profileUrl") 
            or (item.get("author") or {}).get("profileUrl") 
            or author_meta.get("profileUrl") 
            or f"https://www.tiktok.com/@{username}/"
        ),
        "profile_pic_url": avatar_thumb,
        "email": None,
        "phone": None,
        "emails_in_bio": emails_in_bio,
        "phones_in_bio": phones_in_bio,
    }


class ApifySocialScraper:
    """
    Instagram & TikTok profile search via Apify actors.
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
        max_wait = 180  # More time for TikTok
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
            
            waited += 2
            await asyncio.sleep(2)

        dataset_id = _dataset_id(run)
        if not dataset_id:
            return []
        return await loop.run_in_executor(
            None,
            lambda: self.client.dataset(dataset_id).list_items().items,
        )

    async def scrape_instagram(self, query: str, limit: int = 15) -> List[Dict[str, Any]]:
        if not self.client:
            logger.error("Apify API Token missing")
            raise Exception("apify_token_missing")

        await self._notify("processing", 10)

        if not query:
            return []
        search_term = str(query).replace("#", "").strip()
        await self._notify("processing", 15)

        profile_input = {
            "search": search_term,
            "searchType": "user",
            "searchLimit": limit,
            "resultsType": "details",
            "resultsLimit": 1,
        }

        hashtag_input = {
            "search": f"#{search_term}",
            "searchType": "hashtag",
            "searchLimit": min(limit, 5),
            "resultsType": "details",
            "resultsLimit": max(1, limit // 5),
        }

        try:
            logger.info("Starting Apify Instagram actor for query: %s", search_term)
            await self._notify("scraping", 25)

            dataset_items = await self._run_actor(INSTAGRAM_ACTOR, profile_input)

            if not dataset_items:
                await self._notify("scraping", 45)
                dataset_items = await self._run_actor(INSTAGRAM_ACTOR, hashtag_input)

            await self._notify("scraping", 85)

            normalized_results = []
            seen = set()
            for item in dataset_items:
                lead = _normalize_instagram_item(item)
                if not lead:
                    continue
                key = lead["username"].lower()
                if key in seen:
                    continue
                seen.add(key)
                normalized_results.append(lead)
                if len(normalized_results) >= limit:
                    break

            return normalized_results

        except Exception as e:
            err = str(e).lower()
            if "monthly usage hard limit" in err or "insufficient" in err and "credit" in err:
                logger.error("Apify quota exceeded: %s", e)
                raise Exception(
                    "Apify monthly limit reached. Add credits at apify.com or wait for reset."
                ) from e
            logger.error("Instagram scraping failed: %s", e)
            raise e

    async def scrape_tiktok(self, query: str, limit: int = 15) -> List[Dict[str, Any]]:
        if not self.client:
            logger.error("Apify API Token missing")
            raise Exception("apify_token_missing")

        await self._notify("processing", 10)

        if not query:
            return []
        search_term = str(query).replace("#", "").strip()
        await self._notify("processing", 15)

        tiktok_input = {
            "searchQueries": [search_term],
            "searchSection": "/user",
            "maxResultsPerQuery": limit,
            "maxProfilesPerQuery": limit,
            "profilesDesired": limit,
        }

        try:
            logger.info("Starting Apify TikTok actor for query: %s", search_term)
            await self._notify("scraping", 25)

            dataset_items = await self._run_actor(TIKTOK_ACTOR, tiktok_input)

            await self._notify("scraping", 85)

            normalized_results = []
            seen = set()
            for item in dataset_items:
                lead = _normalize_tiktok_item(item)
                if not lead:
                    continue
                key = lead["username"].lower()
                if key in seen:
                    continue
                seen.add(key)
                normalized_results.append(lead)
                if len(normalized_results) >= limit:
                    break

            return normalized_results

        except Exception as e:
            err = str(e).lower()
            if "monthly usage hard limit" in err or "insufficient" in err and "credit" in err:
                logger.error("Apify quota exceeded: %s", e)
                raise Exception(
                    "Apify monthly limit reached. Add credits at apify.com or wait for reset."
                ) from e
            logger.error("TikTok scraping failed: %s", e)
            raise e

    async def send_instagram_dm(
        self,
        username: str,
        message: str,
        instagram_cookie: str
    ) -> Dict[str, Any]:
        """
        Send Instagram DM using Apify DM actor.
        Requires Instagram cookie (can be obtained from browser or Apify actor input).
        """
        if not self.client:
            logger.error("Apify API Token missing")
            raise Exception("apify_token_missing")

        await self._notify("sending_dm", 20)

        dm_input = {
            "username": username,
            "message": message,
            "cookie": instagram_cookie,
            "proxy": {
                "useApifyProxy": True
            }
        }

        try:
            logger.info("Starting Apify Instagram DM actor for user: %s", username)
            await self._notify("sending_dm", 50)

            dataset_items = await self._run_actor(dm_input)

            await self._notify("dm_sent", 100)

            return {
                "success": True,
                "username": username,
                "result": dataset_items
            }

        except Exception as e:
            err = str(e).lower()
            if "monthly usage hard limit" in err or "insufficient" in err and "credit" in err:
                logger.error("Apify quota exceeded: %s", e)
                raise Exception(
                    "Apify monthly limit reached. Add credits at apify.com or wait for reset."
                ) from e
            logger.error("Instagram DM failed: %s", e)
            raise e
