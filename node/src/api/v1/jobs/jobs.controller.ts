import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { ApiKeyGuard } from '../../../auth/guards/api-key.guard';
import {
  GetClient,
  type ClientContext,
} from '../../../auth/decorators/api-key.decorator';
import { JobsService } from '../../../jobs/jobs.service';

@Controller('v1/jobs')
@UseGuards(ApiKeyGuard)
export class JobsController {
  constructor(private jobsService: JobsService) {}

  @Get()
  async list(
    @GetClient() client: ClientContext,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : undefined;
    const parsedOffset = offset ? parseInt(offset, 10) : undefined;
    return this.jobsService.listJobsByClient(client.id, parsedLimit, parsedOffset);
  }

  @Get(':id')
  async get(@GetClient() client: ClientContext, @Param('id') id: string) {
    const job = await this.jobsService.getJob(id);
    if (job.clientId !== client.id) {
      throw new ForbiddenException('Not your job');
    }
    return job;
  }
}
