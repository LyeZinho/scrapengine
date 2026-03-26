import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { InjectDb } from '../../db/db.provider';
import { eq } from 'drizzle-orm';
import { apiClients } from '../../db/schema';
import type { Database } from '../../db/client';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(@InjectDb() private db: Database) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'] as string;

    if (!apiKey) {
      throw new UnauthorizedException('INVALID_API_KEY');
    }

    const keyHash = createHash('sha256').update(apiKey).digest('hex');

    const [client] = await this.db
      .select()
      .from(apiClients)
      .where(eq(apiClients.apiKeyHash, keyHash))
      .limit(1);

    if (!client || !client.isActive) {
      throw new UnauthorizedException('CLIENT_INACTIVE');
    }

    request.client = client;
    return true;
  }
}
