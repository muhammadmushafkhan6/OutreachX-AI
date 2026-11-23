import asyncio
import logging
import re
from typing import Any, Callable, Dict, List, Optional
import httpx
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

EMAIL_REGEX = re.compile(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+")


class GooglePlacesService:
    """
    Ultra-Fast Direct Google Places API service.
    Fetches real-time places, GPS coordinates, phone numbers, websites, and emails in seconds.
    """

    def __init__(self, notify_callback: Optional[Callable[[str, int], Any]] = None):
        self.notify_callback = notify_callback
        self.api_key = settings.google_maps_api_key

    async def _notify(self, status: str, progress: int):
        if self.notify_callback:
            if asyncio.iscoroutinefunction(self.notify_callback):
                await self.notify_callback(status, progress)
            else:
                self.notify_callback(status, progress)

    async def _extract_emails_from_url(self, client: httpx.AsyncClient, url: str) -> list[str]:
        """Fast regex email extractor from website homepage (2.5s timeout)."""
        if not url or not url.startswith(("http://", "https://")):
            return []
        try:
            res = await client.get(url, timeout=2.5, follow_redirects=True)
            if res.status_code == 200:
                text = res.text
                found = set(EMAIL_REGEX.findall(text))
                # Filter out obvious static asset false positives
                valid = [
                    e for e in found
                    if not e.endswith((".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".css", ".js"))
                    and len(e) < 60
                ]
                return list(valid)[:5]
        except Exception:
            pass
        return []

    async def search_places(
        self,
        query: str,
        limit: int = 50,
        only_without_website: bool = False,
    ) -> List[Dict[str, Any]]:
        """Search Google Places with real-time progress, coordinates, contact info, and website email extraction."""
        if not self.api_key:
            raise ValueError("Google Maps API key is not configured in backend/.env")

        await self._notify("searching maps", 15)
        logger.info(f"[GooglePlaces] Querying Places API: query={query!r} limit={limit}")

        results: List[Dict[str, Any]] = []
        next_page_token: Optional[str] = None

        async with httpx.AsyncClient(headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}) as client:
            # 1. Text Search query
            while len(results) < limit:
                url = "https://maps.googleapis.com/maps/api/place/textsearch/json"
                params: dict[str, Any] = {"query": query, "key": self.api_key}
                if next_page_token:
                    params["pagetoken"] = next_page_token
                    # Google Places requires a short delay before next_page_token becomes valid
                    await asyncio.sleep(2.0)

                resp = await client.get(url, params=params, timeout=10.0)
                data = resp.json()

                status = data.get("status")
                if status not in ("OK", "ZERO_RESULTS"):
                    logger.warning(f"[GooglePlaces] TextSearch status: {status}, message: {data.get('error_message')}")
                    if not results:
                        raise Exception(f"Google Places API returned status: {status}")
                    break

                places = data.get("results", [])
                if not places:
                    break

                for p in places:
                    results.append(p)
                    if len(results) >= limit:
                        break

                next_page_token = data.get("next_page_token")
                if not next_page_token or len(results) >= limit:
                    break

            await self._notify("extracting details", 45)
            logger.info(f"[GooglePlaces] Found {len(results)} places, fetching rich place details in parallel...")

            # 2. Parallel Place Details retrieval
            async def get_details(place: dict) -> dict:
                place_id = place.get("place_id")
                if not place_id:
                    return place

                try:
                    detail_url = "https://maps.googleapis.com/maps/api/place/details/json"
                    params = {
                        "place_id": place_id,
                        "fields": "name,formatted_phone_number,international_phone_number,website,url,formatted_address,geometry,rating,user_ratings_total,types,opening_hours",
                        "key": self.api_key,
                    }
                    d_resp = await client.get(detail_url, params=params, timeout=8.0)
                    d_data = d_resp.json()
                    if d_data.get("status") == "OK":
                        return {**place, **d_data.get("result", {})}
                except Exception as e:
                    logger.warning(f"[GooglePlaces] Failed detail for place_id {place_id}: {e}")
                return place

            detailed_places = await asyncio.gather(*[get_details(p) for p in results])
            await self._notify("enriching emails", 70)

            # 3. Extract Emails & format leads
            formatted_leads: List[Dict[str, Any]] = []

            async def process_place(p: dict) -> Optional[Dict[str, Any]]:
                website = p.get("website")
                has_website = bool(website and str(website).strip() != "")

                if only_without_website and has_website:
                    return None

                loc = p.get("geometry", {}).get("location", {})
                lat = loc.get("lat")
                lng = loc.get("lng")

                phone = p.get("formatted_phone_number") or p.get("international_phone_number")
                rating = p.get("rating")
                reviews = p.get("user_ratings_total")

                # Category formatting
                types = p.get("types", [])
                category = "Business"
                if types:
                    clean_types = [t.replace("_", " ").title() for t in types if t not in ("point_of_interest", "establishment")]
                    category = clean_types[0] if clean_types else types[0].replace("_", " ").title()

                # Fast email check if website exists
                emails: list[str] = []
                if website:
                    emails = await self._extract_emails_from_url(client, website)

                lead_score = "High" if not has_website else "High" if emails else "Medium"

                return {
                    "business_name": p.get("name", "Unknown Business"),
                    "category": category,
                    "phone": phone,
                    "address": p.get("formatted_address") or p.get("vicinity") or "",
                    "website": website if has_website else None,
                    "email": emails[0] if emails else None,
                    "emails": emails,
                    "extra_phones": [p.get("international_phone_number")] if p.get("international_phone_number") and p.get("international_phone_number") != phone else [],
                    "whatsapp": phone,
                    "rating": float(rating) if rating is not None else None,
                    "reviews": int(reviews) if reviews is not None else None,
                    "place_id": p.get("place_id"),
                    "lat": float(lat) if lat is not None else None,
                    "lng": float(lng) if lng is not None else None,
                    "maps_url": p.get("url") or f"https://www.google.com/maps/place/?q=place_id:{p.get('place_id')}",
                    "lead_score": lead_score,
                    "source": "google_places_api",
                }

            processed = await asyncio.gather(*[process_place(p) for p in detailed_places])
            formatted_leads = [lead for lead in processed if lead is not None]

            await self._notify("finalizing", 90)
            logger.info(f"[GooglePlaces] Successfully prepared {len(formatted_leads)} enriched leads!")
            return formatted_leads
