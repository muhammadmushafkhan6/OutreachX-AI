import logging

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}


async def fetch_html_http(url: str) -> str:
    timeout = httpx.Timeout(settings.scraper_timeout_ms / 1000, connect=15.0)
    async with httpx.AsyncClient(
        follow_redirects=True,
        timeout=timeout,
        headers=DEFAULT_HEADERS,
    ) as client:
        response = await client.get(url)
        if response.status_code == 403:
            raise RuntimeError(
                "Site blocked automated access (403 Forbidden). "
                "Try another URL — large sites like TripAdvisor often block scrapers."
            )
        response.raise_for_status()
        text = response.text
        if len(text.strip()) < 200:
            raise RuntimeError(f"Response too small ({len(text)} bytes) — site may block bots")
        logger.info("HTTP fetch OK for %s (%s bytes)", url, len(text))
        return text
