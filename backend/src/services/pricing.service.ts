import { RISK_BANDS } from '../config/constants';
import { PricingResult } from '../types';
import { aiService } from './ai.service';

export interface PricingInput {
  faceValue: number;
  riskScore: number;
  dueDate: Date;
  currency?: string;
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;

function bandFor(riskScore: number): {
  band: 'LOW' | 'MEDIUM' | 'HIGH';
  baseRate: number;
} {
  if (riskScore <= RISK_BANDS.LOW.max) {
    return { band: 'LOW', baseRate: RISK_BANDS.LOW.discountRate };
  }
  if (riskScore <= RISK_BANDS.MEDIUM.max) {
    return { band: 'MEDIUM', baseRate: RISK_BANDS.MEDIUM.discountRate };
  }
  return { band: 'HIGH', baseRate: RISK_BANDS.HIGH.discountRate };
}

// Recommends a funding price for an invoice. The base rate is the 30 day
// discount for the risk band; it scales linearly with the days remaining until
// the invoice is due. A £10,000 low risk invoice due in 30 days prices at
// £9,760 with a yield of roughly 2.4 percent, matching the product spec.
export class PricingService {
  compute(input: PricingInput): PricingResult {
    const { band, baseRate } = bandFor(input.riskScore);
    const now = Date.now();
    const daysToDue = Math.max(
      0,
      Math.round((input.dueDate.getTime() - now) / MS_PER_DAY),
    );

    let discountRate = baseRate * (daysToDue / 30);
    // Keep the discount within sane bounds.
    discountRate = Math.min(0.5, Math.max(0.002, discountRate));

    const fundingPrice = Number((input.faceValue * (1 - discountRate)).toFixed(2));
    const expectedYield = Number(
      ((input.faceValue - fundingPrice) / fundingPrice).toFixed(4),
    );

    return {
      faceValue: input.faceValue,
      riskBand: band,
      daysToDue,
      fundingPrice,
      expectedYield,
      discountRate: Number(discountRate.toFixed(4)),
    };
  }

  // Same as compute but enriches the result with an optional AI narrative.
  async computeWithNarrative(input: PricingInput): Promise<PricingResult> {
    const result = this.compute(input);
    const narrative = await aiService.pricingNarrative({
      faceValue: result.faceValue,
      riskBand: result.riskBand,
      daysToDue: result.daysToDue,
      fundingPrice: result.fundingPrice,
      discountRate: result.discountRate,
      expectedYield: result.expectedYield,
      currency: input.currency,
    });
    return { ...result, narrative };
  }
}

export const pricingService = new PricingService();
