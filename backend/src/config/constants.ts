// Static configuration shared across the application.

export const SUPPORTED_CURRENCIES = ['GBP', 'USD', 'EUR'] as const;
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB
export const ACCEPTED_UPLOAD_MIME = ['application/pdf'];

// Audit log action names. Kept in one place so producers and consumers agree.
export const AUDIT_ACTIONS = {
  USER_REGISTER: 'USER_REGISTER',
  USER_LOGIN: 'USER_LOGIN',
  INVOICE_UPLOAD: 'INVOICE_UPLOAD',
  INVOICE_PARSE: 'INVOICE_PARSE',
  INVOICE_VERIFY: 'INVOICE_VERIFY',
  INVOICE_REJECT: 'INVOICE_REJECT',
  INVOICE_MINT: 'INVOICE_MINT',
  INVOICE_LIST: 'INVOICE_LIST',
  MARKETPLACE_LIST: 'MARKETPLACE_LIST',
  MARKETPLACE_BUY: 'MARKETPLACE_BUY',
  MARKETPLACE_CANCEL: 'MARKETPLACE_CANCEL',
  SETTLEMENT_SETTLE: 'SETTLEMENT_SETTLE',
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

// Risk buckets used by the pricing engine.
export const RISK_BANDS = {
  LOW: { max: 33, discountRate: 0.024 },
  MEDIUM: { max: 66, discountRate: 0.055 },
  HIGH: { max: 100, discountRate: 0.09 },
} as const;
