# ScrapEngine API Service - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement a multi-tenant scraping service with API key authentication, webhook notifications, and complete client management.

**Architecture:** Express/Fastify API with BullMQ job queue, PostgreSQL for persistence, Redis for queue/rate limiting. Webhooks delivered via HTTP POST with HMAC signatures.

**Tech Stack:** Node.js, Fastify, PostgreSQL, Redis, BullMQ, TypeScript

---

## Task 1: Database Schema Migration

**Files:**
- Create: `node/src/db/migrations/001_initial_schema.sql`

**Step 1: Create migration file**

```sql
-- Migration: 001_initial_schema.sql
-- Adds API clients, webhooks, scrape_jobs, and webhook_deliveries tables

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- API Clients table
CREATE TABLE IF NOT EXISTS api_clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    api_key_hash TEXT NOT NULL UNIQUE,
    is_active BOOLEAN DEFAULT true,
    rate_limit_per_minute INT DEFAULT 60,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Webhooks table
CREATE TABLE IF NOT EXISTS webhooks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES api_clients(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    secret TEXT NOT NULL,
    events TEXT[] NOT NULL DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Scrape Jobs table (new unified table)
CREATE TABLE IF NOT EXISTS scrape_jobs (
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

-- Webhook Deliveries log
CREATE TABLE IF NOT EXISTS webhook_deliveries (
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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_api_clients_key ON api_clients(api_key_hash);
CREATE INDEX IF NOT EXISTS idx_webhooks_client ON webhooks(client_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_active ON webhooks(client_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_jobs_client ON scrape_jobs(client_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON scrape_jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_created ON scrape_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deliveries_webhook ON webhook_deliveries(webhook_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_job ON webhook_deliveries(job_id);
```

**Step 2: Commit**

```bash
git add node/src/db/migrations/001_initial_schema.sql
git commit -m "feat: add initial schema migration for API clients and webhooks"
```

---

## Task 2: Auth Middleware

**Files:**
- Create: `node/src/middleware/auth.ts`

**Step 1: Create auth middleware**

```typescript
import { FastifyRequest, FastifyReply } from 'fastify';
import { pool } from '../db/index.js';
import { createHash } from 'crypto';

export interface ClientAuth {
  clientId: string;
  clientName: string;
  rateLimit: number;
}

// Verify admin API key from env
export async function adminAuth(request: FastifyRequest, reply: FastifyReply) {
  const adminKey = process.env.ADMIN_API_KEY;
  
  if (!adminKey) {
    return reply.status(500).send({ 
      error: 'Admin authentication not configured',
      code: 'ADMIN_NOT_CONFIGURED'
    });
  }

  const authHeader = request.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return reply.status(401).send({ 
      error: 'Missing or invalid authorization header',
      code: 'INVALID_AUTH_HEADER'
    });
  }

  const token = authHeader.substring(7);
  
  if (token !== adminKey) {
    return reply.status(401).send({ 
      error: 'Invalid admin API key',
      code: 'INVALID_API_KEY'
    });
  }
}

// Verify client API key from database
export async function clientAuth(request: FastifyRequest, reply: FastifyReply): Promise<ClientAuth | null> {
  const apiKey = request.headers['x-api-key'] as string;
  
  if (!apiKey) {
    return reply.status(401).send({ 
      error: 'Missing X-API-Key header',
      code: 'INVALID_API_KEY'
    });
  }

  const keyHash = createHash('sha256').update(apiKey).digest('hex');
  
  const result = await pool.query(
    'SELECT id, name, is_active, rate_limit_per_minute FROM api_clients WHERE api_key_hash = $1',
    [keyHash]
  );

  if (result.rows.length === 0) {
    return reply.status(401).send({ 
      error: 'Invalid API key',
      code: 'INVALID_API_KEY'
    });
  }

  const client = result.rows[0];
  
  if (!client.is_active) {
    return reply.status(401).send({ 
      error: 'Client account is inactive',
      code: 'CLIENT_INACTIVE'
    });
  }

  return {
    clientId: client.id,
    clientName: client.name,
    rateLimit: client.rate_limit_per_minute
  };
}
```

**Step 2: Commit**

```bash
git add node/src/middleware/auth.ts
git commit -m "feat: add admin and client authentication middleware"
```

---

## Task 3: Rate Limiting Middleware

**Files:**
- Create: `node/src/middleware/rateLimit.ts`

**Step 1: Create rate limiter**

