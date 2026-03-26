import { Injectable } from '@nestjs/common';
import { InjectDb } from '../db/db.provider';
import { eq, desc } from 'drizzle-orm';
import { apiClients } from '../db/schema';
import type { Database } from '../db/client';

@Injectable()
export class ClientsRepository {
  constructor(@InjectDb() private db: Database) {}

  async findById(id: string) {
    const [client] = await this.db
      .select()
      .from(apiClients)
      .where(eq(apiClients.id, id))
      .limit(1);
    return client || null;
  }

  async findAll(limit: number = 50, offset: number = 0) {
    return this.db
      .select()
      .from(apiClients)
      .limit(limit)
      .offset(offset)
      .orderBy(desc(apiClients.createdAt));
  }

  async create(data: {
    name: string;
    apiKeyHash: string;
    rateLimitPerMinute?: number;
  }) {
    const [client] = await this.db
      .insert(apiClients)
      .values({
        ...data,
        rateLimitPerMinute: data.rateLimitPerMinute ?? 60,
      })
      .returning();
    return client;
  }

  async update(
    id: string,
    data: Partial<{
      name: string;
      isActive: boolean;
      rateLimitPerMinute: number;
      apiKeyHash: string;
    }>
  ) {
    const [updated] = await this.db
      .update(apiClients)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(apiClients.id, id))
      .returning();
    return updated || null;
  }

  async deactivate(id: string) {
    return this.update(id, { isActive: false });
  }
}
