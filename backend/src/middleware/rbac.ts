import { NextFunction, Request, Response } from 'express';
import { Role } from '@prisma/client';
import { ForbiddenError, UnauthorizedError } from '../utils/appError';

// Restricts a route to one or more roles. Must run after authenticate.
export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new UnauthorizedError();
    }
    if (!roles.includes(req.user.role)) {
      throw new ForbiddenError(
        `This action requires one of: ${roles.join(', ')}`,
      );
    }
    next();
  };
}
