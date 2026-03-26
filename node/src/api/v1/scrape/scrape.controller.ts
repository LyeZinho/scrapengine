import {
  Controller,
  Post,
  Body,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ApiKeyGuard } from '../../../auth/guards/api-key.guard';
import {
  GetClient,
  type ClientContext,
} from '../../../auth/decorators/api-key.decorator';
import { JobsService } from '../../../jobs/jobs.service';
import { ScrapeRequestDto } from './dto/scrape-request.dto';

@Controller('v1/scrape')
@UseGuards(ApiKeyGuard)
export class ScrapeController {
  constructor(private jobsService: JobsService) {}

  @Post()
  async create(
    @GetClient() client: ClientContext,
    @Body() dto: ScrapeRequestDto
  ) {
    try {
      const validated = ScrapeRequestDto.parse(dto);
      return this.jobsService.createJob(client.id, validated.url);
    } catch (error) {
      throw new BadRequestException('Invalid request body');
    }
  }
}
