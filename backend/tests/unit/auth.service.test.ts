import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Role } from '@prisma/client';

// Mock the Prisma client and audit service so the auth service can be tested
// without a database.
vi.mock('../../src/database/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock('../../src/services/audit.service', () => ({
  auditService: { log: vi.fn().mockResolvedValue(undefined) },
}));

import { prisma } from '../../src/database/prisma';
import { authService } from '../../src/services/auth.service';
import { verifyToken } from '../../src/utils/jwt';

const mockedFindUnique = prisma.user.findUnique as unknown as ReturnType<typeof vi.fn>;
const mockedCreate = prisma.user.create as unknown as ReturnType<typeof vi.fn>;

describe('AuthService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers a business and returns a valid token', async () => {
    mockedFindUnique.mockResolvedValue(null);
    mockedCreate.mockImplementation(async ({ data }: any) => ({
      id: 'user-1',
      createdAt: new Date(),
      ...data,
    }));

    const result = await authService.register({
      name: 'Acme Ltd',
      email: 'acme@example.com',
      password: 'password123',
      role: Role.BUSINESS,
    });

    expect(result.user.email).toBe('acme@example.com');
    expect((result.user as any).password).toBeUndefined();
    const decoded = verifyToken(result.token);
    expect(decoded.id).toBe('user-1');
    expect(decoded.role).toBe(Role.BUSINESS);
  });

  it('rejects duplicate email registration', async () => {
    mockedFindUnique.mockResolvedValue({ id: 'existing' });
    await expect(
      authService.register({
        name: 'Dup',
        email: 'dup@example.com',
        password: 'password123',
        role: Role.BUSINESS,
      }),
    ).rejects.toThrow(/already exists/);
  });

  it('blocks admin registration without the admin secret', async () => {
    await expect(
      authService.register({
        name: 'Bad Admin',
        email: 'admin@example.com',
        password: 'password123',
        role: Role.ADMIN,
        adminSecret: 'wrong',
      }),
    ).rejects.toThrow(/admin secret/);
  });

  it('logs in with correct credentials and fails with wrong ones', async () => {
    const bcrypt = await import('bcryptjs');
    const hash = await bcrypt.hash('password123', 4);
    mockedFindUnique.mockResolvedValue({
      id: 'user-2',
      name: 'Login User',
      email: 'login@example.com',
      password: hash,
      role: Role.INVESTOR,
      createdAt: new Date(),
    });

    const ok = await authService.login({
      email: 'login@example.com',
      password: 'password123',
    });
    expect(verifyToken(ok.token).id).toBe('user-2');

    await expect(
      authService.login({ email: 'login@example.com', password: 'nope' }),
    ).rejects.toThrow(/Invalid email or password/);
  });
});
