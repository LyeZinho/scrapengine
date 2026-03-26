import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { ApiKeyGuard } from './guards/api-key.guard';
import { AdminBearerGuard } from './guards/admin-bearer.guard';

@Module({
  imports: [DatabaseModule],
  providers: [ApiKeyGuard, AdminBearerGuard],
  exports: [ApiKeyGuard, AdminBearerGuard],
})
export class AuthModule {}
