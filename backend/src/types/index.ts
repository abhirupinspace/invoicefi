// Shared application types. Domain enums are re-exported from the generated
// Prisma client so there is a single source of truth.

export {
  Role,
  InvoiceStatus,
  VerificationStatus,
  ListingStatus,
  InvestmentStatus,
} from '@prisma/client';

import type { Role } from '@prisma/client';

// The authenticated principal attached to a request by the auth middleware.
export interface AuthUser {
  id: string;
  email: string;
  role: Role;
}

// Standard shape returned by every endpoint.
export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

export interface ApiFailure {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiResult<T> = ApiSuccess<T> | ApiFailure;

// Fields extracted from an invoice PDF by the OCR provider.
export interface ExtractedInvoiceFields {
  invoiceNumber?: string;
  vendor?: string;
  buyerName?: string;
  buyerEmail?: string;
  issueDate?: string;
  dueDate?: string;
  currency?: string;
  amount?: number;
  vat?: number;
  paymentTerms?: string;
  address?: string;
  description?: string;
}

export interface OcrResult {
  fields: ExtractedInvoiceFields;
  confidence: number;
  rawText: string;
  provider: string;
}

// Output of the AI analysis step.
export type InvoiceFlag =
  | 'Duplicate Invoice'
  | 'Unusual Amount'
  | 'Expired Due Date'
  | 'Missing Tax ID'
  | 'Modified Document'
  | 'Unknown Buyer';

export interface InvoiceAnalysis {
  riskScore: number;
  confidence: number;
  summary: string;
  flags: InvoiceFlag[];
}

export interface FraudResult {
  fraudScore: number;
  reasons: string[];
}

export interface PricingResult {
  faceValue: number;
  riskBand: 'LOW' | 'MEDIUM' | 'HIGH';
  daysToDue: number;
  fundingPrice: number;
  expectedYield: number;
  discountRate: number;
  narrative?: string;
}

// On chain metadata mirror for an invoice NFT.
export interface InvoiceNftMetadata {
  invoiceId: string;
  seller: string;
  faceValue: string;
  dueDate: number;
  verified: boolean;
  hash: string;
  owner: string;
}
