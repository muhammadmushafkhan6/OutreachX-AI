import asyncio
import logging
import random
import sys
from functools import partial

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
]


def _fetch_html_sync(url: str) -> str:
    """Sync Playwright — reliable on Windows (avoids asyncio NotImplementedError)."""
    from playwright.sync_api import sync_playwright
    from playwright.sync_api import TimeoutError as PlaywrightTimeout

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent=random.choice(USER_AGENTS),
            viewport={"width": 1920, "height": 1080},
        )
        page = context.new_page()
        try:
            try:
                page.goto(url, wait_until="domcontentloaded", timeout=settings.scraper_timeout_ms)
            except PlaywrightTimeout as e:
                raise TimeoutError(f"Page goto timeout ({settings.scraper_timeout_ms}ms): {url}") from e
            try:
                page.wait_for_load_state("load", timeout=10_000)
            except PlaywrightTimeout:
                logger.warning("Load state timeout for %s — using partial HTML", url)
            html = page.content()
            if len(html.strip()) < 200:
                raise RuntimeError("Page HTML too small — site may block headless browser")
            return html
        finally:
            browser.close()


class PlaywrightScraper:
    """Headless browser scraper. Requires: pip install playwright && playwright install chromium"""

    async def fetch_html(self, url: str) -> str:
        try:
            from playwright.async_api import async_playwright  # noqa: F401
        except ImportError:
            raise RuntimeError(
                "Playwright not installed. Run: pip install playwright  then  playwright install chromium"
            )

        # Windows + uvicorn: async subprocess often raises NotImplementedError — use sync in thread
        if sys.platform == "win32":
            loop = asyncio.get_running_loop()
            return await loop.run_in_executor(None, partial(_fetch_html_sync, url))

        from playwright.async_api import async_playwright
        from playwright.async_api import TimeoutError as PlaywrightTimeout

        loop = asyncio.get_running_loop()
        last_error: Exception | None = None
        for attempt in range(settings.scraper_max_retries):
            try:
                return await self._fetch_once(url, async_playwright, PlaywrightTimeout)
            except NotImplementedError:
                logger.warning("Async Playwright NotImplementedError — using sync fallback")
                return await loop.run_in_executor(None, partial(_fetch_html_sync, url))
            except Exception as e:
                last_error = e
                logger.warning("Scrape attempt %s failed for %s: %s", attempt + 1, url, e)
                await asyncio.sleep(1 + attempt)
        detail = str(last_error).strip() if last_error else "unknown error"
        if last_error:
            detail = f"{type(last_error).__name__}: {detail}"
        raise RuntimeError(f"Failed to scrape {url} ({detail})")

    async def _fetch_once(self, url: str, async_playwright, PlaywrightTimeout) -> str:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context(
                user_agent=random.choice(USER_AGENTS),
                viewport={"width": 1920, "height": 1080},
            )
            page = await context.new_page()
            try:
                try:
                    await page.goto(url, wait_until="domcontentloaded", timeout=settings.scraper_timeout_ms)
                except PlaywrightTimeout as e:
                    raise TimeoutError(f"Page goto timeout ({settings.scraper_timeout_ms}ms): {url}") from e
                try:
                    await page.wait_for_load_state("load", timeout=10_000)
                except PlaywrightTimeout:
                    logger.warning("Load state timeout for %s — using partial HTML", url)
                html = await page.content()
                if len(html.strip()) < 200:
                    raise RuntimeError("Page HTML too small — site may block headless browser")
                return html
            finally:
                await browser.close()