```typescript
import { FastifyRequest, FastifyReply } from 'fastify';
import { redisConnection } from '../queue/connection.js';

interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetAt: Date;
}

const WINDOW_SIZE_SECONDS = 60;

export async function checkRateLimit(
  clientId: string,
  limit: number
): Promise<{ allowed: boolean; info: RateLimitInfo }> {
  const key = `ratelimit:${clientId}`;
  const now = Date.now();
  const windowStart = now - (WINDOW_SIZE_SECONDS * 1000);

  try {
    // Remove old entries
    await redisConnection.zremrangebyscore(key, 0, windowStart);
    
    // Count current entries
    const count = await redisConnection.zcard(key);
    
    if (count >= limit) {
      // Get oldest entry to calculate reset time
      const oldest = await redisConnection.zrange(key, 0, 0, 'WITHSCORES');
      const resetAt = oldest.length >= 2 
        ? new Date(parseInt(oldest[1]) + (WINDOW_SIZE_SECONDS * 1000))
        : new Date(now + (WINDOW_SIZE_SECONDS * 1000));
      
      return {
        allowed: false,
        info: { limit, remaining: 0, resetAt }
      };
    }

    // Add new entry
    await redisConnection.zadd(key, now, `${now}-${Math.random()}`);
    await redisConnection.expire(key, WINDOW_SIZE_SECONDS);

    return {
      allowed: true,
      info: { limit, remaining: limit - count - 1, resetAt: new Date(now + (WINDOW_SIZE_SECONDS * 1000)) }
    };
  } catch (error) {
    console.error('Rate limit check failed:', error);
    // Fail open - allow request if Redis is down
    return {
      allowed: true,
      info: { limit, remaining: limit, resetAt: new Date(now + (WINDOW_SIZE_SECONDS * 1000)) }
    };
  }
}

export function rateLimitHeaders(info: RateLimitInfo) {
  return {
    'X-RateLimit-Limit': info.limit.toString(),
    'X-RateLimit-Remaining': info.remaining.toString(),
    'X-RateLimit-Reset': Math.floor(info.resetAt.getTime() / 1000).toString()
  };
}
```

**Step 2: Commit**

```bash
git add node/src/middleware/rateLimit.ts
git commit -m "feat: add Redis-based rate limiting middleware"
```

---

## Task 4: Error Handler Middleware

**Files:**
- Create: `node/src/middleware/errorHandler.ts`

**Step 1: Create error handler**

```typescript
import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';

export interface ApiError {
  error: string;
  code: string;
  details?: any;
}

export function createError(statusCode: number, message: string, code: string, details?: any): ApiError & { statusCode: number } {
  const error = new Error(message) as any;
  error.statusCode = statusCode;
  error.code = code;
  error.details = details;
  return error;
}

export function errorHandler(error: FastifyError, request: FastifyRequest, reply: FastifyReply) {
  const statusCode = (error as any).statusCode || 500;
  const code = (error as any).code || 'INTERNAL_ERROR';
  const details = (error as any).details;

  request.log.error(error);

  return reply.status(statusCode).send({
    error: error.message,
    code,
    ...(details && { details })
  });
}

export function notFoundHandler(request: FastifyRequest, reply: FastifyReply) {
  return reply.status(404).send({
    error: 'Endpoint not found',
    code: 'NOT_FOUND'
  });
}
```

**Step 2: Commit**

```bash
git add node/src/middleware/errorHandler.ts
git commit -m "feat: add standardized error handler middleware"
```

---

## Task 5: Admin Client Routes

**Files:**
- Create: `node/src/api/admin/clients.ts`

**Step 1: Create admin client routes**

