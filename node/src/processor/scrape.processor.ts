import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { InjectDb } from '../db/db.provider';
import { ScraperService } from '../scraper/scraper.service';
import { JobsRepository } from '../jobs/jobs.repository';
import type { Database } from '../db/client';

interface ScrapeJobData {
  jobId: string;
  clientId: string;
  url: string;
}

@Processor('scrape')
export class ScrapeProcessor extends WorkerHost {
  constructor(
    private scraperService: ScraperService,
    private jobsRepository: JobsRepository,
    @InjectDb() private db: Database
  ) {
    super();
  }

  async process(job: Job<ScrapeJobData>) {
    const { jobId, url } = job.data;

    await this.jobsRepository.updateStatus(jobId, 'processing', {
      progress: 0,
    });

    try {
      const result = await this.scraperService.scrape(url);

      if (result.status === 'error') {
        await this.jobsRepository.updateStatus(jobId, 'failed', {
          errorMessage: result.error,
        });
        throw new Error(result.error || 'Unknown scraping error');
      }

      await this.jobsRepository.updateStatus(jobId, 'completed', {
        result,
        progress: 100,
      });

      return {
        status: 'completed',
        result,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      await this.jobsRepository.updateStatus(jobId, 'failed', {
        errorMessage,
      });
      throw new Error(`Job ${jobId} failed: ${errorMessage}`);
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<ScrapeJobData>) {
    console.log(`Job ${job.data.jobId} completed`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<ScrapeJobData>, err: Error) {
    console.error(`Job ${job.data.jobId} failed:`, err.message);
  }
}
