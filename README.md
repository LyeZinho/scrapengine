# ScrapEngine

A powerful, agnostic web scraping engine with multi-level classification and intelligent data extraction.

## Features

- **Agnostic Extraction**: Extracts data from any website without site-specific configurations
- **Multi-Level Classification**: Automatic categorization into page types, domains, and content types
- **Entity Recognition**: Detects emails, phones, prices, dates, URLs, hashtags, and mentions
- **Smart Cleaning**: Removes ads, trackers, and developer artifacts
- **Deduplication**: Eliminates duplicate content
- **Schema.org Support**: Extracts structured JSON-LD and microdata
- **Rich Metadata**: Captures OpenGraph, Twitter Cards, and meta tags

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     ScrapEngine                             │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐     ┌─────────────┐    ┌─────────────┐     │
│  │  Node.js    │     │   Python    │    │ PostgreSQL  │     │
│  │    API      │◄──► │   Scraper   │    │  Database   │     │
│  │             │     │   Engine    │    │             │     │
│  └─────────────┘     └─────────────┘    └─────────────┘     │
│                             │                               │
│                      ┌──────┴──────┐                        │
│                      │   Redis     │                        │
│                      │    Queue    │                        │
│                      └─────────────┘                        │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start

### Prerequisites

- Docker & Docker Compose
- 4GB RAM minimum

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/scrapengine.git
cd scrapengine

# Start the services
docker compose up -d

# Verify services are running
docker compose ps
```

### Services

| Service | Port | Description |
|---------|------|-------------|
| Node API | 7650 | REST API and job scheduler |
| Python Scraper | 7651 | Web scraping engine |
| PostgreSQL | 7652 | Data storage |
| Redis | 7653 | Job queue |

## API Endpoints

### Extract Full Page Data

```bash
POST /extract
Content-Type: application/json

{
  "url": "https://example.com"
}
```

**Response:**

```json
{
  "url": "https://example.com",
  "meta": {
    "title": "Page Title",
    "description": "Page description",
    "keywords": "keyword1, keyword2",
    "og_title": "OpenGraph Title",
    "og_description": "OpenGraph Description",
    "og_image": "https://example.com/image.jpg",
    "og_type": "website",
    "twitter_card": "summary_large_image"
  },
  "title": "Page Title",
  "description": "Page description",
  "content": {
    "headings": {
      "h1": ["Main Heading"],
      "h2": ["Subheading 1", "Subheading 2"],
      "h3": []
    },
    "paragraphs": ["Paragraph 1", "Paragraph 2"],
    "lists": [["Item 1", "Item 2"]],
    "tables": [],
    "text_raw": "Full article text..."
  },
  "entities": {
    "emails": ["contact@example.com"],
    "phones": ["+1-555-123-4567"],
    "prices": ["$99.99", "€49.99"],
    "dates": ["2024-01-15", "January 15, 2024"],
    "urls": ["https://example.com/page"],
    "hashtags": ["#topic"],
    "mentions": ["@username"]
  },
  "media": {
    "images": [
      {
        "src": "https://example.com/image.jpg",
        "alt": "Image description",
        "title": "Image title"
      }
    ]
  },
  "structure": {
    "breadcrumbs": ["Home", "Category", "Page"]
  },
  "links": {
    "all": [...],
    "internal": [...],
    "external": [...]
  },
  "schemas": [...],
  "classification": {
    "page_type": "PAGE_TYPE_ARTICLE",
    "domain": "DOMAIN_TECH",
    "content_types": ["CONTENT_HEADING", "CONTENT_TEXT"],
    "confidence": {
      "page_type": 0.85,
      "domain": 0.92
    },
    "all_page_types": {...},
    "all_domains": {...}
  },
  "quality": {
    "word_count": 1250,
    "paragraph_count": 15,
    "heading_count": 8,
    "image_count": 5,
    "link_count": 42,
    "has_schema": true
  }
}
```

### Scrape (Legacy)

```bash
POST /scrape
Content-Type: application/json

{
  "url": "https://example.com",
  "schema_type": "JobPosting"
}
```

### Health Check

```bash
GET /health
```

## Classification System

### Page Types

| Type | Description |
|------|-------------|
| `PAGE_TYPE_ARTICLE` | News articles, blog posts |
| `PAGE_TYPE_PRODUCT` | E-commerce product pages |
| `PAGE_TYPE_LISTING` | Search results, directories |
| `PAGE_TYPE_PROFILE` | User/company profiles |
| `PAGE_TYPE_MEDIA` | Images, videos, galleries |
| `PAGE_TYPE_DOCUMENT` | PDFs, downloadable files |
| `PAGE_TYPE_APPLICATION` | Web apps, tools |
| `PAGE_TYPE_UNKNOWN` | Unclassified |

### Domain Categories

| Domain | Keywords |
|--------|----------|
| `DOMAIN_JOB` | job, work, hiring, career, employment |
| `DOMAIN_ECOMMERCE` | shop, buy, cart, price, sale |
| `DOMAIN_REALESTATE` | property, house, apartment, rent |
| `DOMAIN_FINANCE` | bank, investment, stock, crypto |
| `DOMAIN_TECH` | software, developer, code, programming |
| `DOMAIN_TRAVEL` | hotel, flight, booking, vacation |
| `DOMAIN_EDUCATION` | course, learn, tutorial, school |
| `DOMAIN_HEECH` | medical, doctor, hospital, wellness |
| `DOMAIN_SOCIAL` | social, network, forum, community |

### Content Types

| Type | Description |
|------|-------------|
| `CONTENT_HEADING` | Headings (h1-h6) |
| `CONTENT_TEXT` | Paragraphs |
| `CONTENT_LIST` | Ordered/unordered lists |
| `CONTENT_TABLE` | HTML tables |
| `CONTENT_QUOTE` | Blockquotes |
| `CONTENT_CODE` | Code snippets |

## Environment Variables

Create a `.env` file:

```env
# API Ports
NODE_PORT=7650
PYTHON_PORT=7651
POSTGRES_PORT=7652
REDIS_PORT=7653