```typescript
import { FastifyInstance } from 'fastify';
import { randomUUID } from 'crypto';
import { createHash } from 'crypto';
import { pool } from '../../db/index.js';
import { adminAuth } from '../../middleware/auth.js';

export async function adminClientRoutes(app: FastifyInstance): Promise<void> {
  // Apply admin auth to all routes
  app.addHook('preHandler', adminAuth);

  // POST /admin/clients - Create client
  app.post('/clients', async (request) => {
    const { name, rate_limit_per_minute } = request.body as {
      name: string;
      rate_limit_per_minute?: number;
    };

    if (!name) {
      throw { statusCode: 400, message: 'name is required', code: 'VALIDATION_ERROR' };
    }

    // Generate API key
    const apiKey = randomUUID().replace(/-/g, '');
    const apiKeyHash = createHash('sha256').update(apiKey).digest('hex');

    const result = await pool.query(
      `INSERT INTO api_clients (name, api_key_hash, rate_limit_per_minute)
       VALUES ($1, $2, $3) RETURNING *`,
      [name, apiKeyHash, rate_limit_per_minute || 60]
    );

    // Return the plaintext API key only on creation
    return {
      ...result.rows[0],
      api_key: apiKey // Only returned once!
    };
  });

  // GET /admin/clients - List clients
  app.get('/clients', async (request) => {
    const { limit = 50, offset = 0 } = request.query as { limit?: number; offset?: number };
    
    const result = await pool.query(
      'SELECT id, name, is_active, rate_limit_per_minute, created_at, updated_at FROM api_clients ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      [limit, offset]
    );
    
    return result.rows;
  });

  // GET /admin/clients/:id - Get client
  app.get('/clients/:id', async (request) => {
    const { id } = request.params as { id: string };
    
    const result = await pool.query(
      'SELECT id, name, is_active, rate_limit_per_minute, created_at, updated_at FROM api_clients WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      throw { statusCode: 404, message: 'Client not found', code: 'NOT_FOUND' };
    }

    return result.rows[0];
  });

  // PUT /admin/clients/:id - Update client
  app.put('/clients/:id', async (request) => {
    const { id } = request.params as { id: string };
    const { name, is_active, rate_limit_per_minute } = request.body as {
      name?: string;
      is_active?: boolean;
      rate_limit_per_minute?: number;
    };

    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (name !== undefined) {
      values.push(name);
      updates.push(`name = $${paramCount++}`);
    }
    if (is_active !== undefined) {
      values.push(is_active);
      updates.push(`is_active = $${paramCount++}`);
    }
    if (rate_limit_per_minute !== undefined) {
      values.push(rate_limit_per_minute);
      updates.push(`rate_limit_per_minute = $${paramCount++}`);
    }

    if (updates.length === 0) {
      throw { statusCode: 400, message: 'No fields to update', code: 'VALIDATION_ERROR' };
    }

    values.push(id);
    const result = await pool.query(
      `UPDATE api_clients SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      throw { statusCode: 404, message: 'Client not found', code: 'NOT_FOUND' };
    }

    return result.rows[0];
  });

  // DELETE /admin/clients/:id - Deactivate client
  app.delete('/clients/:id', async (request) => {
    const { id } = request.params as { id: string };
    
    const result = await pool.query(
      'UPDATE api_clients SET is_active = false WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      throw { statusCode: 404, message: 'Client not found', code: 'NOT_FOUND' };
    }

    return { message: 'Client deactivated', id: result.rows[0].id };
  });

  // POST /admin/clients/:id/regenerate-key - Regenerate API key
  app.post('/clients/:id/regenerate-key', async (request) => {
    const { id } = request.params as { id: string };
    
    // Check client exists
    const checkResult = await pool.query('SELECT id FROM api_clients WHERE id = $1', [id]);
    if (checkResult.rows.length === 0) {
      throw { statusCode: 404, message: 'Client not found', code: 'NOT_FOUND' };
    }

    // Generate new API key
    const apiKey = randomUUID().replace(/-/g, '');
    const apiKeyHash = createHash('sha256').update(apiKey).digest('hex');

    await pool.query(
      'UPDATE api_clients SET api_key_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [apiKeyHash, id]
    );

    return {
      message: 'API key regenerated',
      id,
      api_key: apiKey // Only returned once!
    };
  });
}
```

**Step 2: Commit**

```bash
git add node/src/api/admin/clients.ts
git commit -m "feat: add admin client management endpoints"
```

---

## Task 6: Admin Webhook Routes

**Files:**
- Create: `node/src/api/admin/webhooks.ts`

**Step 1: Create admin webhook routes**

```typescript
import { FastifyInstance } from 'fastify';
import { randomBytes } from 'crypto';
import { pool } from '../../db/index.js';
import { adminAuth } from '../../middleware/auth.js';

