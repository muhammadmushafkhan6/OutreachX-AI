import asyncio
import logging
import random
import sys
from functools import partial
from typing import Any, Callable, Dict, List

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
]


class GoogleMapsScraper:
    """Scrape leads from Google Maps using Playwright."""

    def __init__(self, notify_callback: Callable[[str, int], Any] | None = None):
        self.notify_callback = notify_callback

    async def _notify(self, status: str, progress: int):
        if self.notify_callback:
            if asyncio.iscoroutinefunction(self.notify_callback):
                await self.notify_callback(status, progress)
            else:
                self.notify_callback(status, progress)

    async def scrape(self, query: str, max_results: int = 100) -> List[Dict[str, Any]]:
        """Main entry point for scraping Google Maps."""
        if sys.platform == "win32":
            loop = asyncio.get_running_loop()
            return await loop.run_in_executor(None, partial(self._scrape_sync, query, max_results))
        
        return await self._scrape_async(query, max_results)

    def _scrape_sync(self, query: str, max_results: int = 100) -> List[Dict[str, Any]]:
        from playwright.sync_api import sync_playwright
        
        results = []
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(user_agent=random.choice(USER_AGENTS))
            page = context.new_page()
            
            try:
                # 1. Open Google Maps
                # Using 'commit' to get past the initial navigation quickly
                try:
                    page.goto("https://www.google.com/maps", wait_until="commit", timeout=60000)
                except Exception as e:
                    logger.warning(f"Initial goto timeout/error: {e}")

                # Wait for search box specifically rather than the whole page state
                search_box = page.wait_for_selector("input#searchboxinput", timeout=60000)
                
                # 2. Search query
                search_box.fill(query)
                page.keyboard.press("Enter")
                
                # 3. Wait for results
                page.wait_for_selector("div[role='feed']", timeout=30000)
                
                # 4. Scroll to load more
                listings = []
                attempts = 0
                while len(listings) < max_results and attempts < 5:
                    page.evaluate('document.querySelector("div[role=\'feed\']").scrollBy(0, 1000)')
                    page.wait_for_timeout(2000)
                    listings = page.query_selector_all("div[role='article']")
                    attempts += 1
                
                # 5. Extract data from each listing
                for i, listing in enumerate(listings[:max_results]):
                    try:
                        listing.click()
                        page.wait_for_timeout(2000) # Wait for details to load
                        
                        data = {
                            "business_name": self._get_text(page, "h1"),
                            "category": self._get_text(page, "button[data-item-id='address'] + div"), # Rough selector
                            "address": self._get_text(page, "button[data-item-id='address']"),
                            "website": self._get_attr(page, "a[data-item-id='authority']", "href"),
                            "phone": self._get_text(page, "button[data-tooltip='Copy phone number']"),
                            "rating": self._get_float(page, "span.ceNzR"), # Star rating
                            "reviews": self._get_int(page, "span.jANrlb"), # Review count
                            "maps_url": page.url,
                        }
                        results.append(data)
                    except Exception as e:
                        logger.warning("Failed to extract listing %s: %s", i, e)
                        
                return results
            finally:
                browser.close()

    async def _scrape_async(self, query: str, max_results: int) -> List[Dict[str, Any]]:
        from playwright.async_api import async_playwright
        
        results = []
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context(user_agent=random.choice(USER_AGENTS))
            page = await context.new_page()
            
            try:
                await self._notify("searching maps", 10)
                try:
                    await page.goto("https://www.google.com/maps", wait_until="commit", timeout=60000)
                except Exception as e:
                    logger.warning(f"Initial async goto timeout/error: {e}")

                search_box = await page.wait_for_selector("input#searchboxinput", timeout=60000)
                await search_box.fill(query)
                await page.keyboard.press("Enter")
                
                await self._notify("scrolling listings", 30)
                await page.wait_for_selector("div[role='feed']", timeout=30000)
                
                # Scroll loop
                for _ in range(3):
                    await page.evaluate('document.querySelector("div[role=\'feed\']").scrollBy(0, 2000)')
                    await asyncio.sleep(2)
                
                listings = await page.query_selector_all("div[role='article']")
                total = min(len(listings), max_results)
                
                await self._notify(f"extracting {total} businesses", 50)
                
                for i in range(total):
                    try:
                        # Re-fetch listings as they might go stale
                        current_listings = await page.query_selector_all("div[role='article']")
                        if i >= len(current_listings): break
                        
                        await current_listings[i].click()
                        await asyncio.sleep(2)
                        
                        data = {
                            "business_name": await self._get_text_async(page, "h1"),
                            "category": await self._get_text_async(page, "button[data-value='Category']"),
                            "address": await self._get_text_async(page, "button[data-item-id='address']"),
                            "website": await self._get_attr_async(page, "a[data-item-id='authority']", "href"),
                            "phone": await self._get_text_async(page, "button[data-tooltip='Copy phone number']"),
                            "rating": await self._get_float_async(page, "div.F7kYv div.fontBodyMedium span[aria-hidden='true']"),
                            "reviews": await self._get_int_async(page, "div.F7kYv div.fontBodyMedium span[aria-label*='reviews']"),
                            "maps_url": page.url,
                        }
                        results.append(data)
                        progress = 50 + int((i + 1) / total * 40)
                        await self._notify(f"extracted {i+1}/{total}", progress)
                    except Exception as e:
                        logger.warning("Failed to extract listing %s: %s", i, e)
                
                return results
            finally:
                await browser.close()

    def _get_text(self, page, selector) -> str | None:
        el = page.query_selector(selector)
        return el.inner_text().strip() if el else None

    def _get_attr(self, page, selector, attr) -> str | None:
        el = page.query_selector(selector)
        return el.get_attribute(attr) if el else None

    def _get_float(self, page, selector) -> float | None:
        text = self._get_text(page, selector)
        if text:
            try: return float(text.replace(",", "."))
            except: pass
        return None

    def _get_int(self, page, selector) -> int | None:
        text = self._get_text(page, selector)
        if text:
            import re
            nums = re.findall(r'\d+', text.replace(".", "").replace(",", ""))
            if nums: return int(nums[0])
        return None

    async def _get_text_async(self, page, selector) -> str | None:
        el = await page.query_selector(selector)
        return (await el.inner_text()).strip() if el else None

    async def _get_attr_async(self, page, selector, attr) -> str | None:
        el = await page.query_selector(selector)
        return await el.get_attribute(attr) if el else None

    async def _get_float_async(self, page, selector) -> float | None:
        text = await self._get_text_async(page, selector)
        if text:
            try: return float(text.replace(",", "."))
            except: pass
        return None

    async def _get_int_async(self, page, selector) -> int | None:
        text = await self._get_text_async(page, selector)
        if text:
            import re
            nums = re.findall(r'\d+', text.replace(".", "").replace(",", ""))
            if nums: return int(nums[0])
        return None
