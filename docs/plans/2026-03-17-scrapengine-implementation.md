# ScrapEngine Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a complete Agnostic Semantic Scraping Engine with Node.js orchestration, Python scraping, PostgreSQL persistence, and Telegram notifications.

**Architecture:** Hybrid system where Node.js (Fastify + BullMQ) manages queue/scheduling and delegates heavy scraping to Python (Playwright). PostgreSQL stores data and health logs. Telegram delivers notifications.

**Tech Stack:** Fastify, TypeScript, BullMQ, Redis, Python, Playwright, PostgreSQL, Docker Compose

---

## Phase 1: Infrastructure & Environment

### Task 1: Create Docker Compose Configuration

**Files:**
- Create: `docker-compose.yml`

**Step 1: Write docker-compose.yml**

```yaml
version: '3.8'

services:
  # Node.js API + Orchestrator
  node:
    build:
      context: ./node
      dockerfile: Dockerfile
    container_name: scrapengine-node
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://scrapengine:scrap123@postgres:5432/scrapengine
      - REDIS_URL=redis://redis:6379
      - PYTHON_API_URL=http://python:8000
    depends_on:
      - postgres
      - redis
      - python
    volumes:
      - ./node:/app
      - /app/node_modules
    restart: unless-stopped

  # Python Scraper Engine
  python:
    build:
      context: ./python
      dockerfile: Dockerfile
    container_name: scrapengine-python
    ports:
      - "8000:8000"
    environment:
      - PYTHON_ENV=production
    volumes:
      - ./python:/app
    restart: unless-stopped

  # Redis for BullMQ
  redis:
    image: redis:7-alpine
    container_name: scrapengine-redis
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    restart: unless-stopped

  # PostgreSQL Database
  postgres:
    image: postgres:15-alpine
    container_name: scrapengine-postgres
    ports:
      - "5432:5432"
    environment:
      - POSTGRES_DB=scrapengine
      - POSTGRES_USER=scrapengine
      - POSTGRES_PASSWORD=scrap123
    volumes:
      - postgres-data:/var/lib/postgresql/data
    restart: unless-stopped

volumes:
  redis-data:
  postgres-data:
```

**Step 2: Verify docker-compose syntax**

Run: `docker compose config`
Expected: Valid YAML with no errors

**Step 3: Commit**

```bash
git add docker-compose.yml
git commit -m "feat: add docker-compose with Node, Python, Redis, PostgreSQL"
```

---

### Task 2: Setup Node.js Project

**Files:**
- Create: `node/package.json`
- Create: `node/tsconfig.json`
- Create: `node/Dockerfile`
- Create: `node/src/index.ts`

**Step 1: Create package.json**

```json
{
  "name": "scrapengine-node",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest"
  },
  "dependencies": {
    "fastify": "^4.25.0",
    "@fastify/cors": "^8.5.0",
    "bullmq": "^5.1.0",
    "ioredis": "^5.3.2",
    "pg": "^8.11.3",
    "axios": "^1.6.2",
    "uuid": "^9.0.1",
    "dotenv": "^16.3.1",
    "telegraf": "^4.15.0",
    "sha256": "^0.2.0"
  },
  "devDependencies": {
    "@types/node": "^20.10.0",
    "@types/pg": "^8.10.9",
    "@types/uuid": "^9.0.7",
    "typescript": "^5.3.2",
    "tsx": "^4.6.0",
    "vitest": "^1.1.0"
  }
}
```

**Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "node",
    "esModuleInterop": true,
    "strict": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "skipLibCheck": true,
    "declaration": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 3: Create Dockerfile**

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
```

**Step 4: Create src/index.ts skeleton**

```typescript
import Fastify from 'fastify';
import cors from '@fastify/cors';

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });

app.get('/health', async () => ({ status: 'ok' }));