export async function adminWebhookRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', adminAuth);

  // GET /admin/clients/:clientId/webhooks - List client's webhooks
  app.get('/clients/:clientId/webhooks', async (request) => {
    const { clientId } = request.params as { clientId: string };
    
    // Verify client exists
    const clientResult = await pool.query('SELECT id FROM api_clients WHERE id = $1', [clientId]);
    if (clientResult.rows.length === 0) {
      throw { statusCode: 404, message: 'Client not found', code: 'NOT_FOUND' };
    }

    const result = await pool.query(
      'SELECT id, client_id, url, events, is_active, created_at FROM webhooks WHERE client_id = $1 ORDER BY created_at DESC',
      [clientId]
    );

    return result.rows;
  });

  // POST /admin/clients/:clientId/webhooks - Create webhook
  app.post('/clients/:clientId/webhooks', async (request) => {
    const { clientId } = request.params as { clientId: string };
    const { url, events } = request.body as {
      url: string;
      events: string[];
    };

    if (!url || !events || !Array.isArray(events)) {
      throw { statusCode: 400, message: 'url and events array are required', code: 'VALIDATION_ERROR' };
    }

    const validEvents = ['started', 'progress', 'completed', 'failed'];
    const invalidEvents = events.filter(e => !validEvents.includes(e));
    if (invalidEvents.length > 0) {
      throw { statusCode: 400, message: `Invalid events: ${invalidEvents.join(', ')}`, code: 'VALIDATION_ERROR' };
    }

    // Verify client exists
    const clientResult = await pool.query('SELECT id FROM api_clients WHERE id = $1', [clientId]);
    if (clientResult.rows.length === 0) {
      throw { statusCode: 404, message: 'Client not found', code: 'NOT_FOUND' };
    }

    // Generate webhook secret
    const secret = randomBytes(32).toString('hex');

    const result = await pool.query(
      `INSERT INTO webhooks (client_id, url, secret, events)
       VALUES ($1, $2, $3, $4) RETURNING id, client_id, url, events, is_active, created_at`,
      [clientId, url, secret, events]
    );

    return {
      ...result.rows[0],
      secret // Only returned on creation
    };
  });

  // DELETE /admin/webhooks/:id - Delete webhook
  app.delete('/webhooks/:id', async (request) => {
    const { id } = request.params as { id: string };
    
    const result = await pool.query(
      'DELETE FROM webhooks WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      throw { statusCode: 404, message: 'Webhook not found', code: 'NOT_FOUND' };
    }

    return { message: 'Webhook deleted', id: result.rows[0].id };
  });
}
```

**Step 2: Commit**

```bash
git add node/src/api/admin/webhooks.ts
git commit -m "feat: add admin webhook management endpoints"
```

---

## Task 7: Webhook Delivery Service

**Files:**
- Create: `node/src/services/webhook.ts`

**Step 1: Create webhook service**

```typescript
import axios from 'axios';
import { createHmac } from 'crypto';
import { pool } from '../db/index.js';

export interface WebhookPayload {
  event: 'started' | 'progress' | 'completed' | 'failed';
  timestamp: string;
  job_id: string;
  url: string;
  status: string;
  progress: number;
  data?: any;
  error?: string | null;
}

export async function getWebhooksForClient(clientId: string, event: string) {
  const result = await pool.query(
    'SELECT * FROM webhooks WHERE client_id = $1 AND is_active = true AND $2 = ANY(events)',
    [clientId, event]
  );
  return result.rows;
}

export function signPayload(payload: string, secret: string): string {
  return 'sha256=' + createHmac('sha256', secret).update(payload).digest('hex');
}

export async function deliverWebhook(webhook: any, payload: WebhookPayload): Promise<boolean> {
  const payloadStr = JSON.stringify(payload);
  const signature = signPayload(payloadStr, webhook.secret);
  
  const maxRetries = parseInt(process.env.WEBHOOK_MAX_RETRIES || '3');
  const timeout = parseInt(process.env.WEBHOOK_TIMEOUT_MS || '5000');

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await axios.post(webhook.url, payload, {
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Event': payload.event
        },
        timeout,
        validateStatus: (status) => status >= 200 && status < 300
      });

      // Log successful delivery
      await pool.query(
        `INSERT INTO webhook_deliveries (webhook_id, job_id, event, payload, response_status, attempt)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [webhook.id, payload.job_id, payload.event, payloadStr, response.status, attempt]
      );

      return true;
    } catch (error) {
      console.error(`Webhook delivery attempt ${attempt} failed:`, error);
      
      if (attempt === maxRetries) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const responseStatus = (error as any).response?.status;
        const responseBody = (error as any).response?.data;

        await pool.query(
          `INSERT INTO webhook_deliveries (webhook_id, job_id, event, payload, response_status, response_body, attempt)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [webhook.id, payload.job_id, payload.event, payloadStr, responseStatus, JSON.stringify(responseBody), attempt]
        );
      }
    }
  }

  return false;
}

export async function triggerWebhooks(clientId: string, payload: WebhookPayload) {
  const webhooks = await getWebhooksForClient(clientId, payload.event);
  
  const promises = webhooks.map(webhook => deliverWebhook(webhook, payload));
  await Promise.allSettled(promises);
}
```

**Step 2: Commit**

```bash
git add node/src/services/webhook.ts
git commit -m "feat: add webhook delivery service with retries and signatures"
```

---

## Task 8: Client V1 Routes - Jobs

**Files:**
- Create: `node/src/api/v1/jobs.ts`

**Step 1: Create client job routes**

```typescript
import { FastifyInstance, FastifyRequest } from 'fastify';
import { pool } from '../../db/index.js';
import { clientAuth } from '../../middleware/auth.js';
import { checkRateLimit, rateLimitHeaders } from '../../middleware/rateLimit.js';
import { ClientAuth } from '../../middleware/auth.js';

