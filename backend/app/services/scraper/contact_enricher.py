import logging
from urllib.parse import urljoin, urlparse

from app.config import get_settings
from app.services.scraper.html_parser import HTMLParser
from app.services.scraper.website_fetcher import WebsiteFetcher

logger = logging.getLogger(__name__)
settings = get_settings()

# Common paths when footer links are missing or JS-rendered
COMMON_CONTACT_PATHS = (
    "/contact",
    "/contact-us",
    "/contactus",
    "/about",
    "/about-us",
    "/support",
    "/help",
    "/get-in-touch",
    "/customer-service",
)


async def enrich_contact_data(
    fetcher: WebsiteFetcher,
    parser: HTMLParser,
    start_url: str,
    data: dict,
) -> dict:
    """Crawl homepage + contact/about pages to find emails and phones."""
    parsed = urlparse(start_url)
    base = f"{parsed.scheme}://{parsed.netloc}"
    host = (parsed.hostname or "").lower()

    candidates: list[str] = []
    seen: set[str] = set()

    def add(url: str) -> None:
        p = urlparse(url)
        if (p.hostname or "").lower() != host:
            return
        if url in seen:
            return
        seen.add(url)
        candidates.append(url)

    add(start_url)
    for link in data.get("contact_pages") or []:
        add(link)
    for path in COMMON_CONTACT_PATHS:
        add(urljoin(base, path))

    emails: set[str] = set(data.get("emails") or [])
    phones: set[str] = set(data.get("phones") or [])
    social: dict[str, str] = dict(data.get("social_links") or {})
    visited_pages: list[str] = []

    max_pages = settings.contact_crawl_max_pages
    for page_url in candidates[:max_pages]:
        try:
            if page_url == start_url:
                html = None  # already parsed into data
                page_data = data
            else:
                logger.info("Contact crawl: %s", page_url)
                html = await fetcher.fetch_html(page_url)
                page_data = parser.parse(html, base)
            visited_pages.append(page_url)
            emails.update(page_data.get("emails") or [])
            phones.update(page_data.get("phones") or [])
            social.update(page_data.get("social_links") or {})
            if emails and phones:
                break
        except Exception as e:
            logger.warning("Contact page skip %s: %s", page_url, e)

    data["emails"] = HTMLParser.filter_emails(list(emails))
    data["phones"] = HTMLParser.filter_phones(list(phones))
    data["social_links"] = social
    data["contact_pages"] = visited_pages[:15]
    return data
