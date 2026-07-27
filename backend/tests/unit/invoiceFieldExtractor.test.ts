import { describe, expect, it } from 'vitest';
import { extractInvoiceFields } from '../../src/utils/invoiceFieldExtractor';

const SAMPLE = `
ACME SUPPLIES LTD
Invoice Number: INV-2024-0042
Invoice Date: 12/03/2024
Due Date: 11/04/2024
Bill To: Globex Corporation
Email: accounts@globex.com
Payment Terms: Net 30
VAT: £400.00
Total Amount Due: £2,400.00
Currency: GBP
`;

describe('extractInvoiceFields', () => {
  it('extracts the core fields from a well formed invoice', () => {
    const { fields, confidence } = extractInvoiceFields(SAMPLE);
    expect(fields.invoiceNumber).toBe('INV-2024-0042');
    expect(fields.amount).toBe(2400);
    expect(fields.vat).toBe(400);
    expect(fields.currency).toBe('GBP');
    expect(fields.buyerName).toContain('Globex');
    expect(fields.buyerEmail).toBe('accounts@globex.com');
    expect(fields.dueDate).toBeDefined();
    expect(confidence).toBeGreaterThanOrEqual(0.8);
  });

  it('reports low confidence for sparse text', () => {
    const { confidence } = extractInvoiceFields('random text with no structure');
    expect(confidence).toBeLessThan(0.5);
  });
});
