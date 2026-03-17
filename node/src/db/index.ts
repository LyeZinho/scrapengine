import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

export async function initDatabase(): Promise<void> {
  try {
    // Test connection first
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    
    // Read and execute schema
    const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');
    await pool.query(schema);
    console.log('Database initialized');
  } catch (error) {
    console.error('Database initialization failed:', error);
    // Check if tables already exist (ignore that error)
    if (error instanceof Error && error.message.includes('already exists')) {
      console.log('Tables already exist, skipping schema creation');
      return;
    }
    throw error;
  }
}

export async function closePool(): Promise<void> {
  await pool.end();
  console.log('Database pool closed');
}
