# ScrapEngine API Service - Design Document

> **Date:** 2026-03-19
> **Author:** Sisyphus AI Agent
> **Status:** Approved

---

## 1. Overview

Transformar o ScrapEngine num serviço de scraping robusto com autenticação multi-cliente, webhooks para notificações em tempo real, e gestão completa via API.

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        ScrapEngine API                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐        │
│  │   Admin     │    │  Clients    │    │  Webhooks   │        │
│  │  (env auth) │    │ (API Keys)  │    │  Manager    │        │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘        │
│         │                  │                  │                │
│         └──────────────────┼──────────────────┘                │
│                            ▼                                    │
│                    ┌───────────────┐                           │
│                    │  Rate Limiter │                           │
│                    └───────┬───────┘                           │
│                            ▼                                    │
│              ┌─────────────────────────┐                        │
│              │      Scrape Jobs        │                        │
│              │   (BullMQ Queue)       │                        │
│              └───────────┬────────────┘                        │
│                          │                                       │
│         ┌────────────────┼────────────────┐                     │
│         ▼                ▼                ▼                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐           │
│  │  Started     │  │  Progress   │  │  Completed  │           │
│  │  (webhook)   │  │  (webhook)  │  │  (webhook)  │           │
│  └─────────────┘  └─────────────┘  └─────────────┘           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 3. Security Model

### 3.1 Admin Authentication
- **Method:** Bearer Token
- **Source:** `ADMIN_API_KEY` environment variable
- **Header:** `Authorization: Bearer <ADMIN_API_KEY>`
- **Purpose:** Client management, webhook management

### 3.2 Client Authentication
- **Method:** API Key per client
- **Header:** `X-API-Key: <CLIENT_API_KEY>`
- **Storage:** SHA-256 hash in database (keys never stored plaintext)
- **Generation:** UUID v4 format
- **Purpose:** Scraping requests

### 3.3 Rate Limiting
- **Default:** 60 requests per minute per client
- **Configurable:** Per-client via `rate_limit_per_minute`
- **Implementation:** In-memory sliding window

### 3.4 Webhook Security
- **Signature:** HMAC-SHA256
- **Header:** `X-Webhook-Signature`
- **Algorithm:** `HMAC-SHA256(webhook_secret, payload)`

## 4. Database Schema

### 4.1 New Tables

```sql
-- API Clients table
CREATE TABLE api_clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    api_key_hash TEXT NOT NULL UNIQUE,
    is_active BOOLEAN DEFAULT true,
    rate_limit_per_minute INT DEFAULT 60,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Webhooks table
CREATE TABLE webhooks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES api_clients(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    secret TEXT NOT NULL,
    events TEXT[] NOT NULL DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Scrape Jobs table (new unified table)
CREATE TABLE scrape_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES api_clients(id),
    url TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    progress INT DEFAULT 0,
    result JSONB,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP
);

-- Webhook Deliveries log (for retry/debugging)
CREATE TABLE webhook_deliveries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    webhook_id UUID REFERENCES webhooks(id) ON DELETE CASCADE,
    job_id UUID REFERENCES scrape_jobs(id),
    event TEXT NOT NULL,
    payload JSONB NOT NULL,
    response_status INT,
    response_body TEXT,
    attempt INT DEFAULT 1,
    delivered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 4.2 Indexes

```sql
CREATE INDEX idx_api_clients_key ON api_clients(api_key_hash);
CREATE INDEX idx_webhooks_client ON webhooks(client_id);
CREATE INDEX idx_webhooks_active ON webhooks(client_id, is_active) WHERE is_active = true;
CREATE INDEX idx_jobs_client ON scrape_jobs(client_id);
CREATE INDEX idx_jobs_status ON scrape_jobs(status);
CREATE INDEX idx_jobs_created ON scrape_jobs(created_at DESC);
CREATE INDEX idx_deliveries_webhook ON webhook_deliveries(webhook_id);
CREATE INDEX idx_deliveries_job ON webhook_deliveries(job_id);
```

## 5. API Endpoints

### 5.1 Admin Endpoints (require ADMIN_API_KEY)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/admin/clients` | Create client + generate API key |
| GET | `/admin/clients` | List all clients |
| GET | `/admin/clients/:id` | Get client details |
| PUT | `/admin/clients/:id` | Update client |
| DELETE | `/admin/clients/:id` | Deactivate client |
| POST | `/admin/clients/:id/regenerate-key` | Regenerate API key |
| GET | `/admin/clients/:id/webhooks` | List client's webhooks |
| POST | `/admin/clients/:id/webhooks` | Create webhook for client |
| DELETE | `/admin/webhooks/:id` | Delete webhook |

