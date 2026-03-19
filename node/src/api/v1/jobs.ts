import { FastifyInstance } from 'fastify';
import { pool } from '../../db/index.js';
import { clientAuth, ClientAuth } from '../../middleware/auth.js';
import { checkRateLimit } from '../../middleware/rateLimit.js';

export async function v1JobRoutes(app: FastifyInstance): Promise<void> {
  // GET /v1/jobs - List client's jobs
  app.get('/jobs', async (request, reply) => {
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
