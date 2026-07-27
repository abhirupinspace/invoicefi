import { ExtractedInvoiceFields } from '../types';
import { SUPPORTED_CURRENCIES } from '../config/constants';

// Heuristic extractor that turns raw invoice text (from any OCR provider) into
// structured fields. It is deliberately conservative: it only reports a field
// when it finds a confident match, so downstream confidence scoring is honest.

const CURRENCY_SYMBOLS: Record<string, string> = {
  '£': 'GBP',
  $: 'USD',
  '€': 'EUR',
};

function firstMatch(text: string, patterns: RegExp[]): string | undefined {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) return match[1].trim();
  }
  return undefined;
}

function parseAmount(raw?: string): number | undefined {
  if (!raw) return undefined;
  const cleaned = raw.replace(/[^0-9.,]/g, '').replace(/,/g, '');
  const value = Number.parseFloat(cleaned);
  return Number.isFinite(value) ? value : undefined;
}

function normaliseDate(raw?: string): string | undefined {
  if (!raw) return undefined;
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  // Try DD/MM/YYYY and DD-MM-YYYY explicitly.
  const m = raw.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (m) {
    const [, d, mo, y] = m;
    const year = y.length === 2 ? `20${y}` : y;
    const iso = new Date(`${year}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`);
    if (!Number.isNaN(iso.getTime())) return iso.toISOString();
  }
  return undefined;
}

function detectCurrency(text: string): string | undefined {
  const explicit = firstMatch(text, [
    /\b(GBP|USD|EUR)\b/i,
  ]);
  if (explicit) return explicit.toUpperCase();
  for (const [symbol, code] of Object.entries(CURRENCY_SYMBOLS)) {
    if (text.includes(symbol)) return code;
  }
  return undefined;
}

export function extractInvoiceFields(text: string): {
  fields: ExtractedInvoiceFields;
  confidence: number;
} {
  const invoiceNumber = firstMatch(text, [
    /invoice\s*(?:number|no\.?|#)\s*[:#]?\s*([A-Z0-9\-/]+)/i,
    /\binv[-\s]?([A-Z0-9\-/]+)/i,
  ]);

  const amountRaw = firstMatch(text, [
    /(?:total\s*(?:amount)?\s*due|amount\s*due|grand\s*total|total)\s*[:]?\s*[£$€]?\s*([\d.,]+)/i,
  ]);

  const vatRaw = firstMatch(text, [
    /(?:vat|tax)\s*(?:amount)?\s*[:]?\s*[£$€]?\s*([\d.,]+)/i,
  ]);

  const issueDate = normaliseDate(
    firstMatch(text, [
      /(?:invoice\s*date|issue\s*date|date\s*of\s*issue|date)\s*[:]?\s*([0-9]{1,2}[/-][0-9]{1,2}[/-][0-9]{2,4}|[A-Za-z]+\s+\d{1,2},?\s+\d{4})/i,
    ]),
  );

  const dueDate = normaliseDate(
    firstMatch(text, [
      /(?:due\s*date|payment\s*due|due)\s*[:]?\s*([0-9]{1,2}[/-][0-9]{1,2}[/-][0-9]{2,4}|[A-Za-z]+\s+\d{1,2},?\s+\d{4})/i,
    ]),
  );

  const buyerName = firstMatch(text, [
    /(?:bill\s*to|billed\s*to|buyer|customer|client)\s*[:]?\s*([A-Za-z0-9 &.,'-]{2,60})/i,
  ]);

  const buyerEmail = firstMatch(text, [
    /([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})/i,
  ]);

  const vendor = firstMatch(text, [
    /(?:from|vendor|supplier|seller)\s*[:]?\s*([A-Za-z0-9 &.,'-]{2,60})/i,
  ]);

  const paymentTerms = firstMatch(text, [
    /(?:payment\s*terms|terms)\s*[:]?\s*([A-Za-z0-9 ]{2,40})/i,
    /\b(net\s*\d{1,3})\b/i,
  ]);

  const address = firstMatch(text, [
    /(?:address)\s*[:]?\s*([A-Za-z0-9 ,.'\-/]{6,80})/i,
  ]);

  const description = firstMatch(text, [
    /(?:description|for services|re:)\s*[:]?\s*([A-Za-z0-9 ,.'\-/]{4,120})/i,
  ]);

  const currency = detectCurrency(text);

  const fields: ExtractedInvoiceFields = {
    invoiceNumber,
    vendor,
    buyerName,
    buyerEmail,
    issueDate,
    dueDate,
    currency: currency && SUPPORTED_CURRENCIES.includes(currency as never)
      ? currency
      : currency,
    amount: parseAmount(amountRaw),
    vat: parseAmount(vatRaw),
    paymentTerms,
    address,
    description,
  };

  // Confidence is the share of the core fields that were located.
  const core: (keyof ExtractedInvoiceFields)[] = [
    'invoiceNumber',
    'amount',
    'currency',
    'issueDate',
    'dueDate',
    'buyerName',
  ];
  const found = core.filter((key) => fields[key] !== undefined).length;
  const confidence = Number((found / core.length).toFixed(2));

  return { fields, confidence };
}
