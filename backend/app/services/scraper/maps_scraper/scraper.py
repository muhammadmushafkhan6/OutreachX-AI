import asyncio
import logging
import random
from typing import Callable, Any, List, Dict, Optional
from playwright.async_api import Page, TimeoutError as PlaywrightTimeoutError
import playwright_stealth
from .browser_manager import BrowserManager
from .selectors import MapsSelectors

logger = logging.getLogger(__name__)

class MapsScraperV2:
    def __init__(self, notify_callback: Callable[[str, int], Any] | None = None):
        self.notify_callback = notify_callback
        self.browser_manager = BrowserManager()

    async def _notify(self, status: str, progress: int):
        if self.notify_callback:
            await self.notify_callback(status, progress)

    async def _handle_popups(self, page: Page):
        """Detect and handle cookie consent popups, including those in iframes."""
        # Check main page
        for selector in MapsSelectors.CONSENT_BUTTONS:
            try:
                buttons = await page.query_selector_all(selector)
                for button in buttons:
                    if await button.is_visible():
                        logger.info(f"Handling consent popup on main page: {selector}")
                        await button.click()
                        await asyncio.sleep(2)
                        return True
            except Exception:
                continue
        
        # Check iframes
        for frame in page.frames:
            for selector in MapsSelectors.CONSENT_BUTTONS:
                try:
                    button = await frame.query_selector(selector)
                    if button and await button.is_visible():
                        logger.info(f"Handling consent popup in frame {frame.url}: {selector}")
                        await button.click()
                        await asyncio.sleep(2)
                        return True
                except Exception:
                    continue
        return False

    async def _check_captcha(self, page: Page):
        """Check if we are being blocked by a captcha."""
        for selector in MapsSelectors.CAPTCHA_INDICATORS:
            if await page.query_selector(selector):
                logger.warning("CAPTCHA detected!")
                return True
        return False

    async def _find_search_box(self, page: Page):
        """Try multiple selectors to find the search box."""
        for selector in MapsSelectors.SEARCH_INPUTS:
            try:
                el = await page.wait_for_selector(selector, timeout=5000, state="visible")
                if el:
                    return el
            except Exception:
                continue
        return None

    async def scrape(self, query: str, max_results: int = 10, retries: int = 3) -> List[Dict[str, Any]]:
        attempt = 0
        last_error = ""

        while attempt < retries:
            try:
                return await self._execute_scrape(query, max_results)
            except Exception as e:
                attempt += 1
                last_error = f"{type(e).__name__}: {str(e)}"
                logger.error(f"Scrape attempt {attempt} failed: {last_error}")
                await self._notify(f"retrying (attempt {attempt}/{retries})", 10 + attempt * 5)
                if attempt < retries:
                    await asyncio.sleep(5)
            finally:
                await self.browser_manager.close_all()

        raise Exception(f"Maps Scrape Failed: {last_error}")

    async def _execute_scrape(self, query: str, max_results: int) -> List[Dict[str, Any]]:
        # 1. Start Browser & Stealth
        await self._notify("opening google maps", 5)
        # Use headless=True for production
        browser = await self.browser_manager.start_browser(headless=True)
        context = await self.browser_manager.create_context()
        page = await context.new_page()
        
        # Apply stealth with error handling
        try:
            await playwright_stealth.stealth_async(page)
        except Exception as e:
            logger.warning(f"Stealth failed: {e}")
        
        # 2. Go to Maps
        try:
            # Direct search URL is much more reliable
            search_url = f"https://www.google.com/maps/search/{query.replace(' ', '+')}"
            logger.info(f"Navigating to: {search_url}")
            await page.goto(search_url, wait_until="domcontentloaded", timeout=60000)
        except Exception as e:
            logger.warning(f"Initial search navigation failed: {e}")
            await page.goto("https://www.google.com/maps", wait_until="commit", timeout=60000)
        
        # 3. Handle Consent (Crucial for Google)
        await asyncio.sleep(5) # Wait for potential popups
        await self._notify("handling consent popup", 10)
        await self._handle_popups(page)
        
        # 4. Wait for results to load
        await self._notify("searching businesses", 20)
        try:
            # Wait for either result articles or a "no results" indicator
            await page.wait_for_selector(MapsSelectors.BUSINESS_ARTICLE, timeout=30000)
        except Exception:
            if await self._check_captcha(page):
                raise Exception("blocked_by_captcha")
            # If search box is visible, maybe direct URL didn't work, try typing
            search_box = await self._find_search_box(page)
            if search_box:
                await search_box.click()
                await page.keyboard.press("Control+A")
                await page.keyboard.press("Backspace")
                await page.keyboard.type(query, delay=100)
                await page.keyboard.press("Enter")
                await page.wait_for_selector(MapsSelectors.BUSINESS_ARTICLE, timeout=30000)
            else:
                raise Exception("no_results_found_or_timeout")

        # 5. Scroll results
        await self._notify("scrolling listings", 40)
        for _ in range(3):
            await page.evaluate(f'document.querySelector("{MapsSelectors.RESULT_FEED}").scrollBy(0, 2000)')
            await asyncio.sleep(2)
            
        # 6. Extract Data
        listings = await page.query_selector_all(MapsSelectors.BUSINESS_ARTICLE)
        results = []
        await self._notify(f"analyzing {len(listings)} listings", 50)
        
        extracted_count = 0
        for i in range(len(listings)):
            if extracted_count >= max_results:
                break
                
            try:
                # Re-fetch listings to avoid stale elements
                current_listings = await page.query_selector_all(MapsSelectors.BUSINESS_ARTICLE)
                if i >= len(current_listings): break
                
                await current_listings[i].scroll_into_view_if_needed()
                await current_listings[i].click()
                await asyncio.sleep(2.5) # Wait for detail pane to load fully
                
                website = await self._get_attr(page, MapsSelectors.WEBSITE, "href")
                
                # CRITICAL: Only extract if NO website is found
                if website:
                    logger.info(f"Skipping {await self._get_text(page, MapsSelectors.TITLE)} because it has a website.")
                    continue

                data = {
                    "business_name": await self._get_text(page, MapsSelectors.TITLE),
                    "category": await self._get_text(page, MapsSelectors.CATEGORY),
                    "address": await self._get_text(page, MapsSelectors.ADDRESS),
                    "website": None,
                    "phone": await self._get_text(page, MapsSelectors.PHONE),
                    "rating": await self._get_float(page, MapsSelectors.RATING),
                    "reviews": await self._get_int(page, MapsSelectors.REVIEWS),
                    "maps_url": page.url,
                }
                
                if not data["business_name"]:
                    continue
                    
                results.append(data)
                extracted_count += 1
                await self._notify(f"found {extracted_count} leads without website", 50 + int((extracted_count/max_results)*40))
            except Exception as e:
                logger.warning(f"Failed to extract item {i}: {e}")
                continue
                
        return results

    async def _get_text(self, page: Page, selector: str) -> Optional[str]:
        try:
            el = await page.query_selector(selector)
            return (await el.inner_text()).strip() if el else None
        except: return None

    async def _get_attr(self, page: Page, selector: str, attr: str) -> Optional[str]:
        try:
            el = await page.query_selector(selector)
            return await el.get_attribute(attr) if el else None
        except: return None

    async def _get_float(self, page: Page, selector: str) -> Optional[float]:
        text = await self._get_text(page, selector)
        if text:
            try: return float(text.replace(",", "."))
            except: pass
        return None

    async def _get_int(self, page: Page, selector: str) -> Optional[int]:
        text = await self._get_text(page, selector)
        if text:
            import re
            nums = re.findall(r'\d+', text.replace(".", "").replace(",", ""))
            if nums: return int(nums[0])
        return None
