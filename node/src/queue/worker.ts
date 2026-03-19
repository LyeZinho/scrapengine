import { Worker } from 'bullmq';
import axios from 'axios';
import { pool } from '../db/index.js';
import { redisConnectionOptions } from './connection.js';
import type { ScrapeJobData } from './index.js';
import { triggerWebhooks } from '../services/webhook.js';

let scrapeWorker: Worker | null = null;

export function createScrapeWorker(): Worker {
  if (scrapeWorker) {
    return scrapeWorker;
  }

  scrapeWorker = new Worker<ScrapeJobData>('scrape', async (job) => {
    const { jobId, clientId, url } = job.data;
    const startTime = Date.now();
    const timeout = parseInt(process.env.SCRAPE_TIMEOUT || '60000');

    try {
      console.log(`Processing job ${job.id}: scraping ${url}`);
      
      // Update job status to started
      await pool.query(
        'UPDATE scrape_jobs SET status = $1, started_at = CURRENT_TIMESTAMP WHERE id = $2',
        ['started', jobId]
      );

      // Trigger started webhook
      await triggerWebhooks(clientId, {
        event: 'started',
        timestamp: new Date().toISOString(),
        job_id: jobId,
        url,
        status: 'started',
        progress: 10
      });

      // Trigger progress webhook
      await triggerWebhooks(clientId, {
        event: 'progress',
        timestamp: new Date().toISOString(),
        job_id: jobId,
        url,
        status: 'progress',
        progress: 30
      });

      // Make the actual scraping request
      const response = await axios.post(
        `${process.env.PYTHON_API_URL}/extract`,
        { url },
        { timeout }
      );

      // Update progress
      await pool.query(
        'UPDATE scrape_jobs SET status = $1, progress = $2 WHERE id = $3',
        ['progress', 70, jobId]
      );

      await triggerWebhooks(clientId, {
        event: 'progress',
        timestamp: new Date().toISOString(),
        job_id: jobId,
        url,
        status: 'progress',
        progress: 70
      });

      // Save result
      await pool.query(
        `UPDATE scrape_jobs SET 
          status = $1, 
          progress = 100, 
          result = $2, 
          completed_at = CURRENT_TIMESTAMP 
         WHERE id = $3`,
        ['completed', JSON.stringify(response.data), jobId]
      );

      // Trigger completed webhook
      await triggerWebhooks(clientId, {
        event: 'completed',
        timestamp: new Date().toISOString(),
        job_id: jobId,
        url,
        status: 'completed',
        progress: 100,
        data: response.data
      });

      console.log(`Job ${job.id} completed successfully`);
      return response.data;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';

      // Update job status to failed
      await pool.query(
        `UPDATE scrape_jobs SET 
          status = $1, 
          error_message = $2, 
          completed_at = CURRENT_TIMESTAMP 
         WHERE id = $3`,
        ['failed', message, jobId]
      );

      // Trigger failed webhook
      await triggerWebhooks(clientId, {
        event: 'failed',
        timestamp: new Date().toISOString(),
        job_id: jobId,
        url,
        status: 'failed',
        progress: 0,
        error: message
      });

      console.error(`Job ${job.id} failed:`, message);
      throw error;
    }
  }, { 
    connection: redisConnectionOptions,
    concurrency: 5,
  });

  return scrapeWorker;
}

export async function closeWorker(): Promise<void> {
  if (scrapeWorker) {
    await scrapeWorker.close();
    scrapeWorker = null;
  }
}
