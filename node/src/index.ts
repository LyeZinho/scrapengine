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
import { scrapeUrl } from './scraper/index.js';
import { redisConnection } from './queue/connection.js';

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
    await redisConnection.ping();

    return { status: 'ready', database: 'connected', redis: 'connected' };
  } catch (error) {
    return reply.status(503).send({ 
      status: 'not ready',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Scraper endpoints
app.post<{ Body: { url?: string; schema_type?: string } }>('/extract', async (request, reply) => {
  const { url } = request.body;
  
  if (!url || typeof url !== 'string') {
    return reply.status(400).send({ error: 'url is required' });
  }

  try {
    const result = await scrapeUrl(url);
    return result.data;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return reply.status(500).send({ error: message });
  }
});

app.post<{ Body: { url?: string; schema_type?: string } }>('/scrape', async (request, reply) => {
  const { url, schema_type } = request.body;
  
  if (!url || typeof url !== 'string') {
    return reply.status(400).send({ error: 'url is required' });
  }

  try {
    const result = await scrapeUrl(url);
    
    // If schema_type is JobPosting, normalize to JobPosting schema
    if (schema_type === 'JobPosting') {
      const { normalizeJobPosting } = await import('./scraper/normalizer.js');
      const rawData = result.data as Record<string, unknown>;
      const normalized = normalizeJobPosting(rawData as unknown as Record<string, unknown>, url);
      return normalized || result.data;
    }
    
    return result.data;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return reply.status(500).send({ error: message });
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
