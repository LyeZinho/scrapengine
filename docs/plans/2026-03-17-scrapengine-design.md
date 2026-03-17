# Design: Agnostic Semantic Scraping Engine

**Date:** 2026-03-17  
**Project:** ScrapEngine - Semantic Web Scraping Platform  
**Status:** Approved

---

## 1. Overview

The Agnostic Semantic Scraping Engine is a resilient, high-level data extraction platform that breaks away from traditional CSS-selector-based scrapers. Instead of creating fragile robots for each website, this engine interprets the semantic structure of any web page (jobs, products, news) and converts HTML chaos into structured, normalized data.

### Key Differentiators

- **Semantic Discovery**: Prioritizes invisible metadata (JSON-LD/Schema.org) and content heuristics
- **Hybrid Orchestration**: Node.js (BullMQ) for queue management + Python (Playwright) for execution
- **Stealth Bypass**: Human-like behavior to bypass anti-bot protections

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        DOCKER COMPOSE                               │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐            │
│  │   Node.js    │   │   Python     │   │  PostgreSQL  │            │
│  │  (Fastify)   │◄──►│ (Playwright) │   │   (Dados)   │            │
│  │  + BullMQ    │   │  + Stealth   │   │              │            │
│  └──────────────┘   └──────────────┘   └──────────────┘            │
│         │                  │                  │                     │
│         └──────────────────┼──────────────────┘                     │
│                            │                                         │
│                     ┌──────▼──────┐                                 │
│                     │    Redis    │                                 │
│                     │   (Filas)   │                                 │
│                     └─────────────┘                                 │
└─────────────────────────────────────────────────────────────────────┘
```

### Technology Stack

| Component | Technology | Justification |
|-----------|------------|---------------|
| API | Fastify + TypeScript | High performance, low overhead |
| Queue | BullMQ + Redis | Reliability, exponential retries |
| Scraper | Python + Playwright | Stealth fingerprinting, isolation |
| Database | PostgreSQL | Relational data (jobs, sources, history) |
| Notifications | Telegram Bot API | Markdown format, simple |
| Container | docker-compose | Full orchestration |

---

## 3. Directory Structure

```
scrapengine/
├── docker-compose.yml
├── docs/
│   └── plans/
│       └── 2026-03-17-scrapengine-design.md
├── node/                         # API + Orchestrator
│   ├── src/
│   │   ├── api/                  # Fastify endpoints
│   │   ├── queue/                # BullMQ jobs
│   │   ├── services/             # Business logic
│   │   ├── db/                   # PostgreSQL clients
│   │   ├── types/                # TypeScript interfaces
│   │   └── index.ts
│   ├── package.json
│   └── tsconfig.json
├── python/                       # Scraper Engine
│   ├── src/
│   │   ├── scraper/              # Playwright core
│   │   ├── extractor/            # Agnostic extraction logic
│   │   └── normalizer/           # Schema validation
│   ├── requirements.txt
│   └── main.py
└── README.md
```

---

## 4. Database Schema

### sources
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| name | TEXT | Source name (e.g., "Remotive", "Glassdoor") |
| url_pattern | TEXT | URL pattern to scrape |
| schema_type | TEXT | Schema type: "JobPosting", "Product", etc. |
| scrape_interval_minutes | INT | Interval between scrapes |
| is_active | BOOLEAN | Whether source is active |
| created_at | TIMESTAMP | Creation timestamp |

### jobs
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| source_id | UUID | Foreign key to sources |
| external_id | TEXT | ID from original website |
| title | TEXT | Job title |
| company | TEXT | Company name |
| location | TEXT | Job location |
| description | TEXT | Job description |
| url | TEXT | Original job URL |
| salary_min | INT | Minimum salary (optional) |
| salary_max | INT | Maximum salary (optional) |
| job_type | TEXT | "full-time", "contract", etc. |
| remote | BOOLEAN | Remote position flag |
| hash_content | TEXT | Unique hash for deduplication |
| notified_at | TIMESTAMP | When notification was sent |
| created_at | TIMESTAMP | Creation timestamp |

### scrape_logs
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| source_id | UUID | Foreign key to sources |
| status | TEXT | "success", "failed", "blocked" |
| items_found | INT | Number of items extracted |
| error_message | TEXT | Error details if failed |
| duration_ms | INT | Scraping duration |
| scraped_at | TIMESTAMP | When scraping occurred |

---

## 5. API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /health | Health check |
| GET | /sources | List all registered sources |
| POST | /sources | Add new source |
| POST | /scrape/now | Force scrape a source |
| GET | /jobs | List jobs (with filters) |
| POST | /schedule | Create/modify cron schedule |
| GET | /logs | View scrape logs |

---

## 6. Semantic Extraction (Python)

### Extraction Priority

1. **JSON-LD** → `<script type="application/ld+json">` with `@type: "JobPosting"`
2. **Microdata** → `itemprop`, `itemscope` attributes
3. **Heuristics** → `role="heading"`, `aria-label`, semantic selectors
4. **Fallback** → DOM tree walking (last resort)

### Normalization

Python returns a standardized JSON schema that Node.js validates against TypeScript interfaces before saving.

---

## 7. Deduplication

```typescript
const contentHash = sha256(title + company + url);
const existing = await db.query(
  'SELECT id FROM jobs WHERE hash_content = $1', 
  [contentHash]
);

if (existing.rows.length === 0) {
  await db.saveJob({ ...data, hash: contentHash });
  await notifyTelegram(data);  // Only if new!
}
```

---

## 8. Stealth (Playwright)

- User-agent rotation
- Randomized viewport
- Disabled automation flags
- Human-like delays between actions
- (Optional) Residential proxy

---

## 9. Data Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Cron/API   │────►│   BullMQ    │────►│   Worker    │
│  Trigger    │     │   Queue     │     │   (Node)    │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                               │
                                               ▼ HTTP POST
                                        ┌─────────────┐
                                        │   Python    │
                                        │  Scraper    │
                                        └──────┬──────┘
                                               │
                                               ▼ JSON
                                        ┌─────────────┐
                                        │  Normalize  │
                                        │  + Dedupe   │
                                        └──────┬──────┘
                                               │
                          ┌────────────────────┼────────────────────┐
                          ▼                    ▼                    ▼
                   ┌───────────┐        ┌───────────┐        ┌───────────┐
                   │  Postgres │        │  Telegram │        │  Logs     │
                   │  (Save)   │        │  (Notify) │        │  (Health) │
                   └───────────┘        └───────────┘        └───────────┘
```

---

## 10. Functional Requirements

| ID | Requirement | Description |
|----|-------------|-------------|
| RF01 | Total Agnosticism | Extract job data and product data using the same base logic |
| RF02 | Resilient Persistence | No data loss on container crash (PostgreSQL + BullMQ ACKs) |
| RF03 | Smart Deduplication | No duplicate notifications even with 10 scrapes/day |
| RF04 | Protection Bypass | Access simple bot-protected sites (Cloudflare basic) |
| RF05 | Dynamic Scheduling | Alter scrape frequency without code restart |
| RF06 | Formatted Notification | Deliver results in readable Markdown format |

---

## 11. Initial Sources

For testing:
- **Remotive API** (remotive.io/api/remote-jobs) - Free, simple JSON
- **RemoteOK API** (remoteok.io/api) - JSON, multiple filters
- **Glassdoor** - Web scraping with Playwright stealth

---

## 12. Approval

**Status:** Approved  
**Next Step:** Create implementation plan via writing-plans skill
