import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { AdminBearerGuard } from '../auth/guards/admin-bearer.guard';
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';

@Controller('admin/clients')
@UseGuards(AdminBearerGuard)
export class ClientsController {
  constructor(private service: ClientsService) {}

  @Post()
  async create(@Body() dto: CreateClientDto) {
    try {
      const validated = CreateClientDto.parse(dto);
      return this.service.createClient(
        validated.name,
        validated.rateLimitPerMinute
      );
    } catch (error) {
      throw new BadRequestException('Invalid request body');
    }
  }

  @Get()
  async list(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : undefined;
    const parsedOffset = offset ? parseInt(offset, 10) : undefined;
    return this.service.listClients(parsedLimit, parsedOffset);
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    return this.service.getClient(id);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: Partial<CreateClientDto>) {
    try {
      const validated = CreateClientDto.partial().parse(dto);
      return this.service.updateClient(id, validated);
    } catch (error) {
      throw new BadRequestException('Invalid request body');
    }
  }

  @Delete(':id')
  async deactivate(@Param('id') id: string) {
    return this.service.deactivateClient(id);
  }

  @Post(':id/regenerate-key')
  async regenerateKey(@Param('id') id: string) {
    return this.service.regenerateKey(id);
  }
}
