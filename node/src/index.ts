import Fastify from 'fastify';
import cors from '@fastify/cors';
import 'dotenv/config';
import { pool, initDatabase } from './db/index.js';
import { createScrapeWorker } from './queue/worker.js';
import { sourcesRoutes } from './api/sources.js';
import { jobsRoutes } from './api/jobs.js';
import { scrapeRoutes } from './api/scrape.js';
import { startScheduler, stopScheduler } from './services/scheduler.js';

const app = Fastify({ logger: true });

// Configure CORS
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:7650'];
await app.register(cors, { origin: allowedOrigins });

// Register routes
await app.register(sourcesRoutes, { prefix: '/api' });
await app.register(jobsRoutes, { prefix: '/api' });
await app.register(scrapeRoutes, { prefix: '/api' });

app.get('/health', async () => ({ status: 'ok' }));

// Initialize on startup
const start = async (): Promise<void> => {
  try {
    await initDatabase();
    createScrapeWorker();
    await startScheduler();
    await app.listen({ port: 7650, host: '0.0.0.0' });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();

// Add graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down...');
  await stopScheduler();
  await app.close();
  process.exit(0);
});
