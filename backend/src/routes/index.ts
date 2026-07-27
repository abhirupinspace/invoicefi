import { Router } from 'express';
import { sendSuccess } from '../utils/apiResponse';
import { adminRouter } from './admin.routes';
import { aiRouter } from './ai.routes';
import { authRouter } from './auth.routes';
import { invoiceRouter } from './invoice.routes';
import { marketplaceRouter } from './marketplace.routes';
import { portfolioRouter } from './portfolio.routes';

// Aggregate router. Mounts every feature router.
export const apiRouter = Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/invoice', invoiceRouter);
apiRouter.use('/marketplace', marketplaceRouter);
apiRouter.use('/portfolio', portfolioRouter);
apiRouter.use('/admin', adminRouter);
apiRouter.use('/ai', aiRouter);

/**
 * @openapi
 * /health:
 *   get:
 *     tags: [System]
 *     summary: Liveness probe
 *     responses:
 *       200:
 *         description: Service is up
 */
apiRouter.get('/health', (_req, res) => {
  sendSuccess(res, { status: 'ok', uptime: process.uptime() });
});
