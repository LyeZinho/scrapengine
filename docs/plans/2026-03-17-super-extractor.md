# Super Extractor Engine Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Criar um motor de extração agnóstico multi-nível que extrai o máximo de dados úteis de qualquer página web, classifica em categorias correlacionárias e retorna um payload estruturado e rico.

**Architecture:** Pipeline de 4 estágios: Extração Bruta → Limpeza & Deduplicação → Classificação & Clustering → Output Estruturado. Módulos independentes para extração de entidades, categorização e limpeza.

**Tech Stack:** Python 3.11, Playwright, Pydantic, Regex patterns

---

## Task 1: Entity Extractor Module

**Files:**
- Create: `/home/pedro/repo/scrapengine/python/src/extractor/entity_extractor.py`

**Step 1: Criar o módulo de extração de entidades**

```python
import re
from typing import List, Dict, Any

class EntityExtractor:
    EMAIL_PATTERN = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
    PHONE_PATTERN = r'(\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{2,4}[-.\s]?\d{2,4}'
    PRICE_PATTERN = r'[\$£€R\$]?\s?(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)'
    DATE_PATTERNS = [
        r'\d{1,2}/\d{1,2}/\d{2,4}',
        r'\d{1,2}-\d{1,2}-\d{2,4}',
        r'\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{2,4}',
        r'(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{2,4}',
    ]
    HASHTAG_PATTERN = r'#[a-zA-Z0-9_]+'
    MENTION_PATTERN = r'@[a-zA-Z0-9_]+'
    URL_PATTERN = r'https?://[^\s<>"{}|\\^`\[\]]+'
    
    def extract_all(self, text: str) -> Dict[str, List[str]]:
        return {
            "emails": self.extract_emails(text),
            "phones": self.extract_phones(text),
            "prices": self.extract_prices(text),
            "dates": self.extract_dates(text),
            "urls": self.extract_urls(text),
            "hashtags": self.extract_hashtags(text),
            "mentions": self.extract_mentions(text),
        }
    
    def extract_emails(self, text: str) -> List[str]:
        return list(set(re.findall(self.EMAIL_PATTERN, text)))
    
    def extract_phones(self, text: str) -> List[str]:
        phones = re.findall(self.PHONE_PATTERN, text)
        return list(set([p[0] if isinstance(p, tuple) else p for p in phones if len(p) > 6]))
    
    def extract_prices(self, text: str) -> List[str]:
        return list(set(re.findall(self.PRICE_PATTERN, text)))
    
    def extract_dates(self, text: str) -> List[str]:
        dates = []
        for pattern in self.DATE_PATTERNS:
            dates.extend(re.findall(pattern, text, re.IGNORECASE))
        return list(set(dates))
    
    def extract_urls(self, text: str) -> List[str]:
        return list(set(re.findall(self.URL_PATTERN, text)))
    
    def extract_hashtags(self, text: str) -> List[str]:
        return list(set(re.findall(self.HASHTAG_PATTERN, text)))
    
    def extract_mentions(self, text: str) -> List[str]:
        return list(set(re.findall(self.MENTION_PATTERN, text)))
```

**Step 2: Testar o módulo**

```bash
cd /home/pedro/repo/scrapengine/python
python3 -c "
from src.extractor.entity_extractor import EntityExtractor
e = EntityExtractor()
text = 'Contact us at info@example.com or call +1-555-123-4567. Price: \$99.99. Date: 2024-01-15. #news @user'
print(e.extract_all(text))
"
```

Expected: Dicionário com emails, phones, prices, dates, hashtags, mentions

---

## Task 2: Cleaner Module

**Files:**
- Create: `/home/pedro/repo/scrapengine/python/src/extractor/cleaner.py`

**Step 1: Criar o módulo de limpeza**

```python
from typing import List, Dict, Any, Set
import re

