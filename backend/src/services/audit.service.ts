import { Prisma } from '@prisma/client';
import { prisma } from '../database/prisma';
import { AuditAction } from '../config/constants';
import { logger } from '../utils/logger';

// Records an immutable trail of every meaningful action. Audit writes never
// block or fail the primary operation; failures are logged and swallowed.
export class AuditService {
  async log(
    action: AuditAction | string,
    actor: string | null,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          action,
          actor: actor ?? undefined,
          metadata: (metadata ?? undefined) as Prisma.InputJsonValue | undefined,
        },
      });
    } catch (err) {
      logger.error({ err, action }, 'Failed to write audit log');
    }
  }
}

export const auditService = new AuditService();
