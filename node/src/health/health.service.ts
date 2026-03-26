import { Injectable } from '@nestjs/common';
import { InjectDb } from '../db/db.provider';
import type { Database } from '../db/client';

@Injectable()
export class HealthService {
  constructor(@InjectDb() private db: Database) {}

  async checkHealth() {
    try {
      await this.db.execute('SELECT 1');
      return { status: 'ok', db: 'healthy' };
    } catch {
      return { status: 'error', db: 'unhealthy' };
    }
  }

  async checkReady() {
    const health = await this.checkHealth();
    return {
      ...health,
      status: health.status === 'ok' ? 'ready' : 'not-ready',
    };
  }
}
