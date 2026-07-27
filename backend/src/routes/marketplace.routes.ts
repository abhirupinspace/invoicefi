import { Router } from 'express';
import { Role } from '@prisma/client';
import { marketplaceController } from '../controllers/marketplace.controller';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';
import {
  buySchema,
  cancelSchema,
  listSchema,
  listingIdParam,
} from '../validators/marketplace.validators';

export const marketplaceRouter = Router();

marketplaceRouter.use(authenticate);

/**
 * @openapi
 * /marketplace:
 *   get:
 *     tags: [Marketplace]
 *     summary: Browse active invoice listings
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Active listings with invoice detail }
 */
marketplaceRouter.get(
  '/',
  asyncHandler((req, res) => marketplaceController.getAll(req, res)),
);

/**
 * @openapi
 * /marketplace/list:
 *   post:
 *     tags: [Marketplace]
 *     summary: List a minted invoice for funding
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
marketplaceRouter.post(
  '/list',
  requireRole(Role.BUSINESS, Role.ADMIN),
  validate({ body: listSchema }),
  asyncHandler((req, res) => marketplaceController.list(req, res)),
);

/**
 * @openapi
 * /marketplace/buy:
 *   post:
 *     tags: [Marketplace]
 *     summary: Buy a listed invoice and fund the seller
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [listingId]
 *             properties:
 *               listingId: { type: string, format: uuid }
 *     responses:
 *       201: { description: Investment recorded }
 */
marketplaceRouter.post(
  '/buy',
  requireRole(Role.INVESTOR, Role.ADMIN),
  validate({ body: buySchema }),
  asyncHandler((req, res) => marketplaceController.buy(req, res)),
);

/**
 * @openapi
 * /marketplace/cancel:
 *   post:
 *     tags: [Marketplace]
 *     summary: Cancel an active listing
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [listingId]
 *             properties:
 *               listingId: { type: string, format: uuid }
 *     responses:
 *       200: { description: Listing cancelled }
 */
marketplaceRouter.post(
  '/cancel',
  requireRole(Role.BUSINESS, Role.ADMIN),
  validate({ body: cancelSchema }),
  asyncHandler((req, res) => marketplaceController.cancel(req, res)),
);

/**
 * @openapi
 * /marketplace/{id}:
 *   get:
 *     tags: [Marketplace]
 *     summary: Get a single listing
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: The listing }
 *       404: { description: Not found }
 */
marketplaceRouter.get(
  '/:id',
  validate({ params: listingIdParam }),
  asyncHandler((req, res) => marketplaceController.getOne(req, res)),
);
