import crypto from 'crypto';

// SHA256 helpers used for invoice document fingerprinting.

export function sha256Buffer(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

export function sha256String(value: string): string {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}
