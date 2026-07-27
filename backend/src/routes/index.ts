import { Router } from 'express';
import { sendSuccess } from '../utils/apiResponse';

// Aggregate router. Feature routers are mounted here as they are implemented in
// later phases (auth, invoice, marketplace, portfolio, admin, ai).
export const apiRouter = Router();

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
