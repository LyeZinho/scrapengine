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
