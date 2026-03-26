export interface ScrapedContent {
  readonly title: string | null;
  readonly description: string | null;
  readonly html: string;
  readonly text: string;
  readonly url: string;
}

export interface ExtractedEntities {
  readonly emails: readonly string[];
  readonly phones: readonly string[];
  readonly prices: readonly { value: number; currency: string }[];
  readonly dates: readonly string[];
  readonly urls: readonly string[];
}

export interface ScraperResult {
  readonly url: string;
  readonly status: 'success' | 'error';
  readonly content: ScrapedContent | null;
  readonly entities: ExtractedEntities | null;
  readonly classification: {
    readonly pageType: string;
    readonly domain: string;
  } | null;
  readonly metadata: {
    readonly title?: string;
    readonly description?: string;
    readonly ogImage?: string;
    readonly ogTitle?: string;
    readonly ogDescription?: string;
    readonly twitterCard?: string;
  };
  readonly timestamp: Date;
  readonly duration: number;
  readonly error?: string;
}
