import { afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { prisma } from '../../src/database/prisma';

// These tests exercise the full HTTP stack against a real database. They run
// only when RUN_INTEGRATION=1 and a reachable DATABASE_URL are provided, for
// example after `docker compose up postgres` and `prisma migrate deploy`.
const enabled = process.env.RUN_INTEGRATION === '1';

describe.skipIf(!enabled)('Auth integration', () => {
  const app = createApp();
  const email = `user_${Date.now()}@example.com`;

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await prisma.$disconnect();
  });

  it('registers, logs in, and reads profile', async () => {
    const register = await request(app)
      .post('/auth/register')
      .send({ name: 'Integration Co', email, password: 'password123', role: 'BUSINESS' });
    expect(register.status).toBe(201);
    expect(register.body.success).toBe(true);
    const token = register.body.data.token as string;
    expect(token).toBeTruthy();

    const login = await request(app)
      .post('/auth/login')
      .send({ email, password: 'password123' });
    expect(login.status).toBe(200);

    const profile = await request(app)
      .get('/auth/profile')
      .set('Authorization', `Bearer ${token}`);
    expect(profile.status).toBe(200);
    expect(profile.body.data.email).toBe(email);

    const unauthorized = await request(app).get('/auth/profile');
    expect(unauthorized.status).toBe(401);
  });
});
