import logging
import asyncio
from typing import List, Dict, Any, Optional, Callable
from apify_client import ApifyClient
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


def _get_val(obj, key):
    if isinstance(obj, dict): return obj.get(key)
    return getattr(obj, key, None)


def _dataset_id(run: Any) -> str | None:
    return _get_val(run, "defaultDatasetId") or _get_val(run, "default_dataset_id")


def _extract_first_email(emails: Any) -> Optional[str]:
    if not emails:
        return None
    if isinstance(emails, str):
        return emails.strip() or None
    if isinstance(emails, list):
        for e in emails:
            if e and isinstance(e, str) and "@" in e:
                return e.strip()
    if isinstance(emails, dict):
        for v in emails.values():
            if v and isinstance(v, str) and "@" in v:
                return v.strip()
    return None


def _extract_all_emails(emails: Any) -> List[str]:
    result: List[str] = []
    if not emails:
        return result
    if isinstance(emails, str) and "@" in emails:
        result.append(emails.strip())
    elif isinstance(emails, list):
        for e in emails:
            if e and isinstance(e, str) and "@" in e:
                result.append(e.strip())
    elif isinstance(emails, dict):
        for v in emails.values():
            if isinstance(v, list):
                for ev in v:
                    if ev and isinstance(ev, str) and "@" in ev:
                        result.append(ev.strip())
            elif v and isinstance(v, str) and "@" in v:
                result.append(v.strip())
    return list(dict.fromkeys(result))


