import { InvestmentStatus } from '@prisma/client';
import { prisma } from '../database/prisma';
import { AuthUser } from '../types';

export interface PortfolioReturns {
  totalInvested: number;
  totalExpectedReturn: number;
  netExpectedProfit: number;
  realizedProfit: number;
  activeCount: number;
  settledCount: number;
}

// Read models for an investor's holdings and performance.
export class PortfolioService {
  async holdings(actor: AuthUser) {
    return prisma.investment.findMany({
      where: { investorId: actor.id, status: InvestmentStatus.ACTIVE },
      include: { invoice: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async history(actor: AuthUser) {
    return prisma.investment.findMany({
      where: { investorId: actor.id },
      include: { invoice: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async returns(actor: AuthUser): Promise<PortfolioReturns> {
    const investments = await prisma.investment.findMany({
      where: { investorId: actor.id },
    });

    let totalInvested = 0;
    let totalExpectedReturn = 0;
    let realizedProfit = 0;
    let activeCount = 0;
    let settledCount = 0;

    for (const investment of investments) {
      const invested = Number(investment.purchasePrice);
      const expected = Number(investment.expectedReturn);
      totalInvested += invested;
      totalExpectedReturn += expected;
      if (investment.status === InvestmentStatus.SETTLED) {
        realizedProfit += expected - invested;
        settledCount += 1;
      } else {
        activeCount += 1;
      }
    }

    return {
      totalInvested: round(totalInvested),
      totalExpectedReturn: round(totalExpectedReturn),
      netExpectedProfit: round(totalExpectedReturn - totalInvested),
      realizedProfit: round(realizedProfit),
      activeCount,
      settledCount,
    };
  }
}

function round(value: number): number {
  return Number(value.toFixed(2));
}

export const portfolioService = new PortfolioService();
