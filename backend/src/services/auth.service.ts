import bcrypt from 'bcryptjs';
import { Role, User } from '@prisma/client';
import { prisma } from '../database/prisma';
import { env } from '../config/env';
import { AUDIT_ACTIONS } from '../config/constants';
import { AuthUser } from '../types';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from '../utils/appError';
import { signToken } from '../utils/jwt';
import { auditService } from './audit.service';

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  role: Role;
  adminSecret?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthResult {
  token: string;
  user: PublicUser;
}

export type PublicUser = Omit<User, 'password'>;

function toPublicUser(user: User): PublicUser {
  const { password: _password, ...rest } = user;
  return rest;
}

function toAuthUser(user: User): AuthUser {
  return { id: user.id, email: user.email, role: user.role };
}

// Handles registration, login, and profile retrieval. Passwords are hashed
// with bcrypt. Admin accounts require the bootstrap secret.
export class AuthService {
  async register(input: RegisterInput): Promise<AuthResult> {
    if (input.role === Role.ADMIN && input.adminSecret !== env.ADMIN_SECRET) {
      throw new ForbiddenError('A valid admin secret is required to register an admin');
    }

    const existing = await prisma.user.findUnique({
      where: { email: input.email },
    });
    if (existing) {
      throw new ConflictError('An account with this email already exists');
    }

    const passwordHash = await bcrypt.hash(input.password, env.BCRYPT_ROUNDS);
    const user = await prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        password: passwordHash,
        role: input.role,
      },
    });

    await auditService.log(AUDIT_ACTIONS.USER_REGISTER, user.id, {
      email: user.email,
      role: user.role,
    });

    return { token: signToken(toAuthUser(user)), user: toPublicUser(user) };
  }

  async login(input: LoginInput): Promise<AuthResult> {
    const user = await prisma.user.findUnique({ where: { email: input.email } });
    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const matches = await bcrypt.compare(input.password, user.password);
    if (!matches) {
      throw new UnauthorizedError('Invalid email or password');
    }

    await auditService.log(AUDIT_ACTIONS.USER_LOGIN, user.id, {
      email: user.email,
    });

    return { token: signToken(toAuthUser(user)), user: toPublicUser(user) };
  }

  async profile(userId: string): Promise<PublicUser> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundError('User not found');
    }
    return toPublicUser(user);
  }
}

export const authService = new AuthService();
