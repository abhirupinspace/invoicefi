import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/database/prisma', () => ({
  prisma: { investment: { findMany: vi.fn() } },
}));

import { prisma } from '../../src/database/prisma';
import { portfolioService } from '../../src/services/portfolio.service';

const findMany = prisma.investment.findMany as unknown as ReturnType<typeof vi.fn>;

describe('PortfolioService.returns', () => {
  beforeEach(() => vi.clearAllMocks());

  it('aggregates invested, expected, and realized amounts', async () => {
    findMany.mockResolvedValue([
      { purchasePrice: 9600, expectedReturn: 10000, status: 'SETTLED' },
      { purchasePrice: 4800, expectedReturn: 5000, status: 'ACTIVE' },
    ]);

    const result = await portfolioService.returns({ id: 'i1', email: 'x', role: 'INVESTOR' } as never);

    expect(result.totalInvested).toBe(14400);
    expect(result.totalExpectedReturn).toBe(15000);
    expect(result.netExpectedProfit).toBe(600);
    expect(result.realizedProfit).toBe(400);
    expect(result.activeCount).toBe(1);
    expect(result.settledCount).toBe(1);
  });
});
