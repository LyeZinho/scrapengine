import { createStealthBrowser, closeStealthBrowser, StealthBrowser } from './stealth.js';
import { SuperExtractor } from './extractor.js';

export interface ScrapeResult {
  url: string;
  status_code: number | null;
  data: Record<string, unknown>;
}

const superExtractor = new SuperExtractor();

export async function scrapeUrl(url: string, timeout: number = 30000): Promise<ScrapeResult> {
  let stealth: StealthBrowser | null = null;

  try {
    stealth = await createStealthBrowser();
    const page = await stealth.context.newPage();

    // Small delay to allow stealth scripts to run
    await page.waitForTimeout(1000);

    const response = await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout,
    });

    // Wait for content to load
    await page.waitForTimeout(2000);

    const statusCode = response?.status() || null;

    if (statusCode && statusCode >= 400) {
      await page.close();
      throw new Error(`HTTP ${statusCode}`);
    }

    const data = await superExtractor.extract(page);

    await page.close();

    return {
      url,
      status_code: statusCode,
      data,
    };
  } finally {
    if (stealth) {
      await closeStealthBrowser(stealth);
    }
  }
}
