import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { HealthService } from './health.service';
import { HealthController } from './health.controller';

@Module({
  imports: [DatabaseModule],
  providers: [HealthService],
  controllers: [HealthController],
})
export class HealthModule {}
