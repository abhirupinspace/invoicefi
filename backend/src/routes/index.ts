import { Router } from 'express';
import { sendSuccess } from '../utils/apiResponse';
import { authRouter } from './auth.routes';
import { invoiceRouter } from './invoice.routes';

// Aggregate router. Feature routers are mounted here as they are implemented in
// later phases (marketplace, portfolio, admin, ai).
export const apiRouter = Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/invoice', invoiceRouter);

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
