import { Worker } from 'bullmq';
import axios from 'axios';
import { pool } from '../db/index.js';
import { redisConnectionOptions } from './connection.js';
import type { ScrapeJobData } from './index.js';
import { saveJob, generateHash } from '../services/deduplication.js';
import { notifyTelegram } from '../services/notification.js';
import type { JobData } from '../services/deduplication.js';

let scrapeWorker: Worker | null = null;

export function createScrapeWorker(): Worker {
  if (scrapeWorker) {
    return scrapeWorker;
  }

  scrapeWorker = new Worker<ScrapeJobData>('scrape', async (job) => {
    const { sourceId, url, schemaType } = job.data;
    const startTime = Date.now();
    const timeout = parseInt(process.env.SCRAPE_TIMEOUT || '60000');

    try {
      console.log(`Processing job ${job.id}: scraping ${url}`);
      
      const response = await axios.post(
        `${process.env.PYTHON_API_URL}/scrape`,
        { url, schema_type: schemaType },
        { timeout }
      );

      const duration = Date.now() - startTime;

      // Process jobs with deduplication
      const newJobs: JobData[] = [];
      for (const job of response.data.items || []) {
        const jobData: JobData = {
          title: job.title,
          company: job.company,
          location: job.location,
          url: job.url,
          description: job.description,
          sourceId,
          remote: job.remote,
          jobType: job.jobType,
          salaryMin: job.salaryMin,
          salaryMax: job.salaryMax,
        };
        
        const hash = generateHash(jobData);
        const isNew = await saveJob(jobData, hash);
        
        if (isNew) {
          newJobs.push(jobData);
        }
      }

      await pool.query(
        `INSERT INTO scrape_logs (source_id, status, items_found, duration_ms)
         VALUES ($1, 'success', $2, $3)`,
        [sourceId, response.data.count, duration]
      );

      // Send notifications for new jobs
      if (newJobs.length > 0) {
        await notifyTelegram(newJobs);
      }

      console.log(`Job ${job.id} completed: ${response.data.count} items found, ${newJobs.length} new`);
      return response.data;
    } catch (error) {
      const duration = Date.now() - startTime;
      const message = error instanceof Error ? error.message : 'Unknown error';
      const stack = error instanceof Error ? error.stack : undefined;

      await pool.query(
        `INSERT INTO scrape_logs (source_id, status, error_message, duration_ms)
         VALUES ($1, 'failed', $2, $3)`,
        [sourceId, message, duration]
      );

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
