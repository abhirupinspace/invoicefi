import { Router } from 'express';
import { Role } from '@prisma/client';
import { portfolioController } from '../controllers/portfolio.controller';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { asyncHandler } from '../utils/asyncHandler';

export const portfolioRouter = Router();

portfolioRouter.use(authenticate, requireRole(Role.INVESTOR, Role.ADMIN));

/**
 * @openapi
 * /portfolio:
 *   get:
 *     tags: [Portfolio]
 *     summary: Active holdings for the current investor
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Active investments }
 */
portfolioRouter.get(
  '/',
  asyncHandler((req, res) => portfolioController.holdings(req, res)),
);

/**
 * @openapi
 * /portfolio/history:
 *   get:
 *     tags: [Portfolio]
 *     summary: Full investment history
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: All investments }
 */
portfolioRouter.get(
  '/history',
  asyncHandler((req, res) => portfolioController.history(req, res)),
);

/**
 * @openapi
 * /portfolio/returns:
 *   get:
 *     tags: [Portfolio]
 *     summary: Aggregate returns for the current investor
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Return metrics }
 */
portfolioRouter.get(
  '/returns',
  asyncHandler((req, res) => portfolioController.returns(req, res)),
);
