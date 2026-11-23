import logging
from urllib.parse import urlparse

from app.services.scraper.http_fetcher import fetch_html_http
from app.services.scraper.playwright_scraper import PlaywrightScraper

logger = logging.getLogger(__name__)

# These domains routinely return 403 / bot challenges — fail fast with a clear message
BLOCKED_DOMAINS = (
    "tripadvisor.com",
    "amazon.com",
    "amazon.in",
    "facebook.com",
    "instagram.com",
    "linkedin.com",
    "twitter.com",
    "x.com",
)


def _fmt_error(label: str, exc: BaseException) -> str:
    msg = str(exc).strip() or repr(exc)
    return f"{label}: {type(exc).__name__}: {msg}"


class WebsiteFetcher:
    """Try Playwright first, then plain HTTP (works when headless Chromium is blocked)."""

    def __init__(self) -> None:
        self._playwright = PlaywrightScraper()

    @staticmethod
    def _check_blocked(url: str) -> None:
        host = (urlparse(url).hostname or "").lower()
        for domain in BLOCKED_DOMAINS:
            if host == domain or host.endswith(f".{domain}"):
                raise RuntimeError(
                    f"{domain} blocks automated scraping. "
                    "Use a business homepage instead (e.g. stripe.com, shopify.com, vercel.com)."
                )

    async def fetch_html(self, url: str) -> str:
        self._check_blocked(url)
        errors: list[str] = []

        try:
            return await self._playwright.fetch_html(url)
        except Exception as e:
            errors.append(_fmt_error("Playwright", e))
            logger.warning("Playwright failed for %s — trying HTTP fallback", url)

        try:
            return await fetch_html_http(url)
        except Exception as e:
            errors.append(_fmt_error("HTTP", e))

        raise RuntimeError(f"Failed to scrape {url}. {' | '.join(errors)}")
