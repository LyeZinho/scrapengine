import type { ScrapedContent } from '../types';

const pageTypeKeywords = {
  article: ['article', 'blog', 'news', 'post', 'press'],
  product: ['product', 'buy', 'shop', 'price', 'add to cart'],
  listing: ['search', 'results', 'directory', 'list', 'catalog'],
  profile: ['profile', 'about', 'author', 'team', 'user'],
};

const domainKeywords = {
  job: ['job', 'career', 'hiring', 'employment', 'position', 'vacancy'],
  ecommerce: ['shop', 'store', 'buy', 'product', 'cart', 'checkout'],
  realestate: ['property', 'house', 'apartment', 'rent', 'sale', 'broker'],
  finance: ['bank', 'investment', 'stock', 'crypto', 'trading'],
  tech: ['software', 'developer', 'code', 'programming', 'api'],
  travel: ['hotel', 'flight', 'booking', 'vacation', 'resort'],
  education: ['course', 'learn', 'tutorial', 'school', 'student'],
  health: ['medical', 'doctor', 'hospital', 'health', 'wellness'],
};

const classifyPageType = (content: ScrapedContent): string => {
  const lowerText = (
    content.title +
    ' ' +
    content.description
  ).toLowerCase();

  for (const [type, keywords] of Object.entries(pageTypeKeywords)) {
    if (keywords.some((kw) => lowerText.includes(kw))) {
      return type;
    }
  }

  return 'unknown';
};

const classifyDomain = (content: ScrapedContent): string => {
  const lowerText = (
    content.title +
    ' ' +
    content.description +
    ' ' +
    content.text
  ).toLowerCase();

  for (const [domain, keywords] of Object.entries(domainKeywords)) {
    const matches = keywords
      .filter((kw) => lowerText.includes(kw))
      .length;
    if (matches >= 2) return domain;
  }

  return 'unknown';
};

export const categorizeContent = (content: ScrapedContent) => {
  return {
    pageType: classifyPageType(content),
    domain: classifyDomain(content),
  };
};
