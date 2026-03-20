import { chromium, Browser, BrowserContext } from 'playwright';

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
];

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const STEALTH_SCRIPT = `
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
`;

export interface StealthBrowser {
  browser: Browser;
  context: BrowserContext;
}

export async function createStealthBrowser(): Promise<StealthBrowser> {
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
    ],
  });

  const context = await browser.newContext({
    userAgent: randomChoice(USER_AGENTS),
    viewport: {
      width: randomInt(1200, 1920),
      height: randomInt(800, 1080),
    },
    locale: 'en-US',
    timezoneId: 'America/New_York',
  });

  await context.addInitScript(STEALTH_SCRIPT);

  return { browser, context };
}

export async function closeStealthBrowser(stealth: StealthBrowser): Promise<void> {
  await stealth.context.close();
  await stealth.browser.close();
}
