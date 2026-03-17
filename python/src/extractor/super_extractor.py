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
        }'''
    
    async def extract(self, page: Union[SyncPage, AsyncPage]) -> Dict[str, Any]:
        raw_data = await self._evaluate(page, self.extract_evaluator())
        
        cleaned = self.cleaner.clean_all(raw_data)
        
        text_for_entities = cleaned.get('text', '') + ' ' + cleaned.get('title', '') + ' ' + ' '.join(cleaned.get('paragraphs', []))
        entities = self.entity_extractor.extract_all(text_for_entities)
        
        classification = self.categorizer.classify(cleaned)
        
        internal_links = [l for l in cleaned.get('links', []) if l.get('href', '') and not l.get('href', '').startswith('http')]
        external_links = [l for l in cleaned.get('links', []) if l.get('href', '') and l.get('href', '').startswith('http')]
        
        output = {
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
