import { Queue } from 'bullmq';
import { redisConnectionOptions } from './connection.js';

export const scrapeQueue = new Queue('scrape', { connection: redisConnectionOptions });

export interface ScrapeJobData {
  sourceId: string;
  url: string;
  schemaType: string;
}

export async function addScrapeJob(data: ScrapeJobData): Promise<string | undefined> {
  // Validate input
  if (!data.url || !data.sourceId) {
    throw new Error('Missing required job data: url and sourceId are required');
  }
  
  try {
    const job = await scrapeQueue.add('scrape', data, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
    });
    return job.id;
  } catch (error) {
    console.error('Failed to add scrape job:', error);
    throw error;
  }
}
