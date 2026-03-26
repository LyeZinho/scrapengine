import { Controller, Get, Post, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiKeyGuard } from '../../../auth/guards/api-key.guard';
import {
  GetClient,
  type ClientContext,
} from '../../../auth/decorators/api-key.decorator';

@Controller('v1/webhooks')
@UseGuards(ApiKeyGuard)
export class WebhooksController {
  @Get()
  async list(@GetClient() client: ClientContext) {
    return [];
  }

  @Post()
  async create(@GetClient() client: ClientContext, @Body() dto: any) {
    return { success: true };
  }

  @Delete(':id')
  async delete(@GetClient() client: ClientContext, @Param('id') id: string) {
    return { success: true };
  }
}