class ApifyMapsScraper:
    """
    Google Maps Scraper using Apify actors.
    Supports:
      - compass/crawler-google-places (default, fast & cheap)
      - vortex_data/google-maps (with email enrichment, social profiles, WhatsApp links)
      - lukaskrivka/google-maps-with-contact-details (Email Extractor: dedicated emails + phones + socials)
      - x_guru/google-maps-email-extractor (Email Outreach: optimized for business email extraction)
    """

    ACTOR_COMPASS = "compass/crawler-google-places"
    ACTOR_VORTEX = "vortex_data/google-maps"
    ACTOR_EMAIL_EXTRACTOR = "lukaskrivka/google-maps-with-contact-details"
    ACTOR_XGURU_EMAIL_EXTRACTOR = "x_guru/google-maps-email-extractor"

    def __init__(self, notify_callback: Optional[Callable[[str, int], Any]] = None):
        self.notify_callback = notify_callback
        self.client = ApifyClient(settings.apify_api_token) if settings.apify_api_token else None

    async def _notify(self, status: str, progress: int):
        if self.notify_callback:
            if asyncio.iscoroutinefunction(self.notify_callback):
                await self.notify_callback(status, progress)
            else:
                self.notify_callback(status, progress)

    async def _poll_and_get_items(
        self,
        run: Any,
        max_wait: int = 600,
        poll_interval: int = 5,
        progress_start: int = 25,
        progress_end: int = 70,
    ) -> List[Dict[str, Any]]:
        run_id = _get_val(run, "id")
        loop = asyncio.get_running_loop()
        waited = 0

        while waited < max_wait:
            run = await loop.run_in_executor(
                None,
                lambda: self.client.run(run_id).get(),
            )
            status = _get_val(run, "status")

            if status == "SUCCEEDED":
                break
            elif status in ["FAILED", "ABORTED", "TIMED-OUT"]:
                raise Exception(f"Apify Maps actor failed with status: {status}")

            waited += poll_interval
            progress = progress_start + min(
                progress_end - progress_start,
                int((waited / (max_wait * 0.6)) * (progress_end - progress_start))
            )
            await self._notify("scraping", progress)
            await asyncio.sleep(poll_interval)

        dataset_id = _dataset_id(run)
        if not dataset_id:
            logger.warning("Apify Maps run returned no dataset id")
            return []

        return await loop.run_in_executor(
            None,
            lambda: self.client.dataset(dataset_id).list_items().items,
        )

    async def scrape(
        self,
        query: str,
        limit: int = 100,
        only_without_website: bool = False,
        enrich_contacts: bool = False,
        use_vortex_actor: bool = False,
        use_email_extractor_actor: bool = False,
    ) -> List[Dict[str, Any]]:
        if use_email_extractor_actor:
            try:
                return await self.scrape_email_extractor(
                    query=query,
                    limit=limit,
                    only_without_website=only_without_website,
                )
            except Exception as e:
                logger.warning(f"Email extractor actor failed ({e}), falling back to standard compass scraper...")

        if use_vortex_actor:
            try:
                return await self.scrape_vortex(
                    query=query,
                    limit=limit,
                    enrich_contacts=enrich_contacts,
                )
            except Exception as e:
                logger.warning(f"Vortex actor failed ({e}), falling back to standard compass scraper...")

        if not self.client:
            logger.error("Apify API Token missing")
            raise Exception("apify_token_missing")

        await self._notify("processing", 10)

        run_input: dict[str, Any] = {
            "searchStringsArray": [query],
            "maxCrawledPlacesPerSearch": limit,
            "language": "en",
            "website": "withoutWebsite" if only_without_website else "allPlaces",
            "scrapePlaceDetailPage": enrich_contacts,
            "scrapeContacts": enrich_contacts,
            "maximumLeadsEnrichmentRecords": limit if enrich_contacts else 0,
            "maxReviews": 0,
            "maxImages": 0,
            "skipClosedPlaces": True,
            "includeWebResults": False,
        }

        try:
            mode = "no-website only" if only_without_website else "all places"
            if enrich_contacts:
                mode += " + contact enrichment"
            logger.info("Apify Maps (compass) scrape: query=%r limit=%s mode=%s", query, limit, mode)
            await self._notify("scraping", 25)

            loop = asyncio.get_running_loop()
            run = await loop.run_in_executor(
                None,
                lambda: self.client.actor(self.ACTOR_COMPASS).start(run_input=run_input),
            )

            dataset_items = await self._poll_and_get_items(run, max_wait=300)
            await self._notify("scraping", 85)

            normalized_results = []
            for item in dataset_items:
                emails_raw = item.get("emails") or item.get("email")
                all_emails = _extract_all_emails(emails_raw)
                primary_email = _extract_first_email(emails_raw)
                social = item.get("socialMedias") or item.get("socialLinks") or {}
                if isinstance(social, list):
                    social_dict: Dict[str, str] = {}
                    for s in social:
                        if isinstance(s, dict):
                            for k, v in s.items():
                                if v:
                                    social_dict[k] = str(v)
                    social = social_dict

                normalized_results.append({
                    "business_name": item.get("title") or item.get("businessName"),
                    "category": item.get("categoryName") or item.get("category"),
                    "phone": item.get("phone") or item.get("phoneNumber"),
                    "website": item.get("website") or item.get("websiteUrl"),
                    "address": item.get("address") or item.get("fullAddress"),
                    "rating": item.get("totalScore") or item.get("rating"),
                    "reviews": item.get("reviewsCount") or item.get("reviewCount"),
                    "maps_url": item.get("url") or item.get("googleMapsUrl"),
                    "email": primary_email,
                    "emails": all_emails,
                    "whatsapp": item.get("whatsApp") or item.get("whatsappNumber"),
                    "social_links": social if isinstance(social, dict) else {},
                    "place_id": item.get("placeId") or item.get("googleId"),
                    "lat": item.get("lat"),
                    "lng": item.get("lng"),
                })

            return normalized_results

        except Exception as e:
            logger.error("Apify compass scraping failed: %s", e)
            raise e

    async def scrape_vortex(
        self,
        query: str,
        limit: int = 100,
        enrich_contacts: bool = True,
    ) -> List[Dict[str, Any]]:
        """
        Use vortex_data/google-maps actor for richer data:
        business emails, website emails, extra phones, WhatsApp links,
        social profiles (Facebook, Instagram, LinkedIn, Twitter/X, Tripadvisor, Yelp, Foursquare).
        """
        if not self.client:
            logger.error("Apify API Token missing")
            raise Exception("apify_token_missing")

        await self._notify("processing", 10)

        run_input: dict[str, Any] = {
            "searchTerms": [query],
            "limit": limit,
            "language": "en",
            "skipClosed": True,
        }

        if enrich_contacts:
            run_input.update({
                "enrichPlaceData": True,
                "getEmails": True,
                "getSocialMedia": True,
                "getExtraPhones": True,
            })

        try:
            logger.info("Apify Maps (vortex_data) scrape: query=%r limit=%s enrich=%s", query, limit, enrich_contacts)
            await self._notify("scraping", 20)

            loop = asyncio.get_running_loop()
            run = await loop.run_in_executor(
                None,
                lambda: self.client.actor(self.ACTOR_VORTEX).start(run_input=run_input),
            )

            dataset_items = await self._poll_and_get_items(
                run,
                max_wait=600,
                progress_start=20,
                progress_end=75,
            )
            await self._notify("scraping", 85)

            normalized_results = []
            for item in dataset_items:
                title = (
                    item.get("title")
                    or item.get("name")
                    or item.get("businessName")
                )
                category = (
                    item.get("categoryName")
                    or item.get("primaryCategory")
                    or item.get("category")
                )
                if isinstance(category, dict):
                    category = category.get("name") or str(category)

                phone = (
                    item.get("phone")
                    or item.get("phoneNumber")
                    or item.get("formattedPhone")
                )
                website = (
                    item.get("website")
                    or item.get("websiteUrl")
                    or item.get("domain")
                )
                address = (
                    item.get("address")
                    or item.get("fullAddress")
                    or item.get("formattedAddress")
                )
                rating = item.get("totalScore") or item.get("rating") or item.get("averageRating")
                reviews = item.get("reviewsCount") or item.get("reviewCount") or item.get("numberOfReviews")
                maps_url = (
                    item.get("url")
                    or item.get("googleMapsUrl")
                    or item.get("mapsUrl")
                )

                emails_raw = (
                    item.get("emails")
                    or item.get("email")
                    or item.get("websiteEmails")
                    or item.get("publicEmails")
                )
                all_emails = _extract_all_emails(emails_raw)
                extra_phones = item.get("extraPhones") or item.get("additionalPhones") or []
                primary_email = all_emails[0] if all_emails else _extract_first_email(item.get("email"))

                social_links: Dict[str, str] = {}
                social_raw = (
                    item.get("socialMedias")
                    or item.get("socialLinks")
                    or item.get("socialProfiles")
                    or {}
                )
                if isinstance(social_raw, dict):
                    for key, val in social_raw.items():
                        if val:
                            social_links[key] = str(val) if not isinstance(val, str) else val
                elif isinstance(social_raw, list):
                    for s in social_raw:
                        if isinstance(s, dict):
                            for k, v in s.items():
                                if v:
                                    social_links[k] = str(v)

                for direct_key in [
                    "facebook", "facebookUrl",
                    "instagram", "instagramUrl",
                    "linkedin", "linkedinUrl",
                    "twitter", "twitterUrl", "xUrl",
                    "tripadvisor", "tripadvisorUrl",
                    "yelp", "yelpUrl",
                    "foursquare", "foursquareUrl",
                    "youtube", "youtubeUrl",
                    "whatsapp", "whatsApp", "whatsappUrl",
                ]:
                    if direct_key in item and item[direct_key]:
                        clean_key = direct_key.replace("Url", "").lower()
                        if clean_key not in social_links:
                            social_links[clean_key] = str(item[direct_key])

                normalized_results.append({
                    "business_name": title,
                    "category": category,
                    "phone": phone,
                    "website": website,
                    "address": address,
                    "rating": rating,
                    "reviews": reviews,
                    "maps_url": maps_url,
                    "email": primary_email,
                    "emails": all_emails,
                    "extra_phones": extra_phones if isinstance(extra_phones, list) else [],
                    "whatsapp": item.get("whatsApp") or item.get("whatsapp") or social_links.get("whatsapp"),
                    "social_links": social_links,
                    "place_id": item.get("placeId") or item.get("googleId") or item.get("id"),
                    "lat": item.get("lat") or item.get("latitude"),
                    "lng": item.get("lng") or item.get("longitude"),
                    "opening_hours": item.get("openingHours") or item.get("hours"),
                })

            return normalized_results

        except Exception as e:
            logger.error("Apify vortex scraping failed: %s", e)
            raise e

    async def scrape_email_extractor(
        self,
        query: str,
        limit: int = 100,
        only_without_website: bool = False,
    ) -> List[Dict[str, Any]]:
        """
        Use lukaskrivka/google-maps-with-contact-details (Google Maps Email Extractor).
        Extracts: email addresses (public + website emails), phone numbers,
        social media (LinkedIn, Twitter/X, YouTube, TikTok, Facebook, Instagram,
        Pinterest, Discord), website, address, location, zipcode.
        Best actor for high-quality email + phone extraction.
        """
        if not self.client:
            logger.error("Apify API Token missing")
            raise Exception("apify_token_missing")

        await self._notify("processing", 10)

        run_input: dict[str, Any] = {
            "searchStringsOrGoogleUrls": [query],
            "maxItems": limit,
            "language": "en",
            "skipClosedPlaces": True,
            "scrapeEmails": True,
            "scrapeSocialMedia": True,
            "scrapePhones": True,
            "showPercevalWebsite": True,
            "minimumRating": 0,
            "oneReviewMinimum": False,
        }

        try:
            mode = "email extractor"
            if only_without_website:
                mode += " + no-website filter"
            logger.info(
                "Apify Maps (lukaskrivka/email-extractor) scrape: query=%r limit=%s mode=%s",
                query, limit, mode,
            )
            await self._notify("scraping", 20)

            loop = asyncio.get_running_loop()
            run = await loop.run_in_executor(
                None,
                lambda: self.client.actor(self.ACTOR_EMAIL_EXTRACTOR).start(run_input=run_input),
            )

            dataset_items = await self._poll_and_get_items(
                run,
                max_wait=600,
                progress_start=20,
                progress_end=80,
            )
            await self._notify("scraping", 85)

            normalized_results = []
            for item in dataset_items:
                title = (
                    item.get("title")
                    or item.get("name")
                    or item.get("businessName")
                    or item.get("placeName")
                )
                category = (
                    item.get("categoryName")
                    or item.get("primaryCategory")
                    or item.get("category")
                    or item.get("type")
                )
                if isinstance(category, dict):
                    category = category.get("name") or str(category)

                phone = (
                    item.get("phone")
                    or item.get("phoneNumber")
                    or item.get("formattedPhone")
                    or item.get("phoneNumbers")
                )
                if isinstance(phone, list):
                    phone = phone[0] if phone else None

                website = (
                    item.get("website")
                    or item.get("websiteUrl")
                    or item.get("domain")
                    or item.get("companyWebsite")
                )
                address = (
                    item.get("address")
                    or item.get("fullAddress")
                    or item.get("formattedAddress")
                    or item.get("streetAddress")
                )
                rating = (
                    item.get("totalScore")
                    or item.get("rating")
                    or item.get("averageRating")
                    or item.get("stars")
                )
                reviews = (
                    item.get("reviewsCount")
                    or item.get("reviewCount")
                    or item.get("numberOfReviews")
                    or item.get("reviewCountText")
                )
                maps_url = (
                    item.get("url")
                    or item.get("googleMapsUrl")
                    or item.get("mapsUrl")
                    or item.get("googleUrl")
                )
                zipcode = (
                    item.get("zipcode")
                    or item.get("postalCode")
                    or item.get("zip")
                )
                location_field = (
                    item.get("location")
                    or item.get("city")
                    or item.get("state")
                )

                emails_raw = (
                    item.get("emails")
                    or item.get("email")
                    or item.get("websiteEmails")
                    or item.get("publicEmails")
                    or item.get("businessEmail")
                    or item.get("companyEmails")
                    or item.get("contactEmails")
                )
                all_emails = _extract_all_emails(emails_raw)
                direct_email = _extract_first_email(item.get("email"))
                if direct_email and direct_email not in all_emails:
                    all_emails.insert(0, direct_email)

                emails_from_list = _extract_all_emails(item.get("emailList"))
                for efl in emails_from_list:
                    if efl not in all_emails:
                        all_emails.append(efl)

                phones_raw = (
                    item.get("phoneNumbers")
                    or item.get("phones")
                    or item.get("additionalPhones")
                    or item.get("extraPhones")
                    or []
                )
                extra_phones: List[str] = []
                if isinstance(phones_raw, list):
                    for p in phones_raw:
                        if p and isinstance(p, str):
                            extra_phones.append(p.strip())
                        elif isinstance(p, dict):
                            for v in p.values():
                                if v and isinstance(v, str) and any(c.isdigit() for c in v):
                                    extra_phones.append(v.strip())
                elif isinstance(phones_raw, str):
                    extra_phones = [phones_raw.strip()]

                primary_email = all_emails[0] if all_emails else None

                social_links: Dict[str, str] = {}
                social_raw = (
                    item.get("socialMedias")
                    or item.get("socialLinks")
                    or item.get("socialProfiles")
                    or item.get("socialMedia")
                    or {}
                )
                if isinstance(social_raw, dict):
                    for key, val in social_raw.items():
                        if val:
                            if isinstance(val, list):
                                val = val[0]
                            social_links[str(key).lower()] = str(val) if not isinstance(val, str) else val
                elif isinstance(social_raw, list):
                    for s in social_raw:
                        if isinstance(s, dict):
                            for k, v in s.items():
                                if v:
                                    if isinstance(v, list):
                                        v = v[0]
                                    social_links[str(k).lower()] = str(v)

                for direct_key in [
                    "facebook", "facebookUrl", "facebookPage",
                    "instagram", "instagramUrl", "instagramProfile",
                    "linkedin", "linkedinUrl", "linkedinCompany",
                    "twitter", "twitterUrl", "twitterHandle",
                    "xUrl", "x",
                    "youtube", "youtubeUrl", "youtubeChannel",
                    "tiktok", "tiktokUrl", "tiktokHandle",
                    "pinterest", "pinterestUrl",
                    "discord", "discordUrl", "discordServer",
                    "tripadvisor", "tripadvisorUrl",
                    "yelp", "yelpUrl",
                    "whatsapp", "whatsApp", "whatsappUrl", "whatsAppNumber",
                ]:
                    if direct_key in item and item[direct_key]:
                        val = item[direct_key]
                        if isinstance(val, list):
                            val = val[0]
                        clean_key = (
                            direct_key
                            .replace("Url", "")
                            .replace("Handle", "")
                            .replace("Page", "")
                            .replace("Profile", "")
                            .replace("Company", "")
                            .replace("Channel", "")
                            .replace("Server", "")
                            .replace("Number", "")
                            .lower()
                        )
                        if clean_key == "x":
                            clean_key = "twitter"
                        if clean_key not in social_links:
                            social_links[clean_key] = str(val)

                if only_without_website and website:
                    continue

                normalized_results.append({
                    "business_name": title,
                    "category": category,
                    "phone": phone,
                    "website": website,
                    "address": address,
                    "zipcode": zipcode,
                    "location": location_field if isinstance(location_field, str) else None,
                    "rating": rating,
                    "reviews": reviews,
                    "maps_url": maps_url,
                    "email": primary_email,
                    "emails": all_emails,
                    "extra_phones": extra_phones,
                    "whatsapp": (
                        item.get("whatsApp")
                        or item.get("whatsapp")
                        or item.get("whatsAppNumber")
                        or social_links.get("whatsapp")
                    ),
                    "social_links": social_links,
                    "place_id": item.get("placeId") or item.get("googleId") or item.get("id") or item.get("cid"),
                    "lat": item.get("lat") or item.get("latitude"),
                    "lng": item.get("lng") or item.get("longitude"),
                    "opening_hours": item.get("openingHours") or item.get("hours") or item.get("workingHours"),
                })

            return normalized_results

        except Exception as e:
            logger.error("Apify email-extractor scraping failed: %s", e)
            raise e

    async def scrape_xguru_email_extractor(
        self,
        keyword: str,
        location: str | None = None,
        max_results: int = 100,
        contact_result_mode: str = "emailsOnly",
        include_personal_data: bool = False,
    ) -> List[Dict[str, Any]]:
        """
        Use x_guru/google-maps-email-extractor (Google Maps Email Extractor ✅).
        Optimized actor for public business email extraction:
        - Searches Google Maps by keyword + location
        - Automatically visits business websites to scrape emails, phones, social links
        - Best for Email Outreach lead generation
        Pricing: $1.50 / 1,000 saved email leads
        """
        if not self.client:
            logger.error("Apify API Token missing")
            raise Exception("apify_token_missing")

        await self._notify("processing", 10)

        run_input: dict[str, Any] = {
            "searchStringsArray": [keyword.strip()],
            "maxCrawledPlacesPerSearch": int(max_results),
            "contactResultMode": contact_result_mode,
            "includePersonalData": include_personal_data,
            "contactPagesLimit": 2,
            "contactScanMultiplier": 6,
            "language": "en",
            "website": "withWebsite",
        }
        if location and location.strip():
            run_input["locationQuery"] = location.strip()

        try:
            logger.info(
                "Apify x_guru email-extractor scrape: keyword=%r location=%r max_results=%s",
                keyword, location, max_results,
            )
            await self._notify("scraping", 20)

            loop = asyncio.get_running_loop()
            run = await loop.run_in_executor(
                None,
                lambda: self.client.actor(self.ACTOR_XGURU_EMAIL_EXTRACTOR).start(run_input=run_input),
            )

            dataset_items = await self._poll_and_get_items(
                run,
                max_wait=900,
                progress_start=20,
                progress_end=82,
            )
            await self._notify("scraping", 85)

            normalized_results = []
            for item in dataset_items:
                try:
                    title = (
                        item.get("title")
                        or item.get("name")
                        or item.get("businessName")
                        or item.get("placeName")
                    )
                    category = (
                        item.get("categoryName")
                        or item.get("primaryCategory")
                        or item.get("category")
                        or item.get("type")
                    )
                    if isinstance(category, dict):
                        category = category.get("name") or str(category)
                    if isinstance(category, list) and category:
                        first_cat = category[0]
                        category = first_cat.get("name") or str(first_cat) if isinstance(first_cat, dict) else str(first_cat)

                    phone = (
                        item.get("phone")
                        or item.get("phoneNumber")
                        or item.get("formattedPhone")
                        or item.get("phoneNumbers")
                        or item.get("phoneFormatted")
                    )
                    if isinstance(phone, list):
                        phone = phone[0] if phone else None

                    website = (
                        item.get("website")
                        or item.get("websiteUrl")
                        or item.get("domain")
                        or item.get("companyWebsite")
                        or item.get("webSite")
                    )
                    address = (
                        item.get("address")
                        or item.get("fullAddress")
                        or item.get("formattedAddress")
                        or item.get("streetAddress")
                    )
                    rating = (
                        item.get("totalScore")
                        or item.get("rating")
                        or item.get("averageRating")
                        or item.get("stars")
                        or item.get("score")
                    )
                    reviews = (
                        item.get("reviewsCount")
                        or item.get("reviewCount")
                        or item.get("numberOfReviews")
                        or item.get("reviewCountText")
                    )
                    maps_url = (
                        item.get("url")
                        or item.get("googleMapsUrl")
                        or item.get("mapsUrl")
                        or item.get("googleUrl")
                        or item.get("placeUrl")
                    )
                    zipcode = (
                        item.get("zipcode")
                        or item.get("postalCode")
                        or item.get("zip")
                    )
                    location_field = (
                        item.get("location")
                        or item.get("city")
                        or item.get("state")
                        or item.get("neighborhood")
                    )
                    cid = item.get("cid")
                    place_id = item.get("placeId") or item.get("googleId") or item.get("id") or cid
                    lat = item.get("lat") or item.get("latitude")
                    lng = item.get("lng") or item.get("longitude")

                    emails_raw = (
                        item.get("emails")
                        or item.get("email")
                        or item.get("websiteEmails")
                        or item.get("publicEmails")
                        or item.get("businessEmail")
                        or item.get("companyEmails")
                        or item.get("contactEmails")
                        or item.get("emailAddresses")
                    )
                    all_emails = _extract_all_emails(emails_raw)
                    direct_email = _extract_first_email(item.get("email"))
                    if direct_email and direct_email not in all_emails:
                        all_emails.insert(0, direct_email)

                    emails_from_list = _extract_all_emails(item.get("emailList"))
                    for efl in emails_from_list:
                        if efl not in all_emails:
                            all_emails.append(efl)

                    website_data = item.get("websiteData") or item.get("website_data") or {}
                    if isinstance(website_data, dict):
                        nested_emails = _extract_all_emails(website_data.get("emails"))
                        for ne in nested_emails:
                            if ne not in all_emails:
                                all_emails.append(ne)

                    phones_raw = (
                        item.get("phoneNumbers")
                        or item.get("phones")
                        or item.get("additionalPhones")
                        or item.get("extraPhones")
                        or item.get("allPhones")
                        or []
                    )
                    extra_phones: List[str] = []
                    if isinstance(phones_raw, list):
                        for p in phones_raw:
                            if p and isinstance(p, str):
                                extra_phones.append(p.strip())
                            elif isinstance(p, dict):
                                for v in p.values():
                                    if v and isinstance(v, str) and any(c.isdigit() for c in v):
                                        extra_phones.append(v.strip())
                    elif isinstance(phones_raw, str):
                        extra_phones = [phones_raw.strip()]

                    if extra_phones and phone and str(phone) not in [p.strip() for p in extra_phones]:
                        extra_phones.insert(0, str(phone))

                    primary_email = all_emails[0] if all_emails else None

                    social_links: Dict[str, str] = {}
                    social_raw = (
                        item.get("socialMedias")
                        or item.get("socialLinks")
                        or item.get("socialProfiles")
                        or item.get("socialMedia")
                        or {}
                    )
                    if isinstance(website_data, dict):
                        ws_social = website_data.get("socialMedias") or website_data.get("socialLinks") or website_data.get("linkedinUrls") or {}
                        if isinstance(ws_social, list):
                            for s in ws_social:
                                if isinstance(s, str):
                                    if "linkedin" in s.lower() and "linkedin" not in social_links:
                                        social_links["linkedin"] = s
                        elif isinstance(ws_social, dict):
                            for sk, sv in ws_social.items():
                                social_links[str(sk).lower()] = str(sv) if not isinstance(sv, str) else sv
                    if isinstance(social_raw, dict):
                        for key, val in social_raw.items():
                            if val:
                                if isinstance(val, list):
                                    val = val[0]
                                social_links[str(key).lower()] = str(val) if not isinstance(val, str) else val
                    elif isinstance(social_raw, list):
                        for s in social_raw:
                            if isinstance(s, dict):
                                for k, v in s.items():
                                    if v:
                                        if isinstance(v, list):
                                            v = v[0]
                                        social_links[str(k).lower()] = str(v)

                    for direct_key in [
                        "facebook", "facebookUrl", "facebookPage",
                        "instagram", "instagramUrl", "instagramProfile",
                        "linkedin", "linkedinUrl", "linkedinCompany", "linkedinUrls",
                        "twitter", "twitterUrl", "twitterHandle",
                        "xUrl", "x",
                        "youtube", "youtubeUrl", "youtubeChannel",
                        "tiktok", "tiktokUrl", "tiktokHandle",
                        "pinterest", "pinterestUrl",
                        "discord", "discordUrl", "discordServer",
                        "tripadvisor", "tripadvisorUrl",
                        "yelp", "yelpUrl",
                        "whatsapp", "whatsApp", "whatsappUrl", "whatsAppNumber",
                    ]:
                        if direct_key in item and item[direct_key]:
                            val = item[direct_key]
                            if isinstance(val, list):
                                val = val[0]
                            clean_key = (
                                direct_key
                                .replace("Url", "")
                                .replace("Handle", "")
                                .replace("Page", "")
                                .replace("Profile", "")
                                .replace("Company", "")
                                .replace("Channel", "")
                                .replace("Server", "")
                                .replace("Number", "")
                                .lower()
                            )
                            if clean_key == "x":
                                clean_key = "twitter"
                            if clean_key not in social_links:
                                social_links[clean_key] = str(val)

                    if contact_result_mode == "emailsOnly" and not primary_email:
                        continue

                    opening_hours = item.get("openingHours") or item.get("hours") or item.get("workingHours")

                    normalized_results.append({
                        "business_name": title,
                        "category": category,
                        "phone": phone,
                        "website": website,
                        "address": address,
                        "zipcode": zipcode,
                        "location": location_field if isinstance(location_field, str) else None,
                        "rating": rating,
                        "reviews": reviews,
                        "maps_url": maps_url,
                        "email": primary_email,
                        "emails": all_emails,
                        "extra_phones": extra_phones,
                        "whatsapp": (
                            item.get("whatsApp")
                            or item.get("whatsapp")
                            or item.get("whatsAppNumber")
                            or social_links.get("whatsapp")
                        ),
                        "social_links": social_links,
                        "place_id": place_id,
                        "cid": cid,
                        "lat": lat,
                        "lng": lng,
                        "opening_hours": opening_hours,
                    })
                except Exception as item_err:
                    logger.warning("Skipping malformed x_guru result item: %s", item_err)
                    continue

            return normalized_results

        except Exception as e:
            logger.error("Apify x_guru email-extractor scraping failed: %s", e)
            raise e
