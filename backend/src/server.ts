import { createApp } from './app';
import { env } from './config/env';
import { prisma } from './database/prisma';
import { logger } from './utils/logger';

// Process entry point. Verifies the database connection then starts listening.
async function main(): Promise<void> {
  await prisma.$connect();
  logger.info('Database connection established');

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info(`InvoiceFi API listening on port ${env.PORT}`);
  });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`${signal} received, shutting down`);
    server.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  logger.error({ err }, 'Fatal startup error');
  process.exit(1);
});
