import { FastifyInstance } from 'fastify';
import { pool } from '../db/index.js';

export async function sourcesRoutes(app: FastifyInstance): Promise<void> {
  // GET /sources - List all sources
  app.get('/sources', async (request) => {
    const result = await pool.query(
      'SELECT * FROM sources ORDER BY created_at DESC'
    );
    return result.rows;
  });

  // GET /sources/:id - Get single source
  app.get('/sources/:id', async (request) => {
    const { id } = request.params as { id: string };
    const result = await pool.query('SELECT * FROM sources WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      throw { statusCode: 404, message: 'Source not found' };
    }
    return result.rows[0];
  });

  // POST /sources - Create new source
  app.post('/sources', async (request) => {
    const { name, url_pattern, schema_type, scrape_interval_minutes } = request.body as {
      name: string;
      url_pattern: string;
      schema_type?: string;
      scrape_interval_minutes?: number;
    };

    if (!name || !url_pattern) {
      throw { statusCode: 400, message: 'name and url_pattern are required' };
    }

    const result = await pool.query(
      `INSERT INTO sources (name, url_pattern, schema_type, scrape_interval_minutes)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [name, url_pattern, schema_type || 'JobPosting', scrape_interval_minutes || 240]
    );

    return result.rows[0];
  });

  // PUT /sources/:id - Update source
  app.put('/sources/:id', async (request) => {
    const { id } = request.params as { id: string };
    const { name, url_pattern, schema_type, scrape_interval_minutes, is_active } = request.body as {
      name?: string;
      url_pattern?: string;
      schema_type?: string;
      scrape_interval_minutes?: number;
      is_active?: boolean;
    };

    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (name !== undefined) { values.push(name); updates.push(`name = $${paramCount++}`); }
    if (url_pattern !== undefined) { values.push(url_pattern); updates.push(`url_pattern = $${paramCount++}`); }
    if (schema_type !== undefined) { values.push(schema_type); updates.push(`schema_type = $${paramCount++}`); }
    if (scrape_interval_minutes !== undefined) { values.push(scrape_interval_minutes); updates.push(`scrape_interval_minutes = $${paramCount++}`); }
    if (is_active !== undefined) { values.push(is_active); updates.push(`is_active = $${paramCount++}`); }

    if (updates.length === 0) {
      throw { statusCode: 400, message: 'No fields to update' };
    }

    values.push(id);
    const result = await pool.query(
      `UPDATE sources SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      throw { statusCode: 404, message: 'Source not found' };
    }

    return result.rows[0];
  });

  // DELETE /sources/:id - Delete source
  app.delete('/sources/:id', async (request) => {
    const { id } = request.params as { id: string };
    const result = await pool.query('DELETE FROM sources WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      throw { statusCode: 404, message: 'Source not found' };
    }
    return { message: 'Source deleted', id };
  });
}
