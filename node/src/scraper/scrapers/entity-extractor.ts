import type { ScrapedContent, ExtractedEntities } from '../types';

const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_PATTERN =
  /(?:\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
const PRICE_PATTERN = /[$£€]\s*(\d+(?:[.,]\d{2})?)/g;
const URL_PATTERN = /https?:\/\/[^\s]+/g;
const ISO_DATE_PATTERN = /\d{4}-\d{2}-\d{2}/g;

const extractEmails = (text: string): readonly string[] => {
  const matches = text.match(EMAIL_PATTERN) || [];
  return [...new Set(matches)];
};

const extractPhones = (text: string): readonly string[] => {
  const matches = text.match(PHONE_PATTERN) || [];
  return [...new Set(matches)];
};

const extractPrices = (
  text: string
): readonly { value: number; currency: string }[] => {
  const matches = text.matchAll(/([₹$£€])\s*(\d+(?:[.,]\d{2})?)/g);
  const currencies: Record<string, string> = {
    '₹': 'INR',
    '$': 'USD',
    '£': 'GBP',
    '€': 'EUR',
  };

  return Array.from(matches).map(([, curr, amount]) => ({
    value: parseFloat(amount.replace(',', '.')),
    currency: currencies[curr] || 'UNKNOWN',
  }));
};

const extractUrls = (text: string): readonly string[] => {
  const matches = text.match(URL_PATTERN) || [];
  return [...new Set(matches)];
};

const extractDates = (text: string): readonly string[] => {
  const matches = text.match(ISO_DATE_PATTERN) || [];
  return [...new Set(matches)];
};

export const extractEntities = (
  content: ScrapedContent
): ExtractedEntities => {
  const text = content.text;

  return {
    emails: extractEmails(text),
    phones: extractPhones(text),
    prices: extractPrices(text),
    urls: extractUrls(text),
    dates: extractDates(text),
  };
};
