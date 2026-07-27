import { NextFunction, Request, Response } from 'express';
import { UnauthorizedError } from '../utils/appError';
import { verifyToken } from '../utils/jwt';

// Requires a valid bearer token and attaches the principal to req.user.
export function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing bearer token');
  }
  const token = header.slice('Bearer '.length).trim();
  req.user = verifyToken(token);
  next();
}