export async function v1JobRoutes(app: FastifyInstance): Promise<void> {
  // GET /v1/jobs - List client's jobs
  app.get('/jobs', async (request, reply) => {
    const client = await clientAuth(request, reply) as ClientAuth;
    if (!client) return;

    const rateCheck = await checkRateLimit(client.clientId, client.rateLimit);
    if (!rateCheck.allowed) {
      reply.header('X-RateLimit-Limit', rateCheck.info.limit.toString());
      reply.header('X-RateLimit-Remaining', '0');
      reply.header('X-RateLimit-Reset', Math.floor(rateCheck.info.resetAt.getTime() / 1000).toString());
      return reply.status(429).send({
        error: 'Rate limit exceeded',
        code: 'RATE_LIMITED',
        limit: rateCheck.info.limit,
        remaining: 0,
        reset_at: rateCheck.info.resetAt.toISOString()
      });
    }

    const { limit = 50, offset = 0, status } = request.query as {
      limit?: number;
      offset?: number;
      status?: string;
    };

    let query = 'SELECT * FROM scrape_jobs WHERE client_id = $1';
    const params: any[] = [client.clientId];

    if (status) {
      params.push(status);
      query += ` AND status = $${params.length}`;
    }

    query += ' ORDER BY created_at DESC';
    params.push(limit, offset);
    query += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;

    const result = await pool.query(query, params);
    
    reply.header('X-RateLimit-Remaining', rateCheck.info.remaining.toString());
    return result.rows;
  });

  // GET /v1/jobs/:id - Get job details
  app.get('/jobs/:id', async (request, reply) => {
    const client = await clientAuth(request, reply) as ClientAuth;
    if (!client) return;

    const { id } = request.params as { id: string };
    
    const result = await pool.query(
      'SELECT * FROM scrape_jobs WHERE id = $1 AND client_id = $2',
      [id, client.clientId]
    );

    if (result.rows.length === 0) {
      throw { statusCode: 404, message: 'Job not found', code: 'NOT_FOUND' };
    }

    return result.rows[0];
  });
}
```

**Step 2: Commit**

```bash
git add node/src/api/v1/jobs.ts
git commit -m "feat: add client v1 job listing endpoints"
```

---

## Task 9: Client V1 Routes - Scrape

**Files:**
- Create: `node/src/api/v1/scrape.ts`

**Step 1: Create client scrape routes**

```typescript
import { FastifyInstance } from 'fastify';
import axios from 'axios';
import { pool } from '../../db/index.js';
import { clientAuth, ClientAuth } from '../../middleware/auth.js';
import { checkRateLimit } from '../../middleware/rateLimit.js';
import { triggerWebhooks } from '../../services/webhook.js';
import { addScrapeJob } from '../../queue/index.js';

export async function v1ScrapeRoutes(app: FastifyInstance): Promise<void> {
  // POST /v1/scrape - Create scrape job
  app.post('/scrape', async (request, reply) => {
    const client = await clientAuth(request, reply) as ClientAuth;
    if (!client) return;

    // Check rate limit
    const rateCheck = await checkRateLimit(client.clientId, client.rateLimit);
    if (!rateCheck.allowed) {
      reply.header('X-RateLimit-Limit', rateCheck.info.limit.toString());
      reply.header('X-RateLimit-Remaining', '0');
      reply.header('X-RateLimit-Reset', Math.floor(rateCheck.info.resetAt.getTime() / 1000).toString());
      return reply.status(429).send({
        error: 'Rate limit exceeded',
        code: 'RATE_LIMITED',
        limit: rateCheck.info.limit,
        remaining: 0,
        reset_at: rateCheck.info.resetAt.toISOString()
      });
    }

    const { url } = request.body as { url?: string };

    if (!url) {
      throw { statusCode: 400, message: 'url is required', code: 'VALIDATION_ERROR' };
    }

    // Basic URL validation
    try {
      new URL(url);
    } catch {
      throw { statusCode: 400, message: 'Invalid URL format', code: 'VALIDATION_ERROR' };
    }

    // Create job in database
    const result = await pool.query(
      `INSERT INTO scrape_jobs (client_id, url, status, progress)
       VALUES ($1, $2, 'pending', 0) RETURNING *`,
      [client.clientId, url]
    );

    const job = result.rows[0];

    // Trigger started webhook
    await triggerWebhooks(client.clientId, {
      event: 'started',
      timestamp: new Date().toISOString(),
      job_id: job.id,
      url: job.url,
      status: 'started',
      progress: 0
    });

    // Add to processing queue (background)
    // Note: We'll update job status via the worker

    reply.header('X-RateLimit-Remaining', rateCheck.info.remaining.toString());
    reply.status(202).send({
      job_id: job.id,
      status: 'pending',
      url: job.url,
      created_at: job.created_at
    });
  });
}
```

**Step 2: Commit**

```bash
git add node/src/api/v1/scrape.ts
git commit -m "feat: add client v1 scrape endpoint"
```

---

## Task 10: Client V1 Routes - Webhooks

**Files:**
- Create: `node/src/api/v1/webhooks.ts`

**Step 1: Create client webhook routes**

```typescript
import { FastifyInstance } from 'fastify';
import { randomBytes } from 'crypto';
import { pool } from '../../db/index.js';
import { clientAuth, ClientAuth } from '../../middleware/auth.js';
import { checkRateLimit } from '../../middleware/rateLimit.js';