class Cleaner:
    DEV_JUNK_SELECTORS = [
        'script', 'style', 'noscript', 'iframe', 'canvas',
        '[class*="cookie"]', '[class*="banner"]', '[class*="advertisement"]',
        '[id*="cookie"]', '[id*="banner"]', '[id*="advertisement"]',
        '[class*="analytics"]', '[class*="tracker"]',
        '[data-testid*="ad"]', '[aria-label*="ad"]',
    ]
    
    AD_KEYWORDS = [
        'advertisement', 'sponsored', 'promoted', 'advert',
        'cookie', 'privacy policy', 'terms of service',
        'subscribe', 'newsletter', 'signup',
    ]
    
    def clean_text(self, text: str) -> str:
        text = re.sub(r'\s+', ' ', text)
        text = re.sub(r'[\x00-\x08\x0b-\x0c\x0e-\x1f\x7f-\x9f]', '', text)
        return text.strip()
    
    def clean_list(self, items: List[str]) -> List[str]:
        seen: Set[str] = set()
        result = []
        for item in items:
            cleaned = self.clean_text(item)
            if cleaned and len(cleaned) > 2 and cleaned.lower() not in seen:
                seen.add(cleaned.lower())
                result.append(cleaned)
        return result
    
    def remove_ads(self, items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        result = []
        for item in items:
            text = str(item.get('text', '')).lower()
            if not any(kw in text for kw in self.AD_KEYWORDS):
                result.append(item)
        return result
    
    def deduplicate_links(self, links: List[Dict[str, str]]) -> List[Dict[str, str]]:
        seen: Set[str] = set()
        result = []
        for link in links:
            href = link.get('href', '')
            if href and href not in seen and not href.startswith('javascript:'):
                seen.add(href)
                result.append(link)
        return result[:50]
    
    def clean_all(self, data: Dict[str, Any]) -> Dict[str, Any]:
        cleaned = data.copy()
        
        if 'paragraphs' in cleaned:
            cleaned['paragraphs'] = self.clean_list(cleaned['paragraphs'])
        
        if 'links' in cleaned:
            cleaned['links'] = self.deduplicate_links(cleaned['links'])
        
        if 'h1' in cleaned:
            cleaned['h1'] = self.clean_list(cleaned['h1'])
        
        if 'h2' in cleaned:
            cleaned['h2'] = self.clean_list(cleaned['h2'])
        
        if 'text' in cleaned:
            cleaned['text'] = self.clean_text(cleaned['text'])
        
        return cleaned
```

---

## Task 3: Categorizer Module

**Files:**
- Create: `/home/pedro/repo/scrapengine/python/src/extractor/categorizer.py`

**Step 1: Criar o módulo de categorização multi-nível**

```python
from typing import Dict, List, Any
from collections import defaultdict

class Categorizer:
    PAGE_TYPE_PATTERNS = {
        'PAGE_TYPE_ARTICLE': ['article', 'post', 'blog', 'news', 'story', 'editorial'],
        'PAGE_TYPE_PRODUCT': ['product', 'shop', 'buy', 'cart', 'price', 'add to cart', 'checkout'],
        'PAGE_TYPE_LISTING': ['listing', 'search', 'results', 'directory', 'catalog'],
        'PAGE_TYPE_PROFILE': ['profile', 'user', 'member', 'author', 'bio', 'about'],
        'PAGE_TYPE_MEDIA': ['image', 'photo', 'video', 'gallery', 'media', 'watch'],
        'PAGE_TYPE_DOCUMENT': ['pdf', 'doc', 'document', 'download', 'file'],
        'PAGE_TYPE_APPLICATION': ['app', 'tool', 'calculator', 'converter', 'generator'],
    }
    
    DOMAIN_PATTERNS = {
        'DOMAIN_JOB': ['job', 'work', 'hiring', 'career', 'employment', 'vacancies', 'recruit'],
        'DOMAIN_ECOMMERCE': ['shop', 'store', 'buy', 'sale', 'product', 'cart', 'order'],
        'DOMAIN_REALESTATE': ['real estate', 'property', 'house', 'apartment', 'rent', 'mortgage'],
        'DOMAIN_FINANCE': ['finance', 'bank', 'investment', 'stock', 'crypto', 'trading'],
        'DOMAIN_TECH': ['software', 'developer', 'code', 'github', 'programming', 'tech'],
        'DOMAIN_TRAVEL': ['travel', 'hotel', 'flight', 'booking', 'vacation', 'tourism'],
        'DOMAIN_EDUCATION': ['course', 'learn', 'tutorial', 'school', 'university', 'training'],
        'DOMAIN_HEALTH': ['health', 'medical', 'doctor', 'hospital', 'wellness', 'disease'],
        'DOMAIN_SOCIAL': ['social', 'network', 'community', 'forum', 'chat', 'message'],
    }
    
    CONTENT_PATTERNS = {
        'CONTENT_HEADING': ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'title', 'heading'],
        'CONTENT_TEXT': ['p', 'paragraph', 'text', 'description', 'body'],
        'CONTENT_LIST': ['ul', 'ol', 'li', 'list', 'item'],
        'CONTENT_TABLE': ['table', 'tr', 'td', 'th', 'thead', 'tbody'],
        'CONTENT_QUOTE': ['blockquote', 'quote', 'cite'],
        'CONTENT_CODE': ['code', 'pre', 'script', 'function', 'class'],
    }
    
    def __init__(self):
        self.category_scores = defaultdict(float)
    
    def calculate_score(self, text: str, patterns: Dict[str, List[str]]) -> Dict[str, float]:
        text_lower = text.lower()
        scores = {}
        for category, keywords in patterns.items():
            score = sum(1 for kw in keywords if kw in text_lower)
            if score > 0:
                scores[category] = score / len(keywords)
        return scores
    
    def classify_page_type(self, data: Dict[str, Any]) -> Dict[str, float]:
        text = self._combine_text(data)
        return self.calculate_score(text, self.PAGE_TYPE_PATTERNS)
    
    def classify_domain(self, data: Dict[str, Any]) -> Dict[str, float]:
        text = self._combine_text(data)
        return self.calculate_score(text, self.DOMAIN_PATTERNS)
    
    def classify_content(self, data: Dict[str, Any]) -> Dict[str, Any]:
        content_types = {}
        
        if data.get('h1') or data.get('h2') or data.get('h3'):
            content_types['CONTENT_HEADING'] = 1.0
        
        if data.get('paragraphs') and len(data['paragraphs']) > 0:
            content_types['CONTENT_TEXT'] = 1.0
        
        if data.get('lists'):
            content_types['CONTENT_LIST'] = 1.0
        
        if data.get('tables'):
            content_types['CONTENT_TABLE'] = 1.0
        
        if data.get('quotes'):
            content_types['CONTENT_QUOTE'] = 1.0
        
        if data.get('code'):
            content_types['CONTENT_CODE'] = 1.0
        
        return content_types
    
    def _combine_text(self, data: Dict[str, Any]) -> str:
        parts = [
            data.get('title', ''),
            data.get('description', ''),
            data.get('text', ''),
        ]
        parts.extend(data.get('paragraphs', []))
        parts.extend(data.get('h1', []))
        parts.extend(data.get('h2', []))
        return ' '.join(parts)
    
    def classify(self, data: Dict[str, Any]) -> Dict[str, Any]:
        page_type = self.classify_page_type(data)
        domain = self.classify_domain(data)
        content = self.classify_content(data)
        
        top_page_type = max(page_type.items(), key=lambda x: x[1])[0] if page_type else 'PAGE_TYPE_UNKNOWN'
        top_domain = max(domain.items(), key=lambda x: x[1])[0] if domain else 'DOMAIN_GENERIC'
        
        confidence = {
            'page_type': page_type.get(top_page_type, 0),
            'domain': domain.get(top_domain, 0),
        }
        
        return {
            'page_type': top_page_type,
            'domain': top_domain,
            'content_types': list(content.keys()),
            'confidence': confidence,
            'all_page_types': page_type,
            'all_domains': domain,
        }