# Database
DB_PASSWORD=scrap123
DATABASE_URL=postgresql://scrapengine:scrap123@localhost:7652/scrapengine
REDIS_URL=redis://localhost:7653

# Python API
PYTHON_API_URL=http://localhost:7651
```

## Development

### Running Locally

```bash
# Install Node dependencies
cd node && npm install

# Install Python dependencies
cd python
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Run Node API
cd node && npm run dev

# Run Python API
cd python && python main.py
```

### Building

```bash
# Build all services
docker compose build

# Build specific service
docker compose build python
docker compose build node
```

## Testing

```bash
# Test extract endpoint
curl -X POST http://localhost:7651/extract \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.bbc.com/news"}'

# Test health
curl http://localhost:7651/health
```

---

## API Documentation

### Authentication

**Admin Authentication (Client Management)**
```bash
curl -X GET http://localhost:7650/admin/clients \
  -H "Authorization: Bearer YOUR_ADMIN_API_KEY"
```

**Client Authentication (Scraping Requests)**
```bash
curl -X POST http://localhost:7650/v1/scrape \
  -H "X-API-Key: YOUR_CLIENT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'
```

### Admin Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/admin/clients` | Create new API client |
| GET | `/admin/clients` | List all clients |
| GET | `/admin/clients/:id` | Get client details |
| PUT | `/admin/clients/:id` | Update client |
| DELETE | `/admin/clients/:id` | Deactivate client |
| POST | `/admin/clients/:id/regenerate-key` | Regenerate API key |
| GET | `/admin/clients/:clientId/webhooks` | List client's webhooks |
| POST | `/admin/clients/:clientId/webhooks` | Create webhook |
| DELETE | `/admin/webhooks/:id` | Delete webhook |

### Client Endpoints (V1)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/v1/scrape` | Create scrape job |
| GET | `/v1/jobs` | List jobs |
| GET | `/v1/jobs/:id` | Get job details |
| POST | `/v1/webhooks` | Create webhook |
| GET | `/v1/webhooks` | List webhooks |
| DELETE | `/v1/webhooks/:id` | Delete webhook |

### Webhooks

**Event Types:**
- `started` - Job began processing
- `progress` - Job progress update (30%, 70%)
- `completed` - Job finished successfully
- `failed` - Job failed with error

**Payload Format:**
```json
{
  "event": "completed",
  "timestamp": "2026-03-19T10:30:00.000Z",
  "job_id": "uuid",
  "url": "https://example.com",
  "status": "completed",
  "progress": 100,
  "data": { ... },
  "error": null
}
```

**Signature Verification:**
```
X-Webhook-Signature: sha256=<hmac_sha256_hex>
```

Verify with: `HMAC-SHA256(webhook_secret, raw_body)`

### Rate Limiting

Default: 60 requests per minute per client

Response headers:
- `X-RateLimit-Limit: 60`
- `X-RateLimit-Remaining: 59`
- `X-RateLimit-Reset: 1742380260`

When exceeded (429):
```json
{
  "error": "Rate limit exceeded",
  "code": "RATE_LIMITED",
  "limit": 60,
  "remaining": 0,
  "reset_at": "2026-03-19T10:31:00.000Z"
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `INVALID_API_KEY` | 401 | API key missing or invalid |
| `CLIENT_INACTIVE` | 401 | Client account disabled |
| `RATE_LIMITED` | 429 | Rate limit exceeded |
| `VALIDATION_ERROR` | 400 | Invalid request body |
| `NOT_FOUND` | 404 | Resource not found |
| `INTERNAL_ERROR` | 500 | Server error |

### Environment Variables

```env
# Required for Admin
ADMIN_API_KEY=your-admin-key

# Optional (with defaults)
NODE_PORT=7650
PYTHON_PORT=7651
POSTGRES_PORT=7652
REDIS_PORT=7653
DEFAULT_RATE_LIMIT=60
WEBHOOK_TIMEOUT_MS=5000
WEBHOOK_MAX_RETRIES=3
SCRAPE_TIMEOUT=60000
```

