import { z } from 'zod';

export const querySchema = z.object({
  query: z.string().min(1).max(500),
});

export const idParam = z.object({
  id: z.string().uuid(),
});

export const rejectSchema = z.object({
  reason: z.string().max(300).optional(),
});