```

---

## Task 4: Super Extractor Module

**Files:**
- Create: `/home/pedro/repo/scrapengine/python/src/extractor/super_extractor.py`

**Step 1: Criar o motor principal de extração**

```python
from typing import Dict, Any, List, Union
from playwright.sync_api import Page as SyncPage
from playwright.async_api import Page as AsyncPage

from .entity_extractor import EntityExtractor
from .cleaner import Cleaner
from .categorizer import Categorizer

class SuperExtractor:
    def __init__(self):
        self.entity_extractor = EntityExtractor()
        self.cleaner = Cleaner()
        self.categorizer = Categorizer()
    
    def extract_evaluator(self) -> str:
        return '''() => {
            const data = {
                // Meta tags
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
                
                // Title
                title: document.querySelector('h1')?.textContent?.trim() || document.querySelector('title')?.textContent?.trim() || '',
                
                // Headings
                h1: Array.from(document.querySelectorAll('h1')).map(el => el.textContent.trim()).filter(t => t),
                h2: Array.from(document.querySelectorAll('h2')).map(el => el.textContent.trim()).filter(t => t),
                h3: Array.from(document.querySelectorAll('h3')).map(el => el.textContent.trim()).filter(t => t),
                
                // Paragraphs
                paragraphs: Array.from(document.querySelectorAll('p')).map(el => el.textContent.trim()).filter(t => t.length > 30),
                
                // Links
                links: Array.from(document.querySelectorAll('a[href]')).slice(0, 50).map(a => ({
                    text: a.textContent.trim(),
                    href: a.href,
                    title: a.title || '',
                })),
                
                // Images
                images: Array.from(document.querySelectorAll('img[src], img[data-src]')).slice(0, 30).map(img => ({
                    src: img.src || img.dataset.src || '',
                    alt: img.alt || '',
                    title: img.title || '',
                })).filter(img => img.src && !img.src.includes('data:')),
                
                // Tables
                tables: Array.from(document.querySelectorAll('table')).slice(0, 5).map(table => {
                    const rows = Array.from(table.querySelectorAll('tr')).slice(0, 10).map(tr => 
                        Array.from(tr.querySelectorAll('th, td')).map(cell => cell.textContent.trim())
                    );
                    return { headers: rows[0] || [], rows: rows.slice(1) };
                }),
                
                // Lists
                lists: Array.from(document.querySelectorAll('ul, ol')).slice(0, 10).map(list => 
                    Array.from(list.querySelectorAll('li')).slice(0, 20).map(li => li.textContent.trim()).filter(t => t)
                ),
                
                // Breadcrumbs
                breadcrumbs: Array.from(document.querySelectorAll('[class*="breadcrumb"], [class*="breadcrumbs"], nav[aria-label*="breadcrumb"]')).flatMap(el => 
                    Array.from(el.querySelectorAll('a, span')).map(x => x.textContent.trim()).filter(t => t)
                ),
                
                // JSON-LD
                schemas: [],
            };
            
            // Extract JSON-LD
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
            
            // Main text
            const main = document.querySelector('article') || document.querySelector('main') || document.querySelector('.content') || document.querySelector('.text');
            data.text = main ? main.textContent.trim().slice(0, 10000) : '';
            
            // Description fallback
            data.description = data.description || data.meta.og_description || 
                data.paragraphs.slice(0, 3).join(' ').slice(0, 300);
            
            return data;
        }'''
    
    async def extract(self, page: Union[SyncPage, AsyncPage]) -> Dict[str, Any]:
        raw_data = await self._evaluate(page, self.extract_evaluator())
        
        cleaned = self.cleaner.clean_all(raw_data)
        
        entities = self.entity_extractor.extract_all(
            cleaned.get('text', '') + ' ' + cleaned.get('title', '')
        )
        
        classification = self.categorizer.classify(cleaned)
        
        internal_links = [l for l in cleaned.get('links', []) if l.get('href', '').startswith('http')]
        external_links = [l for l in cleaned.get('links', []) if l.get('href', '').startswith('http')]
        
        output = {
            'url': '',
            'meta': cleaned.get('meta', {}),
            'title': cleaned.get('title', ''),
            'description': cleaned.get('description', ''),
            
            'content': {
                'headings': {
                    'h1': cleaned.get('h1', []),
                    'h2': cleaned.get('h2', []),
                    'h3': cleaned.get('h3', []),
                },
                'paragraphs': cleaned.get('paragraphs', []),
                'lists': cleaned.get('lists', []),
                'tables': cleaned.get('tables', []),
                'text_raw': cleaned.get('text', ''),
            },
            
            'entities': entities,
            
            'media': {
                'images': cleaned.get('images', []),
            },
            
            'structure': {
                'breadcrumbs': cleaned.get('breadcrumbs', []),
            },
            
            'links': {
                'all': cleaned.get('links', []),
                'internal': internal_links[:20],
                'external': external_links[:20],
            },
            
            'schemas': cleaned.get('schemas', []),
            
            'classification': classification,
            
            'quality': {
                'word_count': len(cleaned.get('text', '').split()),
                'paragraph_count': len(cleaned.get('paragraphs', [])),
                'heading_count': len(cleaned.get('h1', [])) + len(cleaned.get('h2', [])),
                'image_count': len(cleaned.get('images', [])),
                'link_count': len(cleaned.get('links', [])),
                'has_schema': len(cleaned.get('schemas', [])) > 0,
            }
        }
        
        return output
    
    async def _evaluate(self, page, js_code: str):
        if hasattr(page, 'evaluate'):
            return await page.evaluate(js_code)
        return page.evaluate(js_code)
