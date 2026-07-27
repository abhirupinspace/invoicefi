import { describe, expect, it } from 'vitest';
import { BlockchainService } from '../../src/services/blockchain.service';
import { fromMinorUnits, toMinorUnits } from '../../src/utils/money';

// With no platform secret or contract ids configured the service runs in dry
// run mode and returns synthetic results, so the backend flow works without a
// deployed chain.
describe('BlockchainService (dry run)', () => {
  const service = new BlockchainService();

  it('mints and returns a synthetic token id', async () => {
    const result = await service.mintInvoice({
      invoiceId: 'inv-1',
      faceValue: 1_000_000n,
      dueDate: 1_800_000_000,
      verified: true,
      hash: Buffer.alloc(32, 1),
    });
    expect(result.dryRun).toBe(true);
    expect(result.value).toBeTruthy();
    expect(result.txHash).toContain('dryrun');
  });

  it('lists, buys, and settles without throwing', async () => {
    await expect(service.listInvoice({ tokenId: '1', price: 900_000n })).resolves.toMatchObject({ dryRun: true });
    await expect(service.buyInvoice({ listingId: '1' })).resolves.toMatchObject({ dryRun: true });
    await expect(service.settleInvoice({ tokenId: '1', amount: 1_000_000n })).resolves.toMatchObject({ dryRun: true });
  });
});

describe('money helpers', () => {
  it('round trips minor units', () => {
    expect(toMinorUnits(9760.5)).toBe(976050n);
    expect(fromMinorUnits(976050n)).toBe(9760.5);
  });
});
