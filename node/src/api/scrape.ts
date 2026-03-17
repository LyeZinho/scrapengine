import { FastifyInstance } from 'fastify';
import { addScrapeJob } from '../queue/index.js';
import { pool } from '../db/index.js';

export async function scrapeRoutes(app: FastifyInstance): Promise<void> {
  // POST /scrape/now - Force scrape a source
  app.post('/scrape/now', async (request) => {
    const { source_id } = request.body as { source_id?: string };

    if (!source_id) {
      throw { statusCode: 400, message: 'source_id is required' };
    }

    const sourceResult = await pool.query(
      'SELECT * FROM sources WHERE id = $1',
      [source_id]
    );

    if (sourceResult.rows.length === 0) {
      throw { statusCode: 404, message: 'Source not found' };
    }

    const source = sourceResult.rows[0];
    
    await addScrapeJob({
      sourceId: source.id,
      url: source.url_pattern,
      schemaType: source.schema_type,
    });

    return { message: 'Scrape job queued', source_id, source_name: source.name };
  });

  // GET /logs - Get scrape logs
  app.get('/logs', async (request) => {
    const { source_id, status, limit = 50, offset = 0 } = request.query as {
      source_id?: string;
      status?: string;
      limit?: number;
      offset?: number;
    };

    let query = 'SELECT l.*, s.name as source_name FROM scrape_logs l JOIN sources s ON l.source_id = s.id';
    const params: any[] = [];
    const conditions: string[] = [];

    if (source_id) {
      params.push(source_id);
      conditions.push(`l.source_id = $${params.length}`);
    }

    if (status) {
      params.push(status);
      conditions.push(`l.status = $${params.length}`);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY l.scraped_at DESC';
    params.push(limit, offset);
    query += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;

    const result = await pool.query(query, params);
    return result.rows;
  });
}
