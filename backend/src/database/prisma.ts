import { PrismaClient } from '@prisma/client';
import { env } from '../config/env';

// A single PrismaClient instance is reused across the process. During tests a
// global cache prevents exhausting connections on hot reload.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: env.isProduction ? ['warn', 'error'] : ['warn', 'error'],
  });

if (!env.isProduction) {
  globalForPrisma.prisma = prisma;
}
