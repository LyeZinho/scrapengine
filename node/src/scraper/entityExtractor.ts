interface EntityResult {
  emails: string[];
  phones: string[];
  prices: string[];
  dates: string[];
  urls: string[];
  hashtags: string[];
  mentions: string[];
}

const EMAIL_PATTERN = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
const PHONE_PATTERN = /(\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{2,4}[-.\s]?\d{2,4}/g;
const PRICE_PATTERN = /[\$£€R\$]?\s?(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)/g;
const DATE_PATTERNS = [
  /\d{1,2}\/\d{1,2}\/\d{2,4}/g,
  /\d{1,2}-\d{1,2}-\d{2,4}/g,
  /\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{2,4}/gi,
  /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{2,4}/gi,
];
const HASHTAG_PATTERN = /#[a-zA-Z0-9_]+/g;
const MENTION_PATTERN = /@[a-zA-Z0-9_]+/g;
const URL_PATTERN = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/g;

function unique<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

function cleanText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export class EntityExtractor {
  extractAll(text: string): EntityResult {
    return {
      emails: this.extractEmails(text),
      phones: this.extractPhones(text),
      prices: this.extractPrices(text),
      dates: this.extractDates(text),
      urls: this.extractUrls(text),
      hashtags: this.extractHashtags(text),
      mentions: this.extractMentions(text),
    };
  }

  extractEmails(text: string): string[] {
    return unique(text.match(EMAIL_PATTERN) || []);
  }

  extractPhones(text: string): string[] {
    const matches = text.match(PHONE_PATTERN) || [];
    return unique(matches.filter(p => p.replace(/\D/g, '').length > 6));
  }

  extractPrices(text: string): string[] {
    return unique(text.match(PRICE_PATTERN) || []);
  }

  extractDates(text: string): string[] {
    const dates: string[] = [];
    for (const pattern of DATE_PATTERNS) {
      const matches = text.match(pattern);
      if (matches) {
        dates.push(...matches);
      }
    }
    return unique(dates);
  }

  extractUrls(text: string): string[] {
    return unique(text.match(URL_PATTERN) || []);
  }

  extractHashtags(text: string): string[] {
    return unique(text.match(HASHTAG_PATTERN) || []);
  }

  extractMentions(text: string): string[] {
    return unique(text.match(MENTION_PATTERN) || []);
  }
}