const start = async () => {
  try {
    await app.listen({ port: 3000, host: '0.0.0.0' });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
```

**Step 5: Test build**

Run: `cd node && npm install && npm run build`
Expected: Successful build with dist/index.js

**Step 6: Commit**

```bash
git add node/
git commit -m "feat: setup Node.js project with Fastify"
```

---

### Task 3: Setup Python Project

**Files:**
- Create: `python/requirements.txt`
- Create: `python/Dockerfile`
- Create: `python/main.py`

**Step 1: Create requirements.txt**

```
playwright==1.40.0
fastapi==0.108.0
uvicorn==0.25.0
pydantic==2.5.0
python-dotenv==1.0.0
httpx==0.25.0
```

**Step 2: Create Dockerfile**

```dockerfile
FROM python:3.11-slim

WORKDIR /app

RUN pip install --no-cache-dir playwright && \
    playwright install chromium && \
    playwright install-deps

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**Step 3: Create main.py skeleton**

```python
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="ScrapEngine Python")

class ScrapeRequest(BaseModel):
    url: str
    schema_type: str = "JobPosting"

@app.get("/health")
async def health():
    return {"status": "ok"}

@app.post("/scrape")
async def scrape(request: ScrapeRequest):
    # TODO: Implement scraping logic
    return {"items": [], "count": 0}
```

**Step 4: Test Python imports**

Run: `cd python && pip install -r requirements.txt`
Expected: Successful installation

**Step 5: Commit**

```bash
git add python/
git commit -m "feat: setup Python project with FastAPI and Playwright"
```

---

## Phase 2: Orchestrator (Node.js + BullMQ)

### Task 4: PostgreSQL Database Setup

**Files:**
- Create: `node/src/db/index.ts`
- Create: `node/src/db/schema.sql`

**Step 1: Create schema.sql**

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Sources table
CREATE TABLE sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    url_pattern TEXT NOT NULL,
    schema_type TEXT NOT NULL DEFAULT 'JobPosting',
    scrape_interval_minutes INT NOT NULL DEFAULT 240,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Jobs table
CREATE TABLE jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_id UUID REFERENCES sources(id),
    external_id TEXT,
    title TEXT NOT NULL,
    company TEXT,
    location TEXT,
    description TEXT,
    url TEXT NOT NULL,
    salary_min INT,
    salary_max INT,
    job_type TEXT,
    remote BOOLEAN DEFAULT false,
    hash_content TEXT UNIQUE,
    notified_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Scrape logs table
CREATE TABLE scrape_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_id UUID REFERENCES sources(id),
    status TEXT NOT NULL,
    items_found INT DEFAULT 0,
    error_message TEXT,
    duration_ms INT,
    scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_jobs_hash ON jobs(hash_content);
CREATE INDEX idx_jobs_source ON jobs(source_id);
CREATE INDEX idx_logs_source ON scrape_logs(source_id);
CREATE INDEX idx_logs_date ON scrape_logs(scraped_at);
```

**Step 2: Create node/src/db/index.ts**

```typescript
import pg from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function initDatabase() {
  const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');
  await pool.query(schema);
  console.log('Database initialized');
}
```

**Step 3: Commit**

```bash
git add node/src/db/
git commit -m "feat: add PostgreSQL schema and connection"
```

---

### Task 5: BullMQ Queue Setup

**Files:**
- Create: `node/src/queue/index.ts`
- Create: `node/src/queue/worker.ts`

**Step 1: Create queue/index.ts**

```typescript
import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379');

export const scrapeQueue = new Queue('scrape', { connection });

export interface ScrapeJobData {
  sourceId: string;
  url: string;
  schemaType: string;
}

export async function addScrapeJob(data: ScrapeJobData) {
  await scrapeQueue.add('scrape', data, {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
  });
}
```

**Step 2: Create queue/worker.ts**

```typescript
import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import axios from 'axios';
import { pool } from '../db/index.js';
import type { ScrapeJobData } from './index.js';

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379');

export function createScrapeWorker() {
  return new Worker<ScrapeJobData>('scrape', async (job) => {
    const { sourceId, url, schemaType } = job.data;
    const startTime = Date.now();

    try {
      const response = await axios.post(
        `${process.env.PYTHON_API_URL}/scrape`,
        { url, schema_type: schemaType },
        { timeout: 60000 }
      );

      const duration = Date.now() - startTime;

      await pool.query(
        `INSERT INTO scrape_logs (source_id, status, items_found, duration_ms)
         VALUES ($1, 'success', $2, $3)`,
        [sourceId, response.data.count, duration]
      );

      return response.data;
    } catch (error) {
      const duration = Date.now() - startTime;
      const message = error instanceof Error ? error.message : 'Unknown error';

      await pool.query(
        `INSERT INTO scrape_logs (source_id, status, error_message, duration_ms)
         VALUES ($1, 'failed', $2, $3)`,
        [sourceId, message, duration]
      );

      throw error;
    }
  }, { connection });
}
```

**Step 3: Commit**

```bash
git add node/src/queue/
git commit -m "feat: add BullMQ queue and worker"
```

---

### Task 6: Fastify API Endpoints

**Files:**
- Modify: `node/src/index.ts`
- Create: `node/src/api/sources.ts`
- Create: `node/src/api/jobs.ts`
- Create: `node/src/api/scrape.ts`

**Step 1: Create node/src/api/sources.ts**

```typescript
import { FastifyInstance } from 'fastify';
import { pool } from '../db/index.js';

export async function sourcesRoutes(app: FastifyInstance) {
  app.get('/sources', async () => {
    const result = await pool.query('SELECT * FROM sources ORDER BY created_at DESC');
    return result.rows;
  });

  app.post('/sources', async (request) => {
    const { name, url_pattern, schema_type, scrape_interval_minutes } = request.body as any;
    
    const result = await pool.query(
      `INSERT INTO sources (name, url_pattern, schema_type, scrape_interval_minutes)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [name, url_pattern, schema_type || 'JobPosting', scrape_interval_minutes || 240]
    );
    
    return result.rows[0];
  });

  app.get('/sources/:id', async (request) => {
    const { id } = request.params as any;
    const result = await pool.query('SELECT * FROM sources WHERE id = $1', [id]);
    return result.rows[0] || { error: 'Not found' };
  });
}
```

**Step 2: Create node/src/api/jobs.ts**

```typescript
import { FastifyInstance } from 'fastify';
import { pool } from '../db/index.js';

export async function jobsRoutes(app: FastifyInstance) {
  app.get('/jobs', async (request) => {
    const { source_id, limit = 50, offset = 0 } = request.query as any;
    
    let query = 'SELECT * FROM jobs';
    const params: any[] = [];
    
    if (source_id) {
      params.push(source_id);
      query += ' WHERE source_id = $1';
    }
    
    query += ' ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}';
    params.push(limit, offset);
    
    const result = await pool.query(query, params);
    return result.rows;
  });

  app.get('/jobs/count', async (request) => {
    const { source_id } = request.query as any;
    const query = source_id 
      ? 'SELECT COUNT(*) FROM jobs WHERE source_id = $1'
      : 'SELECT COUNT(*) FROM jobs';
    const params = source_id ? [source_id] : [];
    
    const result = await pool.query(query, params);
    return { count: parseInt(result.rows[0].count) };
  });
}
```

**Step 3: Create node/src/api/scrape.ts**

```typescript
import { FastifyInstance } from 'fastify';
import { addScrapeJob } from '../queue/index.js';
import { pool } from '../db/index.js';

export async function scrapeRoutes(app: FastifyInstance) {
  app.post('/scrape/now', async (request) => {
    const { source_id } = request.body as any;
    
    if (!source_id) {
      return { error: 'source_id is required' };
    }

    const sourceResult = await pool.query(
      'SELECT * FROM sources WHERE id = $1',
      [source_id]
    );

    if (sourceResult.rows.length === 0) {
      return { error: 'Source not found' };
    }

    const source = sourceResult.rows[0];
    
    await addScrapeJob({
      sourceId: source.id,
      url: source.url_pattern,
      schemaType: source.schema_type,
    });

    return { message: 'Scrape job queued', source_id };
  });
}
```

**Step 4: Update index.ts to register routes**

```typescript
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { pool, initDatabase } from './db/index.js';
import { createScrapeWorker } from './queue/worker.js';
import { sourcesRoutes } from './api/sources.js';
import { jobsRoutes } from './api/jobs.js';
import { scrapeRoutes } from './api/scrape.js';

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });

// Register routes
await app.register(sourcesRoutes);
await app.register(jobsRoutes);
await app.register(scrapeRoutes);

app.get('/health', async () => ({ status: 'ok' }));

// Initialize on startup
const start = async () => {
  try {
    await initDatabase();
    createScrapeWorker();
    await app.listen({ port: 3000, host: '0.0.0.0' });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
```

**Step 5: Test TypeScript compilation**

Run: `cd node && npm run build`
Expected: Successful build

**Step 6: Commit**

```bash
git add node/src/api/ node/src/index.ts
git commit -m "feat: add Fastify API endpoints for sources, jobs, scrape"
```

---

### Task 7: Cron Job Scheduling

**Files:**
- Create: `node/src/services/scheduler.ts`

**Step 1: Create scheduler service**

```typescript
import { addScrapeJob } from '../queue/index.js';
import { pool } from '../db/index.js';

export async function startScheduler() {
  // Check every minute for sources that need scraping
  setInterval(async () => {
    await checkAndQueueScrapeJobs();
  }, 60000);
  
  // Initial check
  await checkAndQueueScrapeJobs();
}

async function checkAndQueueScrapeJobs() {
  const sources = await pool.query(
    `SELECT * FROM sources 
     WHERE is_active = true 
     AND (
       last_scrape_at IS NULL 
       OR last_scrape_at < NOW() - (INTERVAL '1 minute' * scrape_interval_minutes)
     )`
  );

  for (const source of sources.rows) {
    await addScrapeJob({
      sourceId: source.id,
      url: source.url_pattern,
      schemaType: source.schema_type,
    });
  }
}
```

**Step 2: Add last_scrape_at to sources schema**

```sql
ALTER TABLE sources ADD COLUMN last_scrape_at TIMESTAMP;
```

**Step 3: Update index.ts to start scheduler**

```typescript
import { startScheduler } from './services/scheduler.js';

// In start function, after worker creation:
await startScheduler();
```

**Step 4: Commit**

```bash
git add node/src/services/scheduler.ts
git commit -m "feat: add cron job scheduler for automatic scraping"
```

---

## Phase 3: Scraper Engine (Python + Playwright)

### Task 8: Playwright Stealth Module

**Files:**
- Create: `python/src/stealth.py`

**Step 1: Create stealth.py**

```python
from playwright.sync_api import sync_playwright
import random
import asyncio

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
]

def create_stealth_browser():
    """Create a stealth browser instance with evasion."""
    playwright = sync_playwright().start()
    
    browser = playwright.chromium.launch(
        headless=True,
        args=[
            '--disable-blink-features=AutomationControlled',
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
        ]
    )
    
    context = browser.new_context(
        user_agent=random.choice(USER_AGENTS),
        viewport={
            'width': random.randint(1200, 1920),
            'height': random.randint(800, 1080),
        },
        locale='en-US',
        timezone_id='America/New_York',
    )
    
    # Stealth scripts to mask automation
    context.add_init_script("""
        Object.defineProperty(navigator, 'webdriver', {
            get: () => undefined
        });
        window.navigator.chrome = {
            runtime: {}
        };
        Object.defineProperty(navigator, 'plugins', {
            get: () => [1, 2, 3, 4, 5]
        });
        Object.defineProperty(navigator, 'languages', {
            get: () => ['en-US', 'en']
        });
    """)
    
    return playwright, browser, context

def close_stealth_browser(playwright, browser):
    """Clean up browser resources."""
    browser.close()
    playwright.stop()
```

**Step 2: Commit**

```bash
git add python/src/stealth.py
git commit -m "feat: add Playwright stealth module with evasion"
```

---

### Task 9: Agnostic Extractor

**Files:**
- Create: `python/src/extractor/__init__.py`
- Create: `python/src/extractor/json_ld.py`
- Create: `python/src/extractor/microdata.py`
- Create: `python/src/extractor/heuristics.py`

**Step 1: Create json_ld.py**

```python
import json
from typing import List, Dict, Any, Optional
from playwright.sync_api import Page

def extract_json_ld(page: Page) -> List[Dict[str, Any]]:
    """Extract JSON-LD structured data."""
    json_ld_scripts = page.query_selector_all('script[type="application/ld+json"]')
    
    results = []
    for script in json_ld_scripts:
        try:
            content = script.inner_text()
            data = json.loads(content)
            
            # Handle @graph (multiple items)
            if isinstance(data, dict) and '@graph' in data:
                results.extend(data['@graph'])
            elif isinstance(data, list):
                results.extend(data)
            else:
                results.append(data)
        except json.JSONDecodeError:
            continue
    
    return results

def filter_by_type(data: List[Dict], schema_type: str) -> List[Dict]:
    """Filter JSON-LD by schema type."""
    filtered = []
    for item in data:
        item_type = item.get('@type', '')
        if isinstance(item_type, list):
            if schema_type in item_type:
                filtered.append(item)
        elif item_type == schema_type:
            filtered.append(item)
    return filtered
```

**Step 2: Create microdata.py**

```python
from playwright.sync_api import Page
from typing import List, Dict, Any

def extract_microdata(page: Page) -> List[Dict[str, Any]]:
    """Extract microdata (itemprop, itemscope)."""
    items = page.query_selector_all('[itemscope]')
    
    results = []
    for item in items:
        item_data = extract_item(item)
        if item_data:
            results.append(item_data)
    
    return results

def extract_item(element) -> Optional[Dict[str, Any]]:
    """Recursively extract itemprop values."""
    result = {}
    
    # Get itemtype
    itemtype = element.get_attribute('itemtype')
    if itemtype:
        result['@type'] = itemtype.split('/')[-1]
    
    # Get all itemprops
    props = element.query_selector_all('[itemprop]')
    for prop in props:
        prop_name = prop.get_attribute('itemprop')
        prop_value = get_prop_value(prop)
        result[prop_name] = prop_value
    
    return result if result else None

def get_prop_value(element) -> Any:
    """Extract value from element based on type."""
    if element.get_attribute('content'):
        return element.get_attribute('content')
    
    tag_name = element.tag_name.lower()
    
    if tag_name == 'meta':
        return element.get_attribute('content')
    elif tag_name == 'img':
        return element.get_attribute('src') or element.get_attribute('alt')
    elif tag_name == 'a':
        return {
            'text': element.inner_text().strip(),
            'href': element.get_attribute('href')
        }
    elif tag_name in ('p', 'span', 'div', 'h1', 'h2', 'h3'):
        return element.inner_text().strip()
    else:
        return element.inner_text().strip()
```

**Step 3: Create heuristics.py**

```python
from playwright.sync_api import Page
from typing import List, Dict, Any
import re

def extract_by_heuristics(page: Page) -> List[Dict[str, Any]]:
    """Extract data using semantic heuristics as fallback."""
    results = []
    
    # Look for common job posting patterns
    # Try role="heading" for titles
    headings = page.query_selector_all('[role="heading"]')
    
    for heading in headings[:10]:  # Limit to first 10
        job_data = extract_job_from_heading(heading, page)
        if job_data:
            results.append(job_data)
    
    return results

def extract_job_from_heading(heading, page) -> Optional[Dict]:
    """Extract job data starting from a heading element."""
    try:
        title = heading.inner_text().strip()
        if not title or len(title) < 3:
            return None
        
        # Try to find related info in parent/sibling elements
        parent = heading.locator('xpath=..').first
        
        # Look for company, location in nearby elements
        company_elem = parent.locator('[class*="company"], [class*="employer"]').first
        location_elem = parent.locator('[class*="location"], [class*="city"]').first
        
        job = {
            '@type': 'JobPosting',
            'title': title,
            'company': company_elem.inner_text().strip() if company_elem.count() > 0 else None,
            'location': location_elem.inner_text().strip() if location_elem.count() > 0 else None,
        }
        
        return job
    except:
        return None
```

**Step 4: Create __init__.py**

```python
from .json_ld import extract_json_ld, filter_by_type
from .microdata import extract_microdata
from .heuristics import extract_by_heuristics

def extract_all(page, schema_type: str):
    """Main extraction function with fallback priority."""
    # Priority 1: JSON-LD
    json_ld_data = extract_json_ld(page)
    filtered = filter_by_type(json_ld_data, schema_type)
    if filtered:
        return filtered
    
    # Priority 2: Microdata
    microdata = extract_microdata(page)
    if microdata:
        return microdata
    
    # Priority 3: Heuristics
    heuristics = extract_by_heuristics(page)
    return heuristics
```

**Step 5: Commit**

```bash
git add python/src/extractor/
git commit -m "feat: add agnostic extractor with JSON-LD, microdata, heuristics"
```

---

### Task 10: Normalizer

**Files:**
- Create: `python/src/normalizer.py`

**Step 1: Create normalizer.py**

```python
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field
from datetime import datetime

class JobPosting(BaseModel):
    title: str
    company: Optional[str] = None
    description: Optional[str] = None
    url: Optional[str] = None
    location: Optional[str] = None
    remote: bool = False
    job_type: Optional[str] = Field(None, alias='employmentType')
    salary_min: Optional[int] = None
    salary_max: Optional[int] = None

def normalize_jobposting(data: Dict[str, Any], source_url: str = "") -> JobPosting:
    """Normalize JobPosting data to standard schema."""
    
    # Map JSON-LD fields to our schema
    return JobPosting(
        title=data.get('title', ''),
        company=data.get('hiringOrganization', {}).get('name') or data.get('company'),
        description=data.get('description') or data.get('jobDescription'),
        url=data.get('url') or data.get('application', {}).get('url') or source_url,
        location=data.get('jobLocation', {}).get('address', {}).get('addressLocality') or data.get('location'),
        remote=detect_remote(data.get('jobLocationType') or data.get('location', '')),
        job_type=data.get('employmentType'),
        salary_min=parse_salary(data.get('estimatedSalary', {}).get('minValue')),
        salary_max=parse_salary(data.get('estimatedSalary', {}).get('maxValue')),
    )

def detect_remote(location_or_value: str) -> bool:
    """Detect if job is remote."""
    remote_keywords = ['remote', 'home', 'anywhere', 'worldwide', 'híbrido', 'hybrid']
    value = str(location_or_value).lower()
    return any(kw in value for kw in remote_keywords)

def parse_salary(value: Any) -> Optional[int]:
    """Parse salary to integer."""
    if not value:
        return None
    if isinstance(value, (int, float)):
        return int(value)
    if isinstance(value, str):
        # Remove currency symbols and commas
        cleaned = re.sub(r'[^\d]', '', value)
        return int(cleaned) if cleaned else None
    return None

def normalize_batch(raw_data: List[Dict], source_url: str = "") -> List[JobPosting]:
    """Normalize a batch of raw job data."""
    normalized = []
    for item in raw_data:
        try:
            job = normalize_jobposting(item, source_url)
            if job.title:  # Only add if has title
                normalized.append(job)
        except Exception as e:
            print(f"Error normalizing job: {e}")
            continue
    
    return normalized
```

**Step 2: Commit**

```bash
git add python/src/normalizer.py
git commit -m "feat: add normalizer for JobPosting schema"
```

---

### Task 11: Integrate Python Scraper API

**Files:**
- Modify: `python/main.py`

**Step 1: Update main.py with full implementation**

```python
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import asyncio
from playwright.sync_api import sync_playwright

from src.stealth import create_stealth_browser, close_stealth_browser
from src.extractor import extract_all
from src.normalizer import normalize_batch

app = FastAPI(title="ScrapEngine Python")

class ScrapeRequest(BaseModel):
    url: str
    schema_type: str = "JobPosting"

class JobOutput(BaseModel):
    title: str
    company: Optional[str] = None
    description: Optional[str] = None
    url: Optional[str] = None
    location: Optional[str] = None
    remote: bool = False
    job_type: Optional[str] = None
    salary_min: Optional[int] = None
    salary_max: Optional[int] = None

@app.get("/health")
async def health():
    return {"status": "ok"}

@app.post("/scrape", response_model=List[JobOutput])
async def scrape(request: ScrapeRequest):
    """Scrape a URL and extract structured data."""
    
    playwright, browser, context = create_stealth_browser()
    
    try:
        page = context.new_page()
        
        # Add human-like delay
        await asyncio.sleep(1)
        
        # Navigate to URL
        response = page.goto(request.url, wait_until="domcontentloaded", timeout=30000)
        
        if response.status >= 400:
            raise HTTPException(status_code=response.status, detail=f"HTTP {response.status}")
        
        # Wait a bit for dynamic content
        await asyncio.sleep(2)
        
        # Extract data using agnostic extractor
        raw_data = extract_all(page, request.schema_type)
        
        # Normalize to standard schema
        jobs = normalize_batch(raw_data, request.url)
        
        return [job.dict() for job in jobs]
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        close_stealth_browser(playwright, browser)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

**Step 2: Test Python server**

Run: `cd python && python -c "from main import app; print('OK')"`
Expected: OK (no import errors)

**Step 3: Commit**

```bash
git add python/main.py
git commit -m "feat: integrate full scraper API with Playwright and normalizer"
```

---

## Phase 4: Intelligence & Delivery

### Task 12: Deduplication Service

**Files:**
- Create: `node/src/services/deduplication.ts`

**Step 1: Create deduplication.ts**

```typescript
import { pool } from '../db/index.js';
import crypto from 'crypto';

export interface JobData {
  title: string;
  company?: string;
  location?: string;
  url: string;
  description?: string;
  sourceId: string;
  remote?: boolean;
  jobType?: string;
  salaryMin?: number;
  salaryMax?: number;
}

export function generateHash(data: JobData): string {
  const content = `${data.title}|${data.company || ''}|${data.url}`;
  return crypto.createHash('sha256').update(content).digest('hex');
}

export async function isJobNew(hash: string): Promise<boolean> {
  const result = await pool.query(
    'SELECT id FROM jobs WHERE hash_content = $1',
    [hash]
  );
  return result.rows.length === 0;
}

export async function saveJob(data: JobData, hash: string): Promise<boolean> {
  const isNew = await isJobNew(hash);
  
  if (!isNew) {
    return false; // Duplicate
  }
  
  await pool.query(
    `INSERT INTO jobs (
      source_id, title, company, location, description, url,
      remote, job_type, salary_min, salary_max, hash_content
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      data.sourceId,
      data.title,
      data.company,
      data.location,
      data.description,
      data.url,
      data.remote || false,
      data.jobType,
      data.salaryMin,
      data.salaryMax,
      hash,
    ]
  );
  
  return true; // New job saved
}
```

**Step 2: Update worker to use deduplication**

```typescript
// In worker.ts, after getting scrape results:
import { saveJob, generateHash } from '../services/deduplication.js';

// Inside job processor:
for (const job of response.data.items) {
  const hash = generateHash({
    title: job.title,
    company: job.company,
    url: job.url,
    sourceId,
  });
  
  const isNew = await saveJob({ ...job, sourceId }, hash);
  if (isNew) {
    newJobs.push(job);
  }
}

// Only notify for new jobs
if (newJobs.length > 0) {
  await notifyTelegram(newJobs);
}
```

**Step 3: Commit**

```bash
git add node/src/services/deduplication.ts
git commit -m "feat: add deduplication service with SHA-256 hashing"
```

---

### Task 13: Telegram Notifier

**Files:**
- Create: `node/src/services/notification.ts`

**Step 1: Create notification.ts**

```typescript
import { Telegraf } from 'telegraf';
import type { JobData } from './deduplication.js';

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || '');

export async function notifyTelegram(jobs: JobData[]) {
  if (!process.env.TELEGRAM_CHAT_ID || jobs.length === 0) {
    return;
  }

  const message = formatJobsMessage(jobs);
  
  try {
    await bot.telegram.sendMessage(
      process.env.TELEGRAM_CHAT_ID,
      message,
      { parse_mode: 'Markdown' }
    );
  } catch (error) {
    console.error('Telegram notification failed:', error);
  }
}

function formatJobsMessage(jobs: JobData[]): string {
  const header = `🆕 *Novas Vagas Encontradas* (${jobs.length})\n\n`;
  
  const jobList = jobs.slice(0, 5).map((job, index) => {
    const remote = job.remote ? ' 🏠 *REMOTE*' : '';
    return `${index + 1}. *${job.title}*\n   🏢 ${job.company || 'N/A'}\n   📍 ${job.location || 'N/A'}${remote}\n   🔗 [Ver vaga](${job.url})\n`;
  }).join('\n');
  
  const footer = jobs.length > 5 ? `\n...e mais ${jobs.length - 5} vagas` : '';
  
  return header + jobList + footer;
}
```

**Step 2: Commit**

```bash
git add node/src/services/notification.ts
git commit -m "feat: add Telegram notification service"
```

---

### Task 14: Logging & Health Alerts

**Files:**
- Create: `node/src/services/health.ts`

**Step 1: Create health.ts**

```typescript
import { pool } from '../db/index.js';

export interface HealthReport {
  sources: number;
  activeSources: number;
  totalJobs: number;
  jobsLast24h: number;
  failedScrapes24h: number;
  avgScrapeTime: number;
}

export async function getHealthReport(): Promise<HealthReport> {
  const [sources, activeSources, totalJobs, jobsLast24h, failedScrapes, avgTime] = await Promise.all([
    pool.query('SELECT COUNT(*) FROM sources'),
    pool.query('SELECT COUNT(*) FROM sources WHERE is_active = true'),
    pool.query('SELECT COUNT(*) FROM jobs'),
    pool.query("SELECT COUNT(*) FROM jobs WHERE created_at > NOW() - INTERVAL '24 hours'"),
    pool.query("SELECT COUNT(*) FROM scrape_logs WHERE status = 'failed' AND scraped_at > NOW() - INTERVAL '24 hours'"),
    pool.query("SELECT AVG(duration_ms) FROM scrape_logs WHERE scraped_at > NOW() - INTERVAL '24 hours'"),
  ]);

  return {
    sources: parseInt(sources.rows[0].count),
    activeSources: parseInt(activeSources.rows[0].count),
    totalJobs: parseInt(totalJobs.rows[0].count),
    jobsLast24h: parseInt(jobsLast24h.rows[0].count),
    failedScrapes24h: parseInt(failedScrapes.rows[0].count),
    avgScrapeTime: Math.round(parseFloat(avgTime.rows[0]?.avg || 0)),
  };
}

export async function checkSourceHealth(): Promise<string[]> {
  const alerts: string[] = [];
  
  // Check for sources with high failure rate
  const failedSources = await pool.query(`
    SELECT s.name, COUNT(l.id) as failures, COUNT(total.id) as total
    FROM sources s
    JOIN scrape_logs l ON s.id = l.source_id AND l.status = 'failed'
    JOIN scrape_logs total ON s.id = total.source_id
    WHERE l.scraped_at > NOW() - INTERVAL '24 hours'
    GROUP BY s.id, s.name
    HAVING COUNT(l.id)::float / COUNT(total.id) > 0.5
  `);
  
  for (const row of failedSources.rows) {
    alerts.push(`⚠️ ${row.name} has ${Math.round(row.failures/row.total*100)}% failure rate`);
  }
  
  // Check for sources returning 0 results
  const emptySources = await pool.query(`
    SELECT s.name
    FROM sources s
    JOIN scrape_logs l ON s.id = l.source_id
    WHERE l.items_found = 0 
    AND l.scraped_at > NOW() - INTERVAL '12 hours'
    AND s.is_active = true
    GROUP BY s.id, s.name
  `);
  
  for (const row of emptySources.rows) {
    alerts.push(`🔍 ${row.name} returned 0 results in last 12h - possible block`);
  }
  
  return alerts;
}
```

**Step 2: Add health endpoint to API**

```typescript
// In api/scrape.ts or new api/health.ts
app.get('/health/detailed', async () => {
  const report = await getHealthReport();
  const alerts = await checkSourceHealth();
  return { ...report, alerts };
});
```

**Step 3: Commit**

```bash
git add node/src/services/health.ts
git commit -m "feat: add health monitoring and alerting service"
```

---

## Final Integration Task

### Task 15: End-to-End Integration

**Files:**
- Modify: `docker-compose.yml`
- Create: `.env.example`

**Step 1: Create .env.example**

```
# Node.js
DATABASE_URL=postgresql://scrapengine:scrap123@postgres:5432/scrapengine
REDIS_URL=redis://redis:6379
PYTHON_API_URL=http://python:8000

# Telegram
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=your_chat_id_here
```

**Step 2: Test full stack**

```bash
# Build all containers
docker compose build

# Start all services
docker compose up -d

# Check logs
docker compose logs -f
```

**Step 3: Verify endpoints**

```bash
curl http://localhost:3000/health
curl http://localhost:8000/health
```

**Step 4: Add initial sources**

```bash
curl -X POST http://localhost:3000/sources \
  -H "Content-Type: application/json" \
  -d '{"name": "Remotive", "url_pattern": "https://remotive.io/api/remote-jobs", "schema_type": "JobPosting", "scrape_interval_minutes": 60}'
```

**Step 5: Trigger first scrape**

```bash
curl -X POST http://localhost:3000/scrape/now \
  -H "Content-Type: application/json" \
  -d '{"source_id": "<source_id_from_previous_step>"}'
```

**Step 6: Commit**

```bash
git add .env.example
git commit -m "feat: complete end-to-end integration and docker setup"
```

---

## Summary

| Phase | Tasks | Description |
|-------|-------|-------------|
| 1 | 3 | Infrastructure: Docker, Node, Python setup |
| 2 | 4 | Orchestrator: DB, Queue, API, Scheduler |
| 3 | 4 | Scraper: Stealth, Extractor, Normalizer, API |
| 4 | 4 | Intelligence: Deduplication, Notifications, Health |
| Integration | 1 | End-to-end testing |
| **Total** | **16** | Complete implementation |

---

## Execution Choice

**Plan complete and saved to `docs/plans/2026-03-17-scrapengine-implementation.md`. Two execution options:**

1. **Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

2. **Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

**Which approach?**
