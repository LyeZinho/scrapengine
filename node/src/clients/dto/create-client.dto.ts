import { z } from 'zod';

export const CreateClientDto = z.object({
  name: z.string().min(1).max(255),
  rateLimitPerMinute: z.number().int().min(1).optional(),
});

export type CreateClientDto = z.infer<typeof CreateClientDto>;
