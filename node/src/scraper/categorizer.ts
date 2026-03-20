interface CategorizerResult {
  page_type: string;
  domain: string;
  content_types: string[];
  confidence: {
    page_type: number;
    domain: number;
  };
  all_page_types: Record<string, number>;
  all_domains: Record<string, number>;
}

const PAGE_TYPE_PATTERNS: Record<string, string[]> = {
  PAGE_TYPE_ARTICLE: ['article', 'post', 'blog', 'news', 'story', 'editorial'],
  PAGE_TYPE_PRODUCT: ['product', 'shop', 'buy', 'cart', 'price', 'add to cart', 'checkout'],
  PAGE_TYPE_LISTING: ['listing', 'search', 'results', 'directory', 'catalog'],
  PAGE_TYPE_PROFILE: ['profile', 'user', 'member', 'author', 'bio', 'about'],
  PAGE_TYPE_MEDIA: ['image', 'photo', 'video', 'gallery', 'media', 'watch'],
  PAGE_TYPE_DOCUMENT: ['pdf', 'doc', 'document', 'download', 'file'],
  PAGE_TYPE_APPLICATION: ['app', 'tool', 'calculator', 'converter', 'generator'],
};

const DOMAIN_PATTERNS: Record<string, string[]> = {
  DOMAIN_JOB: ['job', 'work', 'hiring', 'career', 'employment', 'vacancies', 'recruit'],
  DOMAIN_ECOMMERCE: ['shop', 'store', 'buy', 'sale', 'product', 'cart', 'order'],
  DOMAIN_REALESTATE: ['real estate', 'property', 'house', 'apartment', 'rent', 'mortgage'],
  DOMAIN_FINANCE: ['finance', 'bank', 'investment', 'stock', 'crypto', 'trading'],
  DOMAIN_TECH: ['software', 'developer', 'code', 'github', 'programming', 'tech'],
  DOMAIN_TRAVEL: ['travel', 'hotel', 'flight', 'booking', 'vacation', 'tourism'],
  DOMAIN_EDUCATION: ['course', 'learn', 'tutorial', 'school', 'university', 'training'],
  DOMAIN_HEALTH: ['health', 'medical', 'doctor', 'hospital', 'wellness', 'disease'],
  DOMAIN_SOCIAL: ['social', 'network', 'community', 'forum', 'chat', 'message'],
};

function combineText(data: Record<string, unknown>): string {
  const parts: string[] = [
    data.title as string || '',
    data.description as string || '',
    data.text as string || '',
  ];

  if (Array.isArray(data.paragraphs)) {
    parts.push(...(data.paragraphs as string[]));
  }
  if (Array.isArray(data.h1)) {
    parts.push(...(data.h1 as string[]));
  }
  if (Array.isArray(data.h2)) {
    parts.push(...(data.h2 as string[]));
  }

  return parts.join(' ');
}

function calculateScore(text: string, patterns: Record<string, string[]>): Record<string, number> {
  const textLower = text.toLowerCase();
  const scores: Record<string, number> = {};

  for (const [category, keywords] of Object.entries(patterns)) {
    let score = 0;
    for (const kw of keywords) {
      if (textLower.includes(kw)) {
        score++;
      }
    }
    if (score > 0) {
      scores[category] = score / keywords.length;
    }
  }

  return scores;
}

function getTopScored(scores: Record<string, number>, fallback: string): string {
  const entries = Object.entries(scores);
  if (entries.length === 0) return fallback;
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0][0];
}

export class Categorizer {
  classify(data: Record<string, unknown>): CategorizerResult {
    const text = combineText(data);

    const pageTypeScores = calculateScore(text, PAGE_TYPE_PATTERNS);
    const domainScores = calculateScore(text, DOMAIN_PATTERNS);

    const topPageType = getTopScored(pageTypeScores, 'PAGE_TYPE_UNKNOWN');
    const topDomain = getTopScored(domainScores, 'DOMAIN_GENERIC');

    const contentTypes: string[] = [];

    if ((data.h1 as string[])?.length || (data.h2 as string[])?.length || (data.h3 as string[])?.length) {
      contentTypes.push('CONTENT_HEADING');
    }
    if ((data.paragraphs as string[])?.length) {
      contentTypes.push('CONTENT_TEXT');
    }
    if ((data.lists as unknown[])?.length) {
      contentTypes.push('CONTENT_LIST');
    }
    if ((data.tables as unknown[])?.length) {
      contentTypes.push('CONTENT_TABLE');
    }

    return {
      page_type: topPageType,
      domain: topDomain,
      content_types: contentTypes,
      confidence: {
        page_type: pageTypeScores[topPageType] || 0,
        domain: domainScores[topDomain] || 0,
      },
      all_page_types: pageTypeScores,
      all_domains: domainScores,
    };
  }
}
