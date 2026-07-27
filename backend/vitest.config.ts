import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 20000,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://invoicefi:invoicefi@localhost:5432/invoicefi_test?schema=public',
      JWT_SECRET: 'test_secret_value_at_least_16_chars',
      ADMIN_SECRET: 'test_admin_secret',
      BCRYPT_ROUNDS: '4',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
    },
  },
});
