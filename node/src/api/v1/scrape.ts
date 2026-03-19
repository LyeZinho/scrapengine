import { FastifyInstance } from 'fastify';
import { pool } from '../../db/index.js';
import { clientAuth, ClientAuth } from '../../middleware/auth.js';
import { checkRateLimit } from '../../middleware/rateLimit.js';
import { triggerWebhooks } from '../../services/webhook.js';

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

    // Trigger started webhook (async, fire-and-forget)
    triggerWebhooks(client.clientId, {
      event: 'started',
      timestamp: new Date().toISOString(),
      job_id: job.id,
      url: job.url,
      status: 'started',
      progress: 0
    }).catch(err => console.error('Failed to trigger started webhook:', err));

    reply.header('X-RateLimit-Remaining', rateCheck.info.remaining.toString());
    return reply.status(202).send({
      job_id: job.id,
      status: 'pending',
      url: job.url,
      created_at: job.created_at
    });
  });
}