```

---

## Task 5: Update API Endpoint

**Files:**
- Modify: `/home/pedro/repo/scrapengine/python/main.py`

**Step 1: Atualizar o endpoint para usar o super extractor**

```python
from src.extractor.super_extractor import SuperExtractor

super_extractor = SuperExtractor()

@app.post("/extract", response_model=Dict)
async def extract(request: ScrapeRequest) -> Dict:
    playwright, browser, context = await create_stealth_browser()
    
    try:
        page = await context.new_page()
        await asyncio.sleep(1)
        
        response = await page.goto(str(request.url), wait_until="domcontentloaded", timeout=30000)
        
        if response and response.status >= 400:
            raise HTTPException(status_code=response.status, detail=f"HTTP {response.status}")
        
        await asyncio.sleep(2)
        
        result = await super_extractor.extract(page)
        result['url'] = str(request.url)
        result['status_code'] = response.status if response else None
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        await close_stealth_browser(playwright, browser)
```

**Step 2: Testar o endpoint**

```bash
curl -s -X POST http://localhost:8001/extract \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.bbc.com/news"}' | python3 -m json.tool | head -50
```

Expected: Payload completo com meta, content, entities, classification, etc.

---

## Task 6: Testes Finais

**Step 1: Testar múltiplos sites**

```bash
# BBC
curl -s -X POST http://localhost:8001/extract -H "Content-Type: application/json" -d '{"url": "https://www.bbc.com/news"}' > test_bbc.json

# Wikipedia
curl -s -X POST http://localhost:8001/extract -H "Content-Type: application/json" -d '{"url": "https://en.wikipedia.org/wiki/Python"}' > test_wiki.json

# Amazon
curl -s -X POST http://localhost:8001/extract -H "Content-Type: application/json" -d '{"url": "https://www.amazon.com"}' > test_amazon.json
```

**Step 2: Verificar output**

```bash
python3 -c "
import json
with open('test_bbc.json') as f:
    data = json.load(f)
print('Keys:', list(data.keys()))
print('Classification:', data.get('classification'))
print('Quality:', data.get('quality'))
print('Entities:', {k: len(v) for k, v in data.get('entities', {}).items()})
"
```