export async function v1WebhookRoutes(app: FastifyInstance): Promise<void> {
  // GET /v1/webhooks - List client's webhooks
  app.get('/webhooks', async (request, reply) => {
    const client = await clientAuth(request, reply) as ClientAuth;
    if (!client) return;

    const result = await pool.query(
      'SELECT id, url, events, is_active, created_at FROM webhooks WHERE client_id = $1 ORDER BY created_at DESC',
      [client.clientId]
    );

    return result.rows;
  });

  // POST /v1/webhooks - Create webhook
  app.post('/webhooks', async (request, reply) => {
    const client = await clientAuth(request, reply) as ClientAuth;
    if (!client) return;

    // Check rate limit
    const rateCheck = await checkRateLimit(client.clientId, client.rateLimit);
    if (!rateCheck.allowed) {
      return reply.status(429).send({
        error: 'Rate limit exceeded',
        code: 'RATE_LIMITED'
      });
    }

    const { url, events } = request.body as {
      url: string;
      events: string[];
    };

    if (!url || !events || !Array.isArray(events)) {
      throw { statusCode: 400, message: 'url and events array are required', code: 'VALIDATION_ERROR' };
    }

    const validEvents = ['started', 'progress', 'completed', 'failed'];
    const invalidEvents = events.filter(e => !validEvents.includes(e));
    if (invalidEvents.length > 0) {
      throw { statusCode: 400, message: `Invalid events: ${invalidEvents.join(', ')}`, code: 'VALIDATION_ERROR' };
    }

    const secret = randomBytes(32).toString('hex');

    const result = await pool.query(
      `INSERT INTO webhooks (client_id, url, secret, events)
       VALUES ($1, $2, $3, $4) RETURNING id, url, events, is_active, created_at`,
      [client.clientId, url, secret, events]
    );

    return {
      ...result.rows[0],
      secret // Only returned on creation
    };
  });

  // DELETE /v1/webhooks/:id - Delete webhook
  app.delete('/webhooks/:id', async (request, reply) => {
    const client = await clientAuth(request, reply) as ClientAuth;
    if (!client) return;

    const { id } = request.params as { id: string };
    
    const result = await pool.query(
      'DELETE FROM webhooks WHERE id = $1 AND client_id = $2 RETURNING id',
      [id, client.clientId]
    );

    if (result.rows.length === 0) {
      throw { statusCode: 404, message: 'Webhook not found', code: 'NOT_FOUND' };
    }

    return { message: 'Webhook deleted', id: result.rows[0].id };
  });
}
```

**Step 2: Commit**

```bash
git add node/src/api/v1/webhooks.ts
git commit -m "feat: add client v1 webhook management endpoints"
```

---

## Task 11: Update Worker with Webhook Triggers

**Files:**
- Modify: `node/src/queue/worker.ts`

**Step 1: Update worker to trigger webhooks**

```typescript
import { Worker } from 'bullmq';
import axios from 'axios';
import { pool } from '../db/index.js';
import { redisConnectionOptions } from './connection.js';
import { triggerWebhooks } from '../services/webhook.js';
import type { ScrapeJobData } from './index.js';

let scrapeWorker: Worker | null = null;

