import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { ClientsModule } from './clients/clients.module';
import { QueueModule } from './queue/queue.module';
import { JobsModule } from './jobs/jobs.module';
import { ScraperModule } from './scraper/scraper.module';
import { ProcessorModule } from './processor/processor.module';
import { ApiV1Module } from './api/v1/api-v1.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    ClientsModule,
    QueueModule,
    JobsModule,
    ScraperModule,
    ProcessorModule,
    ApiV1Module,
    HealthModule,
  ],
})
export class AppModule {}
