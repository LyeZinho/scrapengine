import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { ClientsModule } from './clients/clients.module';
import { QueueModule } from './queue/queue.module';
import { JobsModule } from './jobs/jobs.module';
import { ScraperModule } from './scraper/scraper.module';
import { ScrapeProcessor } from './queue/scrape.processor';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    ClientsModule,
    QueueModule,
    JobsModule,
    ScraperModule,
  ],
  providers: [ScrapeProcessor],
})
export class AppModule {}
