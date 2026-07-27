import { Router } from 'express';
import { Role } from '@prisma/client';
import { adminController } from '../controllers/admin.controller';
import { invoiceController } from '../controllers/invoice.controller';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { uploadPdf } from '../middleware/upload';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';
import { rejectSchema } from '../validators/ai.validators';
import {
  invoiceIdParam,
  listInvoiceSchema,
  tokenizeSchema,
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
 * /invoice/tokenize:
 *   post:
 *     tags: [Invoice]
 *     summary: Mint the on chain NFT for a verified invoice
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [invoiceId]
 *             properties:
 *               invoiceId: { type: string, format: uuid }
 *     responses:
 *       200: { description: Invoice minted }
 *       400: { description: Invoice not verified }
 */
invoiceRouter.post(
  '/tokenize',
  requireRole(Role.BUSINESS, Role.ADMIN),
  validate({ body: tokenizeSchema }),
  asyncHandler((req, res) => invoiceController.tokenize(req, res)),
);

/**
 * @openapi
 * /invoice/list:
 *   post:
 *     tags: [Invoice]
 *     summary: List a minted invoice on the marketplace for funding
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [invoiceId, askingPrice]
 *             properties:
 *               invoiceId: { type: string, format: uuid }
 *               askingPrice: { type: number }
 *     responses:
 *       201: { description: Listing created }
 */
invoiceRouter.post(
  '/list',
  requireRole(Role.BUSINESS, Role.ADMIN),
  validate({ body: listInvoiceSchema }),
  asyncHandler((req, res) => invoiceController.listForFunding(req, res)),
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
 * /invoice/{id}/verify:
 *   post:
 *     tags: [Admin]
 *     summary: Verify an invoice, which triggers on chain minting
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Invoice verified and minted }
 */
invoiceRouter.post(
  '/:id/verify',
  requireRole(Role.ADMIN),
  validate({ params: invoiceIdParam }),
  asyncHandler((req, res) => adminController.verify(req, res)),
);

/**
 * @openapi
 * /invoice/{id}/reject:
 *   post:
 *     tags: [Admin]
 *     summary: Reject an invoice
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Invoice rejected }
 */
invoiceRouter.post(
  '/:id/reject',
  requireRole(Role.ADMIN),
  validate({ params: invoiceIdParam, body: rejectSchema }),
  asyncHandler((req, res) => adminController.reject(req, res)),
);

/**
 * @openapi
 * /invoice/{id}/settle:
 *   post:
 *     tags: [Admin]
 *     summary: Settle a funded invoice, paying the investor and burning the NFT
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Invoice settled and closed }
 */
invoiceRouter.post(
  '/:id/settle',
  requireRole(Role.ADMIN),
  validate({ params: invoiceIdParam }),
  asyncHandler((req, res) => adminController.settle(req, res)),
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
