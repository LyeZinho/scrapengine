import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { JobsRepository } from './jobs.repository';

interface ScrapeJobData {
  jobId: string;
  clientId: string;
  url: string;
}

@Injectable()
export class JobsService {
  constructor(
    private repository: JobsRepository,
    @InjectQueue('scrape') private scrapeQueue: Queue
  ) {}

  async createJob(clientId: string, url: string) {
    const job = await this.repository.create({
      clientId,
      url,
      status: 'pending',
    });

    await this.scrapeQueue.add(
      'scrape',
      {
        jobId: job.id,
        clientId,
        url,
      } as ScrapeJobData,
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      }
    );

    return job;
  }

  async getJob(id: string) {
    const job = await this.repository.findById(id);
    if (!job) throw new NotFoundException('Job not found');
    return job;
  }

  async listJobsByClient(
    clientId: string,
    limit?: number,
    offset?: number
  ) {
    return this.repository.findByClient(clientId, limit, offset);
  }
}
