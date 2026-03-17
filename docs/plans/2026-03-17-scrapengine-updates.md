# ScrapEngine Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implementar Docker Compose híbrido com portas alternativas e extrator híbrido com categorização automática de conteúdo.

**Architecture:** 
- Docker: Usar portas alternativas (5434, 6382) para evitar conflitos, com script de detecção de serviços existentes
- Extrator: Pipeline de 3 estágios (JSON-LD → Microdata → Fallback CSS) com categorização automática

**Tech Stack:** Docker Compose, PostgreSQL, Redis, Playwright, FastAPI, Python

---

## Task 1: Docker Compose com Portas Alternativas

### Files:
- Modify: `/home/pedro/repo/scrapengine/docker-compose.yml`
- Modify: `/home/pedro/repo/scrapengine/node/.env`

**Step 1: Modificar docker-compose.yml para portas alternativas**

```yaml
# Substituir as linhas das portas:
# Redis: 6382:6379 (em vez de 6379:6379)
# PostgreSQL: 5434:5432 (em vez de 5432:5432)

ports:
  - "6382:6379"  # Redis - evita conflito com porta 6379
  - "5434:5432"  # PostgreSQL - evita conflito com porta 5432
```

**Step 2: Atualizar .env do node**

```env
DATABASE_URL=postgresql://scrapengine:scrap123@localhost:5434/scrapengine
REDIS_URL=redis://localhost:6382
PYTHON_API_URL=http://localhost:8000
NODE_ENV=development
PORT=3000
```

**Step 3: Remover versão obsoleta do docker-compose**

Remover a linha `version: '3.8'` do início do arquivo.

**Step 4: Testar Docker Compose**

```bash
cd /home/pedro/repo/scrapengine
docker compose down 2>/dev/null
docker compose up -d
docker compose ps
```

Expected: 4 serviços rodando (node, python, redis, postgres)

---

## Task 2: Extrator Híbrido com Fallback e Categorização

### Files:
- Modify: `/home/pedro/repo/scrapengine/python/src/extractor/__init__.py`
- Test: `curl -X POST http://localhost:8000/scrape ...`

**Step 1: Implementar extrator com fallback CSS**

