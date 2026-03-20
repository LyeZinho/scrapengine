interface CleaningData {
  paragraphs?: string[];
  links?: Array<{ text: string; href: string; title: string }>;
  h1?: string[];
  h2?: string[];
  h3?: string[];
  text?: string;
  [key: string]: unknown;
}

const AD_KEYWORDS = [
  'advertisement', 'sponsored', 'promoted', 'advert',
  'cookie', 'privacy policy', 'terms of service',
  'subscribe', 'newsletter', 'signup',
];

function cleanText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/[\x00-\x08\x0b-\x0c\x0e-\x1f\x7f-\x9f]/g, '')
    .trim();
}

function cleanList(items: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of items) {
    const cleaned = cleanText(item);
    if (cleaned && cleaned.length > 2 && !seen.has(cleaned.toLowerCase())) {
      seen.add(cleaned.toLowerCase());
      result.push(cleaned);
    }
  }

  return result;
}

function removeAds(items: Array<{ text?: string }>): Array<{ text?: string }> {
  return items.filter(item => {
    const text = (item.text || '').toLowerCase();
    return !AD_KEYWORDS.some(kw => text.includes(kw));
  });
}

function deduplicateLinks(
  links: Array<{ text: string; href: string; title: string }>
): Array<{ text: string; href: string; title: string }> {
  const seen = new Set<string>();
  const result: Array<{ text: string; href: string; title: string }> = [];

  for (const link of links) {
    const href = link.href || '';
    if (href && !seen.has(href) && !href.startsWith('javascript:')) {
      seen.add(href);
      result.push(link);
    }
  }

  return result.slice(0, 50);
}

export class Cleaner {
  cleanAll(data: CleaningData): CleaningData {
    const cleaned = { ...data };

    if (cleaned.paragraphs) {
      cleaned.paragraphs = cleanList(cleaned.paragraphs);
    }

    if (cleaned.links) {
      cleaned.links = deduplicateLinks(cleaned.links);
    }

    if (cleaned.h1) {
      cleaned.h1 = cleanList(cleaned.h1);
    }

    if (cleaned.h2) {
      cleaned.h2 = cleanList(cleaned.h2);
    }

    if (cleaned.h3) {
      cleaned.h3 = cleanList(cleaned.h3);
    }

    if (cleaned.text) {
      cleaned.text = cleanText(cleaned.text);
    }

    return cleaned;
  }
}
