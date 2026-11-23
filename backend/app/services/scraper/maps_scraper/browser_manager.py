import random
import asyncio
import logging
from typing import List, Optional
from playwright.async_api import Page, BrowserContext, Browser, async_playwright
import playwright_stealth
from app.config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
]

class BrowserManager:
    def __init__(self):
        self.playwright = None
        self.browser = None

    async def start_browser(self, headless: bool = True) -> Browser:
        if not self.playwright:
            self.playwright = await async_playwright().start()
        
        self.browser = await self.playwright.chromium.launch(
            headless=headless,
            args=["--disable-blink-features=AutomationControlled", "--no-sandbox"]
        )
        return self.browser

    async def create_context(self) -> BrowserContext:
        if not self.browser:
            await self.start_browser()
            
        context = await self.browser.new_context(
            user_agent=random.choice(USER_AGENTS),
            viewport={'width': 1920, 'height': 1080}
        )
        return context

    async def close_all(self):
        if self.browser:
            await self.browser.close()
        if self.playwright:
            await self.playwright.stop()