### 5.2 Client Endpoints (require X-API-Key)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/v1/scrape` | Create scrape job |
| GET | `/v1/jobs` | List client's jobs |
| GET | `/v1/jobs/:id` | Get job details |
| POST | `/v1/webhooks` | Create webhook |
| GET | `/v1/webhooks` | List client's webhooks |
| DELETE | `/v1/webhooks/:id` | Delete webhook |

### 5.3 Public Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/health/ready` | Readiness check (DB + Redis) |

## 6. Webhook Events

### 6.1 Event Types
- `started` - Job began processing
- `progress` - Job progress update (0-100)
- `completed` - Job finished successfully
- `failed` - Job failed with error

### 6.2 Payload Format

```json
{
  "event": "completed",
  "timestamp": "2026-03-19T10:30:00.000Z",
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "url": "https://example.com",
  "status": "completed",
  "progress": 100,
  "data": {
    "title": "Page Title",
    "description": "Page description",
    "meta": {...},
    "entities": {...}
  },
  "error": null
}
```

### 6.3 Signature Verification

```
signature = HMAC-SHA256(webhook_secret, raw_body)
header = X-Webhook-Signature: sha256=<hex_digest>
```

## 7. Rate Limiting Response

When rate limited:

```json
{
  "error": "Rate limit exceeded",
  "limit": 60,
  "remaining": 0,
  "reset_at": "2026-03-19T10:31:00.000Z"
}
```

Headers:
- `X-RateLimit-Limit: 60`
- `X-RateLimit-Remaining: 0`
- `X-RateLimit-Reset: 1742380260`

## 8. Error Responses

### 8.1 Standard Error Format

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {}
}
```

### 8.2 Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `INVALID_API_KEY` | 401 | API key missing or invalid |
| `CLIENT_INACTIVE` | 401 | Client account disabled |
| `RATE_LIMITED` | 429 | Rate limit exceeded |
| `VALIDATION_ERROR` | 400 | Invalid request body |
| `NOT_FOUND` | 404 | Resource not found |
| `INTERNAL_ERROR` | 500 | Server error |

## 9. Configuration

### 9.1 Environment Variables

```env
# Admin
ADMIN_API_KEY=your-strong-admin-key-here

# Ports
NODE_PORT=7650
PYTHON_PORT=7651
POSTGRES_PORT=7652
REDIS_PORT=7653

# Database
DATABASE_URL=postgresql://scrapengine:scrap123@localhost:7652/scrapengine
REDIS_URL=redis://localhost:7653

# Python API
PYTHON_API_URL=http://localhost:7651

# Rate Limiting
DEFAULT_RATE_LIMIT=60

# Webhook
WEBHOOK_TIMEOUT_MS=5000
WEBHOOK_MAX_RETRIES=3
```

## 10. Implementation Order

1. Database schema migration
2. Authentication middleware (admin + client)
3. Rate limiting middleware
4. Admin endpoints (clients CRUD)
5. Client endpoints (scrape jobs)
6. Webhook endpoints
7. Webhook delivery system
8. Worker integration with webhooks
9. Documentation updates
10. Testing

## 11. Files to Create/Modify

### New Files
- `node/src/middleware/auth.ts` - Auth middleware
- `node/src/middleware/rateLimit.ts` - Rate limiting
- `node/src/middleware/errorHandler.ts` - Error handling
- `node/src/api/admin/clients.ts` - Admin client routes
- `node/src/api/admin/webhooks.ts` - Admin webhook routes
- `node/src/api/v1/scrape.ts` - Client scrape routes
- `node/src/api/v1/webhooks.ts` - Client webhook routes
- `node/src/api/v1/jobs.ts` - Client job routes
- `node/src/services/webhook.ts` - Webhook delivery service
- `node/src/db/schema.sql` - Updated schema
- `node/src/db/migrations/001_initial_schema.sql` - Migration file

### Files to Modify
- `node/src/index.ts` - Register new routes/middleware
- `node/src/queue/worker.ts` - Add webhook triggers
- `python/main.py` - Add extract endpoint
- `README.md` - Update documentation
- `.env.example` - Add new variables

---

## 12. Acceptance Criteria

- [ ] Admin can create/list/update/delete clients via API
- [ ] Admin can manage webhooks for any client
- [ ] Clients receive unique API key on creation
- [ ] Clients can only access their own jobs/webhooks
- [ ] Rate limiting enforced per client
- [ ] Webhooks delivered for all 4 event types
- [ ] Webhook signatures verifiable
- [ ] Failed webhook deliveries retried 3 times
- [ ] All endpoints return proper error codes
- [ ] Health checks verify DB and Redis connectivity
