import cors from 'cors';
import express, { Application } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import swaggerUi from 'swagger-ui-express';
import { apiRouter } from './routes';
import { openapiSpec } from './swagger';
import { errorHandler } from './middleware/errorHandler';
import { notFound } from './middleware/notFound';
import { logger } from './utils/logger';

// Builds the Express application. Kept separate from server bootstrap so tests
// can import the app without opening a port.
export function createApp(): Application {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/health' } }));

  // Interactive API reference and the raw OpenAPI document.
  app.get('/openapi.json', (_req, res) => res.json(openapiSpec));
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapiSpec));

  app.use('/', apiRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
