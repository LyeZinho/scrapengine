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

    // Generate API key (UUID format without dashes)
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
