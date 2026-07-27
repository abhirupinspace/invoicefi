import { InvoiceStatus } from '@prisma/client';
import { prisma } from '../database/prisma';
import { FraudResult } from '../types';

export interface FraudInput {
  invoiceNumber?: string;
  invoiceHash: string;
  buyerName?: string;
  buyerEmail?: string;
  sellerId: string;
  extractedAmount?: number;
  declaredAmount?: number;
}

const FINANCED_STATUSES: InvoiceStatus[] = [
  InvoiceStatus.MINTED,
  InvoiceStatus.LISTED,
  InvoiceStatus.FUNDED,
  InvoiceStatus.SETTLED,
  InvoiceStatus.CLOSED,
];

// Runs a set of deterministic checks against the existing invoice corpus and
// returns a 0 to 100 fraud score with human readable reasons.
export class FraudService {
  async evaluate(input: FraudInput): Promise<FraudResult> {
    const reasons: string[] = [];
    let score = 0;

    // Duplicate document hash is the strongest signal.
    const hashDupe = await prisma.invoice.findFirst({
      where: { invoiceHash: input.invoiceHash },
      select: { id: true },
    });
    if (hashDupe) {
      score += 60;
      reasons.push('Duplicate document hash detected');
    }

    // Duplicate invoice number, possibly already financed.
    if (input.invoiceNumber) {
      const numberDupe = await prisma.invoice.findFirst({
        where: { invoiceNumber: input.invoiceNumber },
        select: { id: true, status: true },
      });
      if (numberDupe) {
        score += 30;
        reasons.push('Invoice number already exists');
        if (FINANCED_STATUSES.includes(numberDupe.status)) {
          score += 20;
          reasons.push('Invoice number already financed');
        }
      }
    }

    // Declared amount disagrees with the extracted amount.
    if (
      input.declaredAmount !== undefined &&
      input.extractedAmount !== undefined &&
      input.extractedAmount > 0
    ) {
      const diff = Math.abs(input.declaredAmount - input.extractedAmount);
      const ratio = diff / input.extractedAmount;
      if (ratio > 0.02) {
        score += 15;
        reasons.push('Declared amount does not match extracted amount');
      }
    }

    // Same buyer used repeatedly by this seller in a short window.
    if (input.buyerName) {
      const buyerCount = await prisma.invoice.count({
        where: { sellerId: input.sellerId, buyerName: input.buyerName },
      });
      if (buyerCount >= 5) {
        score += 10;
        reasons.push('Buyer appears frequently for this seller');
      }
    }

    return { fraudScore: Math.min(100, score), reasons };
  }
}

export const fraudService = new FraudService();
