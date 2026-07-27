import { Router } from 'express';
import { Role } from '@prisma/client';
import { adminController } from '../controllers/admin.controller';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { asyncHandler } from '../utils/asyncHandler';

export const adminRouter = Router();

adminRouter.use(authenticate, requireRole(Role.ADMIN));

/**
 * @openapi
 * /admin/invoices:
 *   get:
 *     tags: [Admin]
 *     summary: List every invoice in the system
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: All invoices }
 */
adminRouter.get(
  '/invoices',
  asyncHandler((req, res) => adminController.listInvoices(req, res)),
);
