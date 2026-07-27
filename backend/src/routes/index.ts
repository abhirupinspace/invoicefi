import { Router } from 'express';
import { sendSuccess } from '../utils/apiResponse';
import { authRouter } from './auth.routes';
import { invoiceRouter } from './invoice.routes';
import { marketplaceRouter } from './marketplace.routes';

// Aggregate router. Feature routers are mounted here as they are implemented in
// later phases (portfolio, admin, ai).
export const apiRouter = Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/invoice', invoiceRouter);
apiRouter.use('/marketplace', marketplaceRouter);

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