export function createScrapeWorker(): Worker {
  if (scrapeWorker) {
    return scrapeWorker;
  }

  scrapeWorker = new Worker<ScrapeJobData>('scrape', async (job) => {
    const { jobId, clientId, url } = job.data;
    const startTime = Date.now();
    const timeout = parseInt(process.env.SCRAPE_TIMEOUT || '60000');

    try {
      console.log(`Processing job ${job.id}: scraping ${url}`);
      
      // Update job status to started
      await pool.query(
        'UPDATE scrape_jobs SET status = $1, started_at = CURRENT_TIMESTAMP WHERE id = $2',
        ['started', jobId]
      );

      // Trigger started webhook
      await triggerWebhooks(clientId, {
        event: 'started',
        timestamp: new Date().toISOString(),
        job_id: jobId,
        url,
        status: 'started',
        progress: 10
      });

      // Trigger progress webhook
      await triggerWebhooks(clientId, {
        event: 'progress',
        timestamp: new Date().toISOString(),
        job_id: jobId,
        url,
        status: 'progress',
        progress: 30
      });

      // Make the actual scraping request
      const response = await axios.post(
        `${process.env.PYTHON_API_URL}/extract`,
        { url },
        { timeout }
      );

      // Update progress
      await pool.query(
        'UPDATE scrape_jobs SET status = $1, progress = $2 WHERE id = $3',
        ['progress', 70, jobId]
      );

      await triggerWebhooks(clientId, {
        event: 'progress',
        timestamp: new Date().toISOString(),
        job_id: jobId,
        url,
        status: 'progress',
        progress: 70
      });

      // Save result
      await pool.query(
        `UPDATE scrape_jobs SET 
          status = $1, 
          progress = 100, 
          result = $2, 
          completed_at = CURRENT_TIMESTAMP 
         WHERE id = $3`,
        ['completed', JSON.stringify(response.data), jobId]
      );

      const duration = Date.now() - startTime;

      // Trigger completed webhook
      await triggerWebhooks(clientId, {
        event: 'completed',
        timestamp: new Date().toISOString(),
        job_id: jobId,
        url,
        status: 'completed',
        progress: 100,
        data: response.data
      });

      console.log(`Job ${job.id} completed successfully`);
      return response.data;
    } catch (error) {
      const duration = Date.now() - startTime;
      const message = error instanceof Error ? error.message : 'Unknown error';

      // Update job status to failed
      await pool.query(
        `UPDATE scrape_jobs SET 
          status = $1, 
          error_message = $2, 
          completed_at = CURRENT_TIMESTAMP 
         WHERE id = $3`,
        ['failed', message, jobId]
      );

      // Trigger failed webhook
      await triggerWebhooks(clientId, {
        event: 'failed',
        timestamp: new Date().toISOString(),
        job_id: jobId,
        url,
        status: 'failed',
        progress: 0,
        error: message
      });

      console.error(`Job ${job.id} failed:`, message);
      throw error;
    }
  }, { 
    connection: redisConnectionOptions,
    concurrency: 5,
  });

  return scrapeWorker;
}

export async function closeWorker(): Promise<void> {
  if (scrapeWorker) {
    await scrapeWorker.close();
    scrapeWorker = null;
  }
}
```

**Step 2: Update queue/index.ts to accept jobId and clientId**

```typescript
import { Queue } from 'bullmq';
import { redisConnectionOptions } from './connection.js';

export const scrapeQueue = new Queue('scrape', { connection: redisConnectionOptions });

export interface ScrapeJobData {
  jobId: string;
  clientId: string;
  url: string;
}

export async function addScrapeJob(data: ScrapeJobData): Promise<string | undefined> {
  if (!data.url || !data.jobId || !data.clientId) {
    throw new Error('Missing required job data: url, jobId, and clientId are required');
  }
  
  try {
    const job = await scrapeQueue.add('scrape', data, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
    });
    return job.id;
  } catch (error) {
    console.error('Failed to add scrape job:', error);
    throw error;
  }
}
```

**Step 3: Commit**

```bash
git add node/src/queue/worker.ts node/src/queue/index.ts
git commit -m "feat: integrate webhook triggers into scrape worker"
```

---

## Task 12: Update Main Entry Point

**Files:**
- Modify: `node/src/index.ts`

**Step 1: Update index.ts**

```typescript
import Fastify from 'fastify';
import cors from '@fastify/cors';
import 'dotenv/config';
import { pool, initDatabase } from './db/index.js';
import { createScrapeWorker } from './queue/worker.js';
import { adminClientRoutes } from './api/admin/clients.js';
import { adminWebhookRoutes } from './api/admin/webhooks.js';
import { v1ScrapeRoutes } from './api/v1/scrape.js';
import { v1JobRoutes } from './api/v1/jobs.js';
import { v1WebhookRoutes } from './api/v1/webhooks.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

const app = Fastify({ logger: true });

// Error handling
app.setErrorHandler(errorHandler);
app.setNotFoundHandler(notFoundHandler);

// Configure CORS
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:7650'];
await app.register(cors, { origin: allowedOrigins });

