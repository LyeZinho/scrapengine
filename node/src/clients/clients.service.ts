import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { ClientsRepository } from './clients.repository';

@Injectable()
export class ClientsService {
  constructor(private repository: ClientsRepository) {}

  private hashApiKey(key: string): string {
    return createHash('sha256').update(key).digest('hex');
  }

  private generateApiKey(): string {
    return `sk_${randomBytes(32).toString('hex')}`;
  }

  async createClient(name: string, rateLimitPerMinute?: number) {
    const apiKey = this.generateApiKey();
    const apiKeyHash = this.hashApiKey(apiKey);

    const client = await this.repository.create({
      name,
      apiKeyHash,
      rateLimitPerMinute,
    });

    return {
      client,
      apiKey,
    };
  }

  async getClient(id: string) {
    const client = await this.repository.findById(id);
    if (!client) throw new NotFoundException('Client not found');
    return client;
  }

  async listClients(limit?: number, offset?: number) {
    return this.repository.findAll(limit, offset);
  }

  async updateClient(
    id: string,
    data: Partial<{
      name: string;
      isActive: boolean;
      rateLimitPerMinute: number;
    }>
  ) {
    await this.getClient(id);
    return this.repository.update(id, data);
  }

  async regenerateKey(id: string) {
    await this.getClient(id);
    const apiKey = this.generateApiKey();
    const apiKeyHash = this.hashApiKey(apiKey);

    const client = await this.repository.update(id, { apiKeyHash });

    return {
      client,
      apiKey,
    };
  }

  async deactivateClient(id: string) {
    await this.getClient(id);
    return this.repository.deactivate(id);
  }
}
