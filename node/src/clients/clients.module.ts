import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { ClientsRepository } from './clients.repository';
import { ClientsService } from './clients.service';
import { ClientsController } from './clients.controller';

@Module({
  imports: [DatabaseModule],
  providers: [ClientsRepository, ClientsService],
  controllers: [ClientsController],
  exports: [ClientsService],
})
export class ClientsModule {}
