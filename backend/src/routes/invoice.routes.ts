import { Router } from 'express';
import { Role } from '@prisma/client';
import { invoiceController } from '../controllers/invoice.controller';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { uploadPdf } from '../middleware/upload';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';
import {
  invoiceIdParam,
  uploadInvoiceSchema,
} from '../validators/invoice.validators';

export const invoiceRouter = Router();

invoiceRouter.use(authenticate);

/**
 * @openapi
 * /invoice/upload:
 *   post:
 *     tags: [Invoice]
 *     summary: Upload an invoice PDF and run the extraction pipeline
 *     description: >
 *       Stores the document, fingerprints it, runs OCR, fraud checks, and AI
 *       risk analysis, then persists the invoice. Declared form fields override
 *       extracted values.
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file]
 *             properties:
 *               file: { type: string, format: binary }
 *               invoiceNumber: { type: string }
 *               buyerName: { type: string }
 *               buyerEmail: { type: string }
 *               amount: { type: number }
 *               currency: { type: string, example: GBP }
 *               issueDate: { type: string, format: date }
 *               dueDate: { type: string, format: date }
 *               paymentTerms: { type: string }
 *     responses:
 *       201: { description: Invoice created }
 *       409: { description: Duplicate document or invoice number }
 */
invoiceRouter.post(
  '/upload',
  requireRole(Role.BUSINESS, Role.ADMIN),
  uploadPdf,
  validate({ body: uploadInvoiceSchema }),
  asyncHandler((req, res) => invoiceController.upload(req, res)),
);

/**
 * @openapi
 * /invoice:
 *   get:
 *     tags: [Invoice]
 *     summary: List invoices for the current business (all invoices for admins)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Array of invoices }
 */
invoiceRouter.get(
  '/',
  asyncHandler((req, res) => invoiceController.list(req, res)),
);

/**
 * @openapi
 * /invoice/{id}:
 *   get:
 *     tags: [Invoice]
 *     summary: Get a single invoice
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: The invoice }
 *       404: { description: Not found }
 */
invoiceRouter.get(
  '/:id',
  validate({ params: invoiceIdParam }),
  asyncHandler((req, res) => invoiceController.getOne(req, res)),
);
