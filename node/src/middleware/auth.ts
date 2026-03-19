import { FastifyRequest, FastifyReply } from 'fastify';
import { pool } from '../db/index.js';
import { createHash } from 'crypto';

export interface ClientAuth {
  clientId: string;
  clientName: string;
  rateLimit: number;
}

// Verify admin API key from env
export async function adminAuth(request: FastifyRequest, reply: FastifyReply) {
  const adminKey = process.env.ADMIN_API_KEY;
  
  if (!adminKey) {
    return reply.status(500).send({ 
      error: 'Admin authentication not configured',
      code: 'ADMIN_NOT_CONFIGURED'
    });
  }

  const authHeader = request.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return reply.status(401).send({ 
      error: 'Missing or invalid authorization header',
      code: 'INVALID_AUTH_HEADER'
    });
  }

  const token = authHeader.substring(7);
  
  if (token !== adminKey) {
    return reply.status(401).send({ 
      error: 'Invalid admin API key',
      code: 'INVALID_API_KEY'
    });
  }
}

// Verify client API key from database
export async function clientAuth(request: FastifyRequest, reply: FastifyReply): Promise<ClientAuth | null> {
  const apiKey = request.headers['x-api-key'] as string;
  
  if (!apiKey) {
    return reply.status(401).send({ 
      error: 'Missing X-API-Key header',
      code: 'INVALID_API_KEY'
    });
  }

  const keyHash = createHash('sha256').update(apiKey).digest('hex');
  
  const result = await pool.query(
    'SELECT id, name, is_active, rate_limit_per_minute FROM api_clients WHERE api_key_hash = $1',
    [keyHash]
  );

  if (result.rows.length === 0) {
    return reply.status(401).send({ 
      error: 'Invalid API key',
      code: 'INVALID_API_KEY'
    });
  }

  const client = result.rows[0];
  
  if (!client.is_active) {
    return reply.status(401).send({ 
      error: 'Client account is inactive',
      code: 'CLIENT_INACTIVE'
    });
  }

  return {
    clientId: client.id,
    clientName: client.name,
    rateLimit: client.rate_limit_per_minute
  };
}
