import { Module } from '@nestjs/common';
import { JobsModule } from '../../jobs/jobs.module';
import { AuthModule } from '../../auth/auth.module';
import { DatabaseModule } from '../../database/database.module';
import { ScrapeController } from './scrape/scrape.controller';
import { JobsController } from './jobs/jobs.controller';
import { WebhooksController } from './webhooks/webhooks.controller';

@Module({
  imports: [JobsModule, AuthModule, DatabaseModule],
  controllers: [ScrapeController, JobsController, WebhooksController],
})
export class ApiV1Module {}
