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
