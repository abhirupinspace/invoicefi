import { Router } from 'express';
import { aiController } from '../controllers/ai.controller';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';
import { idParam, querySchema } from '../validators/ai.validators';

export const aiRouter = Router();

aiRouter.use(authenticate);

/**
 * @openapi
 * /ai/query:
 *   post:
 *     tags: [AI]
 *     summary: Ask a natural language question about invoices
 *     description: >
 *       Maps the question to one of a fixed set of safe, parameterized queries
 *       scoped to the caller's role, then returns data and a natural language
 *       answer.
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [query]
 *             properties:
 *               query: { type: string, example: What invoices are due this week? }
 *     responses:
 *       200: { description: Answer and supporting data }
 */
aiRouter.post(
  '/query',
  validate({ body: querySchema }),
  asyncHandler((req, res) => aiController.query(req, res)),
);

/**
 * @openapi
 * /ai/analyze/{id}:
 *   post:
 *     tags: [AI]
 *     summary: Re-run AI risk analysis for an invoice
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Fresh analysis with risk score and flags }
 */
aiRouter.post(
  '/analyze/:id',
  validate({ params: idParam }),
  asyncHandler((req, res) => aiController.analyze(req, res)),
);

/**
 * @openapi
 * /ai/price/{id}:
 *   get:
 *     tags: [AI]
 *     summary: Recommend a funding price for an invoice
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Funding price, yield, and discount rate }
 */
aiRouter.get(
  '/price/:id',
  validate({ params: idParam }),
  asyncHandler((req, res) => aiController.price(req, res)),
);
