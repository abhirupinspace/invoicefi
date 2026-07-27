import { describe, expect, it } from 'vitest';
import { pricingService } from '../../src/services/pricing.service';

const daysFromNow = (n: number): Date => new Date(Date.now() + n * 86400000);

describe('PricingService', () => {
  it('prices a low risk 30 day invoice per the product spec', () => {
    const result = pricingService.compute({
      faceValue: 10000,
      riskScore: 20,
      dueDate: daysFromNow(30),
    });
    expect(result.riskBand).toBe('LOW');
    expect(result.fundingPrice).toBeCloseTo(9760, 0);
    expect(result.discountRate).toBeCloseTo(0.024, 3);
    // Yield is discount over the funded price, roughly 2.4 percent.
    expect(result.expectedYield).toBeGreaterThan(0.024);
    expect(result.expectedYield).toBeLessThan(0.026);
  });

  it('charges a higher discount for high risk invoices', () => {
    const low = pricingService.compute({ faceValue: 10000, riskScore: 10, dueDate: daysFromNow(30) });
    const high = pricingService.compute({ faceValue: 10000, riskScore: 90, dueDate: daysFromNow(30) });
    expect(high.discountRate).toBeGreaterThan(low.discountRate);
    expect(high.fundingPrice).toBeLessThan(low.fundingPrice);
  });

  it('scales the discount with time to due', () => {
    const short = pricingService.compute({ faceValue: 10000, riskScore: 20, dueDate: daysFromNow(15) });
    const long = pricingService.compute({ faceValue: 10000, riskScore: 20, dueDate: daysFromNow(60) });
    expect(long.discountRate).toBeGreaterThan(short.discountRate);
  });
});
