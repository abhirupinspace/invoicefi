import { z } from 'zod';

// Optional declared fields accepted alongside the uploaded PDF. Multipart form
// values arrive as strings, so amount is coerced.
export const uploadInvoiceSchema = z.object({
  invoiceNumber: z.string().min(1).max(64).optional(),
  buyerName: z.string().min(1).max(120).optional(),
  buyerEmail: z.string().email().optional(),
  amount: z.coerce.number().positive().optional(),
  currency: z.string().length(3).optional(),
  issueDate: z.string().optional(),
  dueDate: z.string().optional(),
  paymentTerms: z.string().max(60).optional(),
});

export const invoiceIdParam = z.object({
  id: z.string().uuid(),
});

export const tokenizeSchema = z.object({
  invoiceId: z.string().uuid(),
});

export const listInvoiceSchema = z.object({
  invoiceId: z.string().uuid(),
  askingPrice: z.coerce.number().positive(),
});
