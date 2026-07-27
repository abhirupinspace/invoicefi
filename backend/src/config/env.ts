import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Load .env from the backend directory and, as a fallback, the repo root.
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '..', '.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(10),
  ADMIN_SECRET: z.string().min(8).default('admin_bootstrap_secret'),

  REDIS_URL: z.string().optional().default(''),

  OPENAI_API_KEY: z.string().optional().default(''),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),

  MISTRAL_API_KEY: z.string().optional().default(''),
  MISTRAL_OCR_MODEL: z.string().default('mistral-ocr-latest'),
  OCR_CONFIDENCE_THRESHOLD: z.coerce.number().min(0).max(1).default(0.6),

  STELLAR_NETWORK: z.string().default('testnet'),
  SOROBAN_RPC: z.string().default('https://soroban-testnet.stellar.org'),
  STELLAR_NETWORK_PASSPHRASE: z
    .string()
    .default('Test SDF Network ; September 2015'),
  STELLAR_PLATFORM_SECRET: z.string().optional().default(''),

  INVOICE_NFT_CONTRACT: z.string().optional().default(''),
  MARKETPLACE_CONTRACT: z.string().optional().default(''),
  SETTLEMENT_CONTRACT: z.string().optional().default(''),
  PAY_TOKEN_CONTRACT: z.string().optional().default(''),

  STORAGE_DRIVER: z.enum(['local']).default('local'),
  STORAGE_DIR: z.string().default('storage'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
    .join('\n');
  // Fail fast on invalid configuration.
  throw new Error(`Invalid environment configuration:\n${issues}`);
}

const data = parsed.data;

export const env = {
  ...data,
  isProduction: data.NODE_ENV === 'production',
  isTest: data.NODE_ENV === 'test',
  redisEnabled: data.REDIS_URL.length > 0,
  openaiEnabled: data.OPENAI_API_KEY.length > 0,
  mistralEnabled: data.MISTRAL_API_KEY.length > 0,
  chainConfigured:
    data.STELLAR_PLATFORM_SECRET.length > 0 &&
    data.INVOICE_NFT_CONTRACT.length > 0,
};

export type Env = typeof env;
