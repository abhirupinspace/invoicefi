import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/database/prisma', () => ({
  prisma: {
    invoice: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
    },
  },
}));

import { prisma } from '../../src/database/prisma';
import { fraudService } from '../../src/services/fraud.service';

const findFirst = prisma.invoice.findFirst as unknown as ReturnType<typeof vi.fn>;
const count = prisma.invoice.count as unknown as ReturnType<typeof vi.fn>;

describe('FraudService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns a clean score for a novel invoice', async () => {
    findFirst.mockResolvedValue(null);
    count.mockResolvedValue(0);
    const result = await fraudService.evaluate({
      invoiceHash: 'abc',
      invoiceNumber: 'INV-1',
      sellerId: 's1',
      buyerName: 'Globex',
    });
    expect(result.fraudScore).toBe(0);
    expect(result.reasons).toHaveLength(0);
  });

  it('flags a duplicate document hash heavily', async () => {
    findFirst.mockImplementation(async ({ where }: any) => {
      if (where.invoiceHash) return { id: 'dupe' };
      return null;
    });
    count.mockResolvedValue(0);
    const result = await fraudService.evaluate({
      invoiceHash: 'duphash',
      invoiceNumber: 'INV-NEW',
      sellerId: 's1',
    });
    expect(result.fraudScore).toBeGreaterThanOrEqual(60);
    expect(result.reasons.join(' ')).toMatch(/Duplicate document hash/);
  });

  it('flags declared vs extracted amount mismatch', async () => {
    findFirst.mockResolvedValue(null);
    count.mockResolvedValue(0);
    const result = await fraudService.evaluate({
      invoiceHash: 'x',
      sellerId: 's1',
      declaredAmount: 1000,
      extractedAmount: 2000,
    });
    expect(result.reasons.join(' ')).toMatch(/does not match/);
  });
});
