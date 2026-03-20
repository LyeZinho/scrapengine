import { Page } from 'playwright';
import { Cleaner } from './cleaner.js';
import { EntityExtractor } from './entityExtractor.js';
import { Categorizer } from './categorizer.js';

interface ExtractedData {
  meta: {
    title: string;
    description: string;
    keywords: string;
    author: string;
    robots: string;
    canonical: string;
    og_title: string;
    og_description: string;
    og_image: string;
    og_type: string;
    og_url: string;
    og_site_name: string;
    twitter_card: string;
    twitter_image: string;
  };
  title: string;
  h1: string[];
  h2: string[];
  h3: string[];
  paragraphs: string[];
  links: Array<{ text: string; href: string; title: string }>;
  images: Array<{ src: string; alt: string; title: string }>;
  tables: Array<{ headers: string[]; rows: string[][] }>;
  lists: string[][];
  breadcrumbs: string[];
  schemas: unknown[];
  text: string;
  description: string;
}

const EXTRACT_SCRIPT = `() => {
  const data = {
    meta: {
      title: document.querySelector('title')?.textContent || '',
      description: document.querySelector('meta[name="description"]')?.content || '',
      keywords: document.querySelector('meta[name="keywords"]')?.content || '',
      author: document.querySelector('meta[name="author"]')?.content || '',
      robots: document.querySelector('meta[name="robots"]')?.content || '',
      canonical: document.querySelector('link[rel="canonical"]')?.href || '',
      og_title: document.querySelector('meta[property="og:title"]')?.content || '',
      og_description: document.querySelector('meta[property="og:description"]')?.content || '',
      og_image: document.querySelector('meta[property="og:image"]')?.content || '',
      og_type: document.querySelector('meta[property="og:type"]')?.content || '',
      og_url: document.querySelector('meta[property="og:url"]')?.content || '',
      og_site_name: document.querySelector('meta[property="og:site_name"]')?.content || '',
      twitter_card: document.querySelector('meta[name="twitter:card"]')?.content || '',
      twitter_image: document.querySelector('meta[name="twitter:image"]')?.content || '',
    },
    
    title: document.querySelector('h1')?.textContent?.trim() || document.querySelector('title')?.textContent?.trim() || '',
    
    h1: Array.from(document.querySelectorAll('h1')).map(el => el.textContent.trim()).filter(t => t),
    h2: Array.from(document.querySelectorAll('h2')).map(el => el.textContent.trim()).filter(t => t),
    h3: Array.from(document.querySelectorAll('h3')).map(el => el.textContent.trim()).filter(t => t),
    
    paragraphs: Array.from(document.querySelectorAll('p')).map(el => el.textContent.trim()).filter(t => t.length > 30),
    
    links: Array.from(document.querySelectorAll('a[href]')).slice(0, 50).map(a => ({
      text: a.textContent.trim(),
      href: a.href,
      title: a.title || '',
    })),
    
    images: Array.from(document.querySelectorAll('img[src], img[data-src]')).slice(0, 30).map(img => ({
      src: img.src || img.dataset.src || '',
      alt: img.alt || '',
      title: img.title || '',
    })).filter(img => img.src && !img.src.includes('data:')),
    
    tables: Array.from(document.querySelectorAll('table')).slice(0, 5).map(table => {
      const rows = Array.from(table.querySelectorAll('tr')).slice(0, 10).map(tr => 
        Array.from(tr.querySelectorAll('th, td')).map(cell => cell.textContent.trim())
      );
      return { headers: rows[0] || [], rows: rows.slice(1) };
    }),
    
    lists: Array.from(document.querySelectorAll('ul, ol')).slice(0, 10).map(list => 
      Array.from(list.querySelectorAll('li')).slice(0, 20).map(li => li.textContent.trim()).filter(t => t)
    ),
    
    breadcrumbs: Array.from(document.querySelectorAll('[class*="breadcrumb"], [class*="breadcrumbs"], nav[aria-label*="breadcrumb"]')).flatMap(el => 
      Array.from(el.querySelectorAll('a, span')).map(x => x.textContent.trim()).filter(t => t)
    ),
    
    schemas: [],
  };
  
  document.querySelectorAll('script[type="application/ld+json"]').forEach(script => {
    try {
      const parsed = JSON.parse(script.textContent);
      if (parsed['@graph']) {
        data.schemas.push(...parsed['@graph']);
      } else if (Array.isArray(parsed)) {
        data.schemas.push(...parsed);
      } else {
        data.schemas.push(parsed);
      }
    } catch (e) {}
  });
  
  const main = document.querySelector('article') || document.querySelector('main') || document.querySelector('.content') || document.querySelector('.text');
  data.text = main ? main.textContent.trim().slice(0, 10000) : '';
  
  data.description = data.description || data.meta.og_description || 
      data.paragraphs.slice(0, 3).join(' ').slice(0, 300);
  
  return data;
}`;

export class SuperExtractor {
  private cleaner = new Cleaner();
  private entityExtractor = new EntityExtractor();
  private categorizer = new Categorizer();

  async extract(page: Page): Promise<Record<string, unknown>> {
    const rawData = await page.evaluate(EXTRACT_SCRIPT) as ExtractedData;

    const cleaned = this.cleaner.cleanAll(rawData as unknown as Record<string, unknown>);

    const textForEntities =
      (cleaned.text as string || '') + ' ' +
      (cleaned.title as string || '') + ' ' +
      ((cleaned.paragraphs as string[]) || []).join(' ');

    const entities = this.entityExtractor.extractAll(textForEntities);
    const classification = this.categorizer.classify(cleaned);

    const links = (cleaned.links || []) as Array<{ href?: string }>;
    const internalLinks = links.filter(l => l.href && !l.href.startsWith('http'));
    const externalLinks = links.filter(l => l.href && l.href.startsWith('http'));

    const wordCount = ((cleaned.text as string) || '').split(/\s+/).filter(Boolean).length;

    return {
      meta: cleaned.meta,
      title: cleaned.title,
      description: cleaned.description,

      content: {
        headings: {
          h1: cleaned.h1,
          h2: cleaned.h2,
          h3: cleaned.h3,
        },
        paragraphs: cleaned.paragraphs,
        lists: cleaned.lists,
        tables: cleaned.tables,
        text_raw: cleaned.text,
      },

      entities,

      media: {
        images: cleaned.images,
      },

      structure: {
        breadcrumbs: cleaned.breadcrumbs,
      },

      links: {
        all: cleaned.links,
        internal: internalLinks.slice(0, 20),
        external: externalLinks.slice(0, 20),
      },

      schemas: cleaned.schemas,

      classification,

      quality: {
        word_count: wordCount,
        paragraph_count: ((cleaned.paragraphs as string[]) || []).length,
        heading_count: ((cleaned.h1 as string[])?.length || 0) + ((cleaned.h2 as string[])?.length || 0),
        image_count: ((cleaned.images as unknown[]) || []).length,
        link_count: ((cleaned.links as unknown[]) || []).length,
        has_schema: ((cleaned.schemas as unknown[]) || []).length > 0,
      },
    };
  }
}
