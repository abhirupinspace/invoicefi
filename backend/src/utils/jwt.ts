import jwt, { SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';
import { AuthUser } from '../types';
import { UnauthorizedError } from './appError';

// Wraps sign and verify so token shape and secret handling live in one place.

export function signToken(payload: AuthUser): string {
  const options: SignOptions = {
    expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'],
  };
  return jwt.sign(payload, env.JWT_SECRET, options);
}

export function verifyToken(token: string): AuthUser {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload;
    return {
      id: String(decoded.id),
      email: String(decoded.email),
      role: decoded.role,
    };
  } catch {
    throw new UnauthorizedError('Invalid or expired token');
  }
}
