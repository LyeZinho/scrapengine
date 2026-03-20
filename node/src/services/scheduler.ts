import { addScrapeJob } from '../queue/index.js';
import { pool } from '../db/index.js';

let schedulerInterval: NodeJS.Timeout | null = null;

export async function startScheduler(): Promise<void> {
  console.log('Starting scheduler...');
  
  // Check every minute for sources that need scraping
  schedulerInterval = setInterval(async () => {
    await checkAndQueueScrapeJobs();
  }, 60000);
  
  // Initial check on startup
  await checkAndQueueScrapeJobs();
}

export async function stopScheduler(): Promise<void> {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log('Scheduler stopped');
  }
}

async function checkAndQueueScrapeJobs(): Promise<void> {
  try {
    const sources = await pool.query(`
      SELECT * FROM sources 
      WHERE is_active = true 
      AND (
        last_scrape_at IS NULL 
        OR last_scrape_at < NOW() - (INTERVAL '1 minute' * scrape_interval_minutes)
      )
    `);

    if (sources.rows.length > 0) {
      console.log(`Found ${sources.rows.length} sources to scrape`);
    }

    const { randomUUID } = await import('crypto');

    for (const source of sources.rows) {
      try {
        await addScrapeJob({
          jobId: randomUUID(),
          clientId: source.client_id,
          url: source.url_pattern,
          sourceId: source.id,
          schemaType: source.schema_type,
        });
        
        // Update last_scrape_at timestamp
        await pool.query(
          'UPDATE sources SET last_scrape_at = NOW() WHERE id = $1',
          [source.id]
        );
        
        console.log(`Queued scrape for source: ${source.name}`);
      } catch (error) {
        console.error(`Failed to queue scrape for ${source.name}:`, error);
      }
    }
  } catch (error) {
    console.error('Scheduler error:', error);
  }
}
