import { FastifyInstance } from 'fastify';
import { pool } from '../db/index.js';

export async function jobsRoutes(app: FastifyInstance): Promise<void> {
  // GET /jobs - List jobs with filters
  app.get('/jobs', async (request) => {
    const { source_id, limit = 50, offset = 0, remote } = request.query as {
      source_id?: string;
      limit?: number;
      offset?: number;
      remote?: boolean;
    };

    let query = 'SELECT j.*, s.name as source_name FROM jobs j JOIN sources s ON j.source_id = s.id';
    const params: any[] = [];
    const conditions: string[] = [];

    if (source_id) {
      params.push(source_id);
      conditions.push(`j.source_id = $${params.length}`);
    }

    if (remote !== undefined) {
      params.push(remote);
      conditions.push(`j.remote = $${params.length}`);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY j.created_at DESC';
    
    params.push(limit, offset);
    query += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;

    const result = await pool.query(query, params);
    return result.rows;
  });

  // GET /jobs/count - Get job count
  app.get('/jobs/count', async (request) => {
    const { source_id } = request.query as { source_id?: string };
    const query = source_id 
      ? 'SELECT COUNT(*) FROM jobs WHERE source_id = $1'
      : 'SELECT COUNT(*) FROM jobs';
    const params = source_id ? [source_id] : [];
    const result = await pool.query(query, params);
    return { count: parseInt(result.rows[0].count) };
  });

  // GET /jobs/:id - Get single job
  app.get('/jobs/:id', async (request) => {
    const { id } = request.params as { id: string };
    const result = await pool.query(
      'SELECT j.*, s.name as source_name FROM jobs j JOIN sources s ON j.source_id = s.id WHERE j.id = $1',
      [id]
    );
    if (result.rows.length === 0) {
      throw { statusCode: 404, message: 'Job not found' };
    }
    return result.rows[0];
  });
}
