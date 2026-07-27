import pino from 'pino';
import { env } from '../config/env';

// Single shared logger. Pretty printing is left to the caller in development
// via the pino-pretty transport if installed; defaults to structured JSON.
export const logger = pino({
  level: env.LOG_LEVEL,
  base: undefined,
  redact: {
    paths: ['req.headers.authorization', 'password', '*.password'],
    censor: '[redacted]',
  },
});
