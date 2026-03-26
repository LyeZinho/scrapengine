import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { apiClients } from '../../db/schema';

export type ClientContext = typeof apiClients.$inferSelect;

export const GetClient = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.client as ClientContext;
  },
);
