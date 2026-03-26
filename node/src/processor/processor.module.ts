import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ScraperModule } from '../scraper/scraper.module';
import { DatabaseModule } from '../database/database.module';
import { JobsRepository } from '../jobs/jobs.repository';
import { ScrapeProcessor } from './scrape.processor';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'scrape',
    }),
    ScraperModule,
    DatabaseModule,
  ],
  providers: [ScrapeProcessor, JobsRepository],
  exports: [ScrapeProcessor],
})
export class ProcessorModule {}
