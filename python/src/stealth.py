"""Stealth browser configuration for Playwright."""
import random
from typing import Tuple
from playwright.sync_api import sync_playwright, Browser, BrowserContext, Playwright

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
]

def create_stealth_browser() -> Tuple[Playwright, Browser, BrowserContext]:
    """Create a stealth browser instance with evasion."""
    playwright = sync_playwright().start()
    
    browser = playwright.chromium.launch(
        headless=True,
        args=[
            '--disable-blink-features=AutomationControlled',
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
        ]
    )
    
    context = browser.new_context(
        user_agent=random.choice(USER_AGENTS),
        viewport={
            'width': random.randint(1200, 1920),
            'height': random.randint(800, 1080),
        },
        locale='en-US',
        timezone_id='America/New_York',
    )
    
    # Stealth scripts to mask automation
    context.add_init_script("""
        Object.defineProperty(navigator, 'webdriver', {
            get: () => undefined
        });
        window.navigator.chrome = {
            runtime: {}
        };
        Object.defineProperty(navigator, 'plugins', {
            get: () => [1, 2, 3, 4, 5]
        });
        Object.defineProperty(navigator, 'languages', {
            get: () => ['en-US', 'en']
        });
    """)
    
    return playwright, browser, context

def close_stealth_browser(playwright: Playwright, browser: Browser) -> None:
    """Clean up browser resources."""
    browser.close()
    playwright.stop()
