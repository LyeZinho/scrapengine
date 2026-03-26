import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { QueueModule } from '../queue/queue.module';
import { ScraperModule } from '../scraper/scraper.module';
import { JobsRepository } from './jobs.repository';
import { JobsService } from './jobs.service';

@Module({
  imports: [DatabaseModule, QueueModule, ScraperModule],
  providers: [JobsRepository, JobsService],
  exports: [JobsService],
})
export class JobsModule {}
