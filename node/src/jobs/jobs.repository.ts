import { Injectable } from '@nestjs/common';
import { InjectDb } from '../db/db.provider';
import { eq, desc } from 'drizzle-orm';
import { scrapeJobs } from '../db/schema';
import type { Database } from '../db/client';

@Injectable()
export class JobsRepository {
  constructor(@InjectDb() private db: Database) {}

  async create(data: {
    clientId: string;
    url: string;
    status?: string;
    progress?: number;
  }) {
    const [job] = await this.db
      .insert(scrapeJobs)
      .values({
        ...data,
        status: data.status || 'pending',
        progress: data.progress || 0,
      })
      .returning();
    return job;
  }

  async findById(id: string) {
    const [job] = await this.db
      .select()
      .from(scrapeJobs)
      .where(eq(scrapeJobs.id, id))
      .limit(1);
    return job || null;
  }

  async findByClient(
    clientId: string,
    limit: number = 50,
    offset: number = 0
  ) {
    return this.db
      .select()
      .from(scrapeJobs)
      .where(eq(scrapeJobs.clientId, clientId))
      .limit(limit)
      .offset(offset)
      .orderBy(desc(scrapeJobs.createdAt));
  }

  async updateStatus(
    id: string,
    status: string,
    data?: Partial<{
      progress: number;
      result: unknown;
      errorMessage: string;
    }>
  ) {
    const updateData: any = {
      status,
      ...data,
    };

    if (status === 'completed' || status === 'failed') {
      updateData.completedAt = new Date();
    }

    if (status === 'processing' && !data?.result) {
      updateData.startedAt = new Date();
    }

    const [updated] = await this.db
      .update(scrapeJobs)
      .set(updateData)
      .where(eq(scrapeJobs.id, id))
      .returning();
    return updated;
  }
}
