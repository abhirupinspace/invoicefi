import { Prisma } from '@prisma/client';

// Amounts are stored as decimals with two places. On chain they are integers,
// so all chain values use minor units (for example pennies or cents). These
// helpers convert between the two representations in one place.

export function toMinorUnits(value: Prisma.Decimal | number): bigint {
  const asNumber = typeof value === 'number' ? value : Number(value);
  return BigInt(Math.round(asNumber * 100));
}

export function fromMinorUnits(value: bigint): number {
  return Number(value) / 100;
}