```python
"""Agnostic extractor with JSON-LD, microdata, and CSS fallback."""
import json
import re
from typing import List, Dict, Any, Union
from playwright.sync_api import Page as SyncPage
from playwright.async_api import Page as AsyncPage

def extract_json_ld_evaluator() -> str:
    return '''() => {
        const scripts = document.querySelectorAll('script[type="application/ld+json"]');
        const results = [];
        scripts.forEach(script => {
            try {
                const data = JSON.parse(script.textContent);
                if (data['@graph']) {
                    results.push(...data['@graph']);
                } else if (Array.isArray(data)) {
                    results.push(...data);
                } else {
                    results.push(data);
                }
            } catch (e) {}
        });
        return results;
    }'''

def extract_microdata_evaluator() -> str:
    return '''() => {
        const items = document.querySelectorAll('[itemscope]');
        return Array.from(items).map(item => {
            const result = {};
            const props = item.querySelectorAll('[itemprop]');
            props.forEach(prop => {
                result[prop.getAttribute('itemprop')] = prop.textContent.trim();
            });
            return result;
        });
    }'''

def extract_css_fallback_evaluator() -> str:
    return '''() => {
        const results = {
            title: '',
            description: '',
            price: '',
            image: '',
            links: [],
            text: '',
            h1: [],
            h2: [],
            paragraphs: []
        };
        
        // Title
        const titleEl = document.querySelector('h1') || document.querySelector('[itemprop="title"]') || document.querySelector('.title') || document.querySelector('title');
        results.title = titleEl ? titleEl.textContent.trim() : '';
        
        // Description
        const descEl = document.querySelector('[itemprop="description"]') || document.querySelector('meta[name="description"]') || document.querySelector('.description') || document.querySelector('article p');
        results.description = descEl ? descEl.textContent.trim() : '';
        
        // Price
        const priceEl = document.querySelector('[itemprop="price"]') || document.querySelector('.price') || document.querySelector('[class*="price"]');
        results.price = priceEl ? priceEl.textContent.trim() : '';
        
        // Image
        const imgEl = document.querySelector('[itemprop="image"]') || document.querySelector('article img') || document.querySelector('.image img') || document.querySelector('main img');
        results.image = imgEl ? (imgEl.src || imgEl.getAttribute('data-src') || '') : '';
        
        // Links
        const links = document.querySelectorAll('a[href]');
        results.links = Array.from(links).slice(0, 20).map(a => ({
            text: a.textContent.trim(),
            href: a.href
        }));
        
        // Headings
        document.querySelectorAll('h1').forEach(el => results.h1.push(el.textContent.trim()));
        document.querySelectorAll('h2').forEach(el => results.h2.push(el.textContent.trim()));
        
        // Paragraphs
        document.querySelectorAll('p').forEach(el => {
            const text = el.textContent.trim();
            if (text.length > 50) results.paragraphs.push(text);
        });
        
        // Main text content
        const main = document.querySelector('article') || document.querySelector('main') || document.querySelector('.content') || document.querySelector('.text');
        results.text = main ? main.textContent.trim().slice(0, 5000) : '';
        
        return results;
    }'''

def categorize_content(data: Dict[str, Any]) -> str:
    """Categorize content based on extracted data."""
    text = ' '.join([
        data.get('title', ''),
        data.get('description', ''),
        data.get('text', ''),
        ' '.join(data.get('paragraphs', [])),
        ' '.join(data.get('h1', [])),
        ' '.join(data.get('h2', []))
    ]).lower()
    
    # Job keywords
    job_keywords = ['job', 'work', 'hiring', 'employment', 'vacancies', 'vagas', 'emprego', 
                   'career', 'recruit', 'apply', 'salary', 'position', 'contract']
    
    # Product keywords  
    product_keywords = ['price', 'buy', 'cart', 'product', 'produto', 'preço', 'purchase',
                       'shop', 'sale', 'discount', 'offer', 'item', 'sku']
    
    # News keywords
    news_keywords = ['news', 'article', 'published', 'breaking', 'report', 'update',
                    'notícia', 'news', 'journalist', 'editor']
    
    # Event keywords
    event_keywords = ['event', 'schedule', 'date', 'time', 'location', 'venue', 'ticket',
                     'evento', 'data', 'hora', 'local']
    
    if any(kw in text for kw in job_keywords):
        return 'JobPosting'
    elif any(kw in text for kw in product_keywords):
        return 'Product'
    elif any(kw in text for kw in news_keywords):
        return 'NewsArticle'
    elif any(kw in text for kw in event_keywords):
        return 'Event'
    else:
        return 'Generic'

async def _evaluate(page, js_code: str):
    if isinstance(page, AsyncPage):
        return await page.evaluate(js_code)
    return page.evaluate(js_code)

async def extract_all(page: Union[SyncPage, AsyncPage], schema_type: str) -> List[Dict[str, Any]]:
    # Stage 1: JSON-LD
    json_ld_data = await _evaluate(page, extract_json_ld_evaluator())
    
    filtered = []
    for item in json_ld_data:
        item_type = item.get('@type', '')
        if isinstance(item_type, list):
            if schema_type in item_type:
                filtered.append(item)
        elif item_type == schema_type:
            filtered.append(item)
    
    if filtered:
        return filtered
    
    # Stage 2: Microdata
    microdata = await _evaluate(page, extract_microdata_evaluator())
    if microdata:
        return microdata
    
    # Stage 3: CSS Fallback
    css_data = await _evaluate(page, extract_css_fallback_evaluator())
    
    if css_data and (css_data.get('title') or css_data.get('text') or css_data.get('paragraphs')):
        # Add category
        category = categorize_content(css_data)
        css_data['@type'] = category
        css_data['category'] = 'css_fallback'
        return [css_data]
    
    return []
```

**Step 2: Atualizar main.py para retornar dados mesmo vazios**

```python
# Na função scrape, modificar o retorno para sempre retornar algo
# Se a lista estiver vazia, retornar dados do fallback
```

**Step 3: Testar extrator**

```bash
# Testar BBC
curl -s -X POST http://localhost:8000/scrape \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.bbc.com/news", "schema_type": "NewsArticle"}'

# Testar Wikipedia
curl -s -X POST http://localhost:8000/scrape \
  -H "Content-Type: application/json" \
  -d '{"url": "https://en.wikipedia.org/wiki/Python_(programming_language)", "schema_type": "NewsArticle"}'

# Testar Amazon
curl -s -X POST http://localhost:8000/scrape \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.amazon.com/s?k=laptop", "schema_type": "Product"}'
```

Expected: Dados extraídos com categoria identificada

---

## Task 3: Testes Finais

**Step 1: Testar Docker Compose**

```bash
docker compose ps
# Expected: 4 containers rodando
```

**Step 2: Testar API completa**

```bash
curl http://localhost:3000/health
# Expected: {"status":"ok"}
```

**Step 3: Testar múltiplos sites**

Testar pelo menos 5 sites diferentes e verificar que retornam dados categorizados.
