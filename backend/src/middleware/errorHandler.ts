import { Prisma } from '@prisma/client';
import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/appError';
import { sendFailure } from '../utils/apiResponse';
import { logger } from '../utils/logger';

// Central error middleware. Every thrown error funnels here and is mapped to a
// consistent failure envelope. Unknown errors are logged and returned as 500.
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  // next is required so Express treats this as an error handler.
  _next: NextFunction,
): Response {
  if (err instanceof AppError) {
    if (err.statusCode >= 500) logger.error({ err }, err.message);
    return sendFailure(res, err.statusCode, err.code, err.message, err.details);
  }

  if (err instanceof ZodError) {
    return sendFailure(res, 422, 'VALIDATION_ERROR', 'Validation failed', err.issues);
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const target = (err.meta?.target as string[] | undefined)?.join(', ');
      return sendFailure(
        res,
        409,
        'CONFLICT',
        `Unique constraint violated${target ? ` on ${target}` : ''}`,
      );
    }
    if (err.code === 'P2025') {
      return sendFailure(res, 404, 'NOT_FOUND', 'Resource not found');
    }
  }

  logger.error({ err }, 'Unhandled error');
  return sendFailure(res, 500, 'INTERNAL_ERROR', 'Internal server error');
}
