import { z } from 'zod';

export const ScrapeRequestDto = z.object({
  url: z.string().url(),
});

export type ScrapeRequestDto = z.infer<typeof ScrapeRequestDto>;
