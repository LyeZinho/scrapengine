import { load } from 'cheerio';
import { chromium, type Browser, type Page } from 'playwright';
import type { ScrapedContent } from '../types';

const DEFAULT_TIMEOUT = 10000;
const DEFAULT_WAIT_UNTIL = 'networkidle' as const;

export const extractContent = (html: string, url: string): ScrapedContent => {
  const $ = load(html);

  $('script, style, noscript').remove();

  const title = $('title').text() || $('h1').first().text() || null;
  const description =
    $('meta[name="description"]').attr('content') || null;
  const text = $.text();

  return {
    title,
    description,
    html,
    text,
    url,
  };
};

export const extractMetadata = (html: string) => {
  const $ = load(html);

  return {
    title: $('meta[property="og:title"]').attr('content'),
    description: $('meta[property="og:description"]').attr('content'),
    ogImage: $('meta[property="og:image"]').attr('content'),
    ogTitle: $('meta[property="og:title"]').attr('content'),
    ogDescription: $('meta[property="og:description"]').attr('content'),
    twitterCard: $('meta[name="twitter:card"]').attr('content'),
  };
};

export const createBrowserLauncher = (options = {}) => {
  return async (): Promise<Browser> => {
    return chromium.launch({
      headless: true,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
      ],
      ...options,
    });
  };
};

export const scrapePage = async (
  page: Page,
  url: string,
  timeout: number = DEFAULT_TIMEOUT
): Promise<string> => {
  await page.goto(url, {
    waitUntil: DEFAULT_WAIT_UNTIL,
    timeout,
  });

  await Promise.race([
    page
      .waitForSelector('main, article, .content, #main', { timeout: 5000 })
      .catch(() => {}),
    new Promise((resolve) => setTimeout(resolve, 3000)),
  ]);

  return page.content();
};
