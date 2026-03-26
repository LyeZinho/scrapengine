import { Injectable, BadRequestException } from '@nestjs/common';
import { chromium, type Browser } from 'playwright';
import {
  scrapePage,
  extractContent,
  extractMetadata,
  createBrowserLauncher,
} from './scrapers/html-scraper';
import { extractEntities } from './scrapers/entity-extractor';
import { categorizeContent } from './scrapers/categorizer';
import type { ScraperResult } from './types';

@Injectable()
export class ScraperService {
  private browser: Browser | null = null;

  async onModuleInit() {
    const launcher = createBrowserLauncher();
    this.browser = await launcher();
  }

  async onModuleDestroy() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  async scrape(url: string): Promise<ScraperResult> {
    const startTime = Date.now();

    if (!this.browser) {
      throw new BadRequestException('Scraper not initialized');
    }

    try {
      new URL(url);
    } catch {
      throw new BadRequestException('Invalid URL');
    }

    try {
      const page = await this.browser.newPage();

      try {
        const html = await scrapePage(page, url);
        const content = extractContent(html, url);
        const entities = extractEntities(content);
        const classification = categorizeContent(content);
        const metadata = extractMetadata(html);

        const duration = Date.now() - startTime;

        return {
          url,
          status: 'success',
          content,
          entities,
          classification,
          metadata,
          timestamp: new Date(),
          duration,
        };
      } finally {
        await page.close();
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      return {
        url,
        status: 'error',
        content: null,
        entities: null,
        classification: null,
        metadata: {},
        timestamp: new Date(),
        duration,
        error: errorMessage,
      };
    }
  }
}
