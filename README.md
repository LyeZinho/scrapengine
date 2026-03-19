# ScrapEngine

A powerful, multi-tenant web scraping API service with webhook notifications, API key authentication, and real-time job tracking.

## Features

- **Multi-Tenant API**: Manage multiple clients with individual API keys
- **Webhook Notifications**: Real-time notifications for job status changes
- **Rate Limiting**: Per-client rate limiting with Redis-backed sliding window
- **Secure Authentication**: Admin and client authentication with SHA-256 hashed keys
- **Agnostic Extraction**: Extract data from any website without site-specific configurations
- **Multi-Level Classification**: Automatic categorization into page types, domains, and content types
- **Entity Recognition**: Detects emails, phones, prices, dates, URLs, hashtags, and mentions
- **Smart Cleaning**: Removes ads, trackers, and developer artifacts
- **Schema.org Support**: Extracts structured JSON-LD and microdata
- **Rich Metadata**: Captures OpenGraph, Twitter Cards, and meta tags

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         ScrapEngine API                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐              │
│  │   Admin     │    │  Clients    │    │  Webhooks   │              │
│  │  (API Key)  │    │ (API Keys)  │    │  Manager    │              │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘              │
│         │                  │                  │                      │
│         └──────────────────┼──────────────────┘                      │
│                            ▼                                         │
│                    ┌───────────────┐                                 │
│                    │  Rate Limiter │                                 │
│                    └───────┬───────┘                                 │
│                            ▼                                         │
│              ┌─────────────────────────┐                              │
│              │      Scrape Jobs        │                              │
│              │   (BullMQ + Redis)     │                              │
│              └───────────┬────────────┘                              │
│                          │                                           │
│         ┌────────────────┼────────────────┐                          │
│         ▼                ▼                ▼                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │
│  │  Started     │  │  Progress   │  │  Completed   │                 │
│  │  (webhook)   │  │  (webhook)  │  │  (webhook)  │                 │
│  └─────────────┘  └─────────────┘  └─────────────┘                 │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Quick Start

### Prerequisites

- Docker & Docker Compose
- 4GB RAM minimum
- Node.js 20+ (for local development)
- PostgreSQL 15+ (for local development)
- Redis 7+ (for local development)

### Installation

```bash
# Clone the repository
git clone https://github.com/LyeZinho/scrapengine.git
cd scrapengine

# Generate admin API key
openssl rand -hex 32

# Create .env file
cat > .env << EOF
ADMIN_API_KEY=<your-generated-key>
DB_PASSWORD=scrap123
EOF

# Start services
docker compose up -d

# Verify services
docker compose ps
```

### Services

| Service | Port | Description |
|---------|------|-------------|
| Node API | 7650 | REST API with admin and client endpoints |
| Python Scraper | 7651 | Web scraping engine |
| PostgreSQL | 7652 | Data storage |
| Redis | 7653 | Job queue and rate limiting |

---

## Getting Started

### 1. Create an Admin API Key

Generate a strong random key:

```bash
openssl rand -hex 32
```

Add to your `.env` file:
```env
ADMIN_API_KEY=your-generated-key-here
```

### 2. Create a Client

```bash
curl -X POST http://localhost:7650/admin/clients \
  -H "Authorization: Bearer $ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "My Application"}'
```

**Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "My Application",
  "api_key": "a1b2c3d4e5f6...",  // SAVE THIS! Only shown once
  "is_active": true,
  "rate_limit_per_minute": 60,
  "created_at": "2026-03-19T10:00:00Z"
}
```

### 3. Create a Scrape Job

```bash
curl -X POST http://localhost:7650/v1/scrape \
  -H "X-API-Key: a1b2c3d4e5f6..." \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'
```

**Response:**
```json
{
  "job_id": "660e9501-f30c-52e5-b827-557766551111",
  "status": "pending",
  "url": "https://example.com",
  "created_at": "2026-03-19T10:00:00Z"
}
```

### 4. Check Job Status

```bash
curl http://localhost:7650/v1/jobs \
  -H "X-API-Key: a1b2c3d4e5f6..."

