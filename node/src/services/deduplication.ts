import { pool } from '../db/index.js';
import crypto from 'crypto';

export interface JobData {
  title: string;
  company?: string;
  location?: string;
  url: string;
  description?: string;
  sourceId: string;
  remote?: boolean;
  jobType?: string;
  salaryMin?: number;
  salaryMax?: number;
}

export function generateHash(data: JobData): string {
  const content = `${data.title}|${data.company || ''}|${data.url}`;
  return crypto.createHash('sha256').update(content).digest('hex');
}

export async function isJobNew(hash: string): Promise<boolean> {
  const result = await pool.query(
    'SELECT id FROM jobs WHERE hash_content = $1',
    [hash]
  );
  return result.rows.length === 0;
}

export async function saveJob(data: JobData, hash: string): Promise<boolean> {
  const isNew = await isJobNew(hash);
  
  if (!isNew) {
    return false;
  }
  
  await pool.query(
    `INSERT INTO jobs (
      source_id, title, company, location, description, url,
      remote, job_type, salary_min, salary_max, hash_content
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      data.sourceId,
      data.title,
      data.company,
      data.location,
      data.description,
      data.url,
      data.remote || false,
      data.jobType,
      data.salaryMin,
      data.salaryMax,
      hash,
    ]
  );
  
  return true;
}
