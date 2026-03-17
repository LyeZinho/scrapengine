import { pool } from '../db/index.js';

export interface HealthReport {
  sources: number;
  activeSources: number;
  totalJobs: number;
  jobsLast24h: number;
  failedScrapes24h: number;
  avgScrapeTime: number;
}

export async function getHealthReport(): Promise<HealthReport> {
  const [sources, activeSources, totalJobs, jobsLast24h, failedScrapes, avgTime] = await Promise.all([
    pool.query('SELECT COUNT(*) FROM sources'),
    pool.query('SELECT COUNT(*) FROM sources WHERE is_active = true'),
    pool.query('SELECT COUNT(*) FROM jobs'),
    pool.query("SELECT COUNT(*) FROM jobs WHERE created_at > NOW() - INTERVAL '24 hours'"),
    pool.query("SELECT COUNT(*) FROM scrape_logs WHERE status = 'failed' AND scraped_at > NOW() - INTERVAL '24 hours'"),
    pool.query("SELECT AVG(duration_ms) FROM scrape_logs WHERE scraped_at > NOW() - INTERVAL '24 hours'"),
  ]);

  return {
    sources: parseInt(sources.rows[0].count),
    activeSources: parseInt(activeSources.rows[0].count),
    totalJobs: parseInt(totalJobs.rows[0].count),
    jobsLast24h: parseInt(jobsLast24h.rows[0].count),
    failedScrapes24h: parseInt(failedScrapes.rows[0].count),
    avgScrapeTime: Math.round(parseFloat(avgTime.rows[0]?.avg || 0)),
  };
}

export async function checkSourceHealth(): Promise<string[]> {
  const alerts: string[] = [];
  
  // Check for sources with high failure rate
  const failedSources = await pool.query(`
    SELECT s.name, COUNT(l.id) as failures, COUNT(total.id) as total
    FROM sources s
    JOIN scrape_logs l ON s.id = l.source_id AND l.status = 'failed'
    JOIN scrape_logs total ON s.id = total.source_id
    WHERE l.scraped_at > NOW() - INTERVAL '24 hours'
    GROUP BY s.id, s.name
    HAVING COUNT(l.id)::float / COUNT(total.id) > 0.5
  `);
  
  for (const row of failedSources.rows) {
    alerts.push(`⚠️ ${row.name} has ${Math.round(row.failures/row.total*100)}% failure rate`);
  }
  
  // Check for sources returning 0 results
  const emptySources = await pool.query(`
    SELECT s.name
    FROM sources s
    JOIN scrape_logs l ON s.id = l.source_id
    WHERE l.items_found = 0 
    AND l.scraped_at > NOW() - INTERVAL '12 hours'
    AND s.is_active = true
    GROUP BY s.id, s.name
  `);
  
  for (const row of emptySources.rows) {
    alerts.push(`🔍 ${row.name} returned 0 results in last 12h - possible block`);
  }
  
  return alerts;
}