# Or get specific job
curl http://localhost:7650/v1/jobs/660e9501-f30c-52e5-b827-557766551111 \
  -H "X-API-Key: a1b2c3d4e5f6..."
```

---

## API Documentation

### Authentication

**Admin Authentication** (Bearer Token):
```bash
curl -H "Authorization: Bearer YOUR_ADMIN_API_KEY" ...
```

**Client Authentication** (API Key Header):
```bash
curl -H "X-API-Key: YOUR_CLIENT_API_KEY" ...
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
| GET | `/v1/jobs` | List client's jobs |
| GET | `/v1/jobs/:id` | Get job details |
| POST | `/v1/webhooks` | Create webhook |
| GET | `/v1/webhooks` | List webhooks |
| DELETE | `/v1/webhooks/:id` | Delete webhook |

### Public Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Basic health check |
| GET | `/health/ready` | Readiness check (DB + Redis) |

---

## Webhooks

### Event Types

| Event | Description |
|-------|-------------|
| `started` | Job began processing |
| `progress` | Job progress update (30%, 70%) |
| `completed` | Job finished successfully |
| `failed` | Job failed with error |

### Payload Format

```json
{
  "event": "completed",
  "timestamp": "2026-03-19T10:30:00.000Z",
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "url": "https://example.com",
  "status": "completed",
  "progress": 100,
  "data": {
    "title": "Example Domain",
    "description": "...",
    "meta": {...},
    "entities": {...},
    "classification": {...}
  },
  "error": null
}
```

### Signature Verification

Each webhook request includes a signature header:

```
X-Webhook-Signature: sha256=<hmac_hex>
```

Verify the signature in your webhook handler:

```python
import hmac
import hashlib

def verify_signature(payload: bytes, secret: str, signature: str) -> bool:
    expected = 'sha256=' + hmac.new(
        secret.encode(),
        payload,
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature)
```

### Creating Webhooks

```bash
curl -X POST http://localhost:7650/v1/webhooks \
  -H "X-API-Key: YOUR_CLIENT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-server.com/webhook",
    "events": ["started", "completed", "failed"]
  }'
```

**Response:**
```json
{
  "id": "770f0612-g41d-63f6-c938-668877662222",
  "url": "https://your-server.com/webhook",
  "events": ["started", "completed", "failed"],
  "secret": "webhook-secret-key...",  // SAVE THIS! Only shown once
  "is_active": true,
  "created_at": "2026-03-19T10:00:00Z"
}
```

---

## Rate Limiting

Default: **60 requests per minute** per client (configurable).

### Response Headers

```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 59
X-RateLimit-Reset: 1742380260
```

### Rate Limited Response (429)

```json
{
  "error": "Rate limit exceeded",
  "code": "RATE_LIMITED",
  "limit": 60,
  "remaining": 0,
  "reset_at": "2026-03-19T10:31:00.000Z"
}
```

---

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `INVALID_API_KEY` | 401 | API key missing or invalid |
| `CLIENT_INACTIVE` | 401 | Client account disabled |
| `RATE_LIMITED` | 429 | Rate limit exceeded |
| `VALIDATION_ERROR` | 400 | Invalid request body |
| `NOT_FOUND` | 404 | Resource not found |
| `INTERNAL_ERROR` | 500 | Server error |

---

## Environment Variables

```env
# Required
ADMIN_API_KEY=your-admin-key-here

# Ports (defaults shown)
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

# Rate Limiting
DEFAULT_RATE_LIMIT=60

# Webhooks
WEBHOOK_TIMEOUT_MS=5000
WEBHOOK_MAX_RETRIES=3

# Scrape Settings
SCRAPE_TIMEOUT=60000
ALLOWED_ORIGINS=http://localhost:7650
```

---

## Development

### Running Locally

```bash
# Node.js
cd node && npm install && npm run dev

# Python (in another terminal)
cd python
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python main.py
```

### Running Tests

```bash
cd node && npm test
```

### Building Docker Images

```bash
docker compose build
docker compose build python
docker compose build node
```

---

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
| `DOMAIN_HEALTH` | medical, doctor, hospital, wellness |
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

---

## License

MIT License - See LICENSE file for details
