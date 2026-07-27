import { z } from 'zod';

export const listSchema = z.object({
  invoiceId: z.string().uuid(),
  askingPrice: z.coerce.number().positive(),
});

export const buySchema = z.object({
  listingId: z.string().uuid(),
});

export const cancelSchema = z.object({
  listingId: z.string().uuid(),
});

export const listingIdParam = z.object({
  id: z.string().uuid(),
});