// Health check endpoints
app.get('/health', async () => ({ status: 'ok' }));

app.get('/health/ready', async (request, reply) => {
  try {
    // Check database
    await pool.query('SELECT 1');
    
    // Check Redis
    const redis = await import('ioredis');
    const redisClient = new redis.default({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '7653'),
    });
    await redisClient.ping();
    await redisClient.quit();

    return { status: 'ready', database: 'connected', redis: 'connected' };
  } catch (error) {
    return reply.status(503).send({ 
      status: 'not ready',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Register routes
await app.register(adminClientRoutes, { prefix: '/admin' });
await app.register(adminWebhookRoutes, { prefix: '/admin' });
await app.register(v1ScrapeRoutes, { prefix: '/v1' });
await app.register(v1JobRoutes, { prefix: '/v1' });
await app.register(v1WebhookRoutes, { prefix: '/v1' });

// Initialize on startup
const start = async (): Promise<void> => {
  try {
    await initDatabase();
    createScrapeWorker();
    await app.listen({ port: 7650, host: '0.0.0.0' });
    
    // Verify ADMIN_API_KEY is set
    if (!process.env.ADMIN_API_KEY) {
      console.warn('WARNING: ADMIN_API_KEY not set! Admin endpoints will not work.');
    }
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();

// Add graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down...');
  await app.close();
  process.exit(0);
});
```

**Step 2: Commit**

```bash
git add node/src/index.ts
git commit -m "feat: update main entry point with new routes and health checks"
```

---

## Task 13: Update Environment Example

**Files:**
- Modify: `.env.example`

**Step 1: Update .env.example**

```env
# Admin Authentication
ADMIN_API_KEY=generate-a-strong-random-key-here

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

# Rate Limiting
DEFAULT_RATE_LIMIT=60

# Webhook Settings
WEBHOOK_TIMEOUT_MS=5000
WEBHOOK_MAX_RETRIES=3

# Scrape Settings
SCRAPE_TIMEOUT=60000
ALLOWED_ORIGINS=http://localhost:7650
```

**Step 2: Commit**

```bash
git add .env.example
git commit -m "docs: update .env.example with new configuration options"
```

---

## Task 14: Update README Documentation

**Files:**
- Modify: `README.md`

**Step 1: Update README with new API documentation**

Add sections for:
- Authentication (Admin and Client)
- API Endpoints (Admin and V1)
- Webhook documentation
- Error codes
- Rate limiting

**Step 2: Commit**

```bash
git add README.md
git commit -m "docs: update README with API documentation"
```

---

## Task 15: Update Docker Compose

**Files:**
- Modify: `docker-compose.yml`

**Step 1: Add ADMIN_API_KEY to node service**

```yaml
node:
  # ... existing config ...
  environment:
    - NODE_ENV=development
    - ADMIN_API_KEY=${ADMIN_API_KEY:-changeme-in-production}
    # ... rest of env vars
```

**Step 2: Commit**

```bash
git add docker-compose.yml
git commit -m "feat: add ADMIN_API_KEY to docker compose"
```

---

## Task 16: Update Python API

**Files:**
- Modify: `python/main.py`

**Step 1: Add /extract endpoint**

```python
@app.post("/extract")
async def extract(request: ExtractRequest) -> Dict:
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

**Step 2: Commit**

```bash
git add python/main.py
git commit -m "feat: add /extract endpoint to Python API"
```

---

## Verification Steps

After implementation, verify:

1. **Database migration:**
   ```bash
   psql $DATABASE_URL -f node/src/db/migrations/001_initial_schema.sql
   ```

2. **Admin endpoints work:**
   ```bash
   # Create client
   curl -X POST http://localhost:7650/admin/clients \
     -H "Authorization: Bearer $ADMIN_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{"name": "Test Client"}'
   
   # Should return: { id, name, api_key: "uuid" }
   ```

3. **Client endpoints work:**
   ```bash
   # Create scrape job
   curl -X POST http://localhost:7650/v1/scrape \
     -H "X-API-Key: $CLIENT_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{"url": "https://example.com"}'
   
   # Should return: { job_id, status: "pending" }
   ```

4. **Webhook delivery:**
   - Configure webhook URL
   - Create scrape job
   - Verify webhook received at configured URL

5. **Rate limiting:**
   ```bash
   # Make 61 requests quickly
   # Should receive 429 after limit
   ```

---

## Notes

- API keys are only shown once upon creation - store them securely
- Webhook secrets are also only shown once upon creation
- Rate limiting uses Redis sliding window algorithm
- Webhooks are delivered asynchronously and don't block job completion
- Failed webhook deliveries are logged but don't affect job status
