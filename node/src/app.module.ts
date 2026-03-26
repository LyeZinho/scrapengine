import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { ClientsModule } from './clients/clients.module';

@Module({
  imports: [DatabaseModule, AuthModule, ClientsModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
