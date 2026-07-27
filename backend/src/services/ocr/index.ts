import pdfParse from 'pdf-parse';
import { env } from '../../config/env';
import { OcrResult } from '../../types';
import { extractInvoiceFields } from '../../utils/invoiceFieldExtractor';
import { logger } from '../../utils/logger';

// OCR abstraction. Every provider returns raw text; a shared heuristic then
// extracts structured fields so field logic lives in one place regardless of
// which engine produced the text.
export interface OcrProvider {
  readonly name: string;
  extractText(pdf: Buffer): Promise<{ text: string; confidenceBoost: number }>;
}

// Local provider. Works with no external key by reading the PDF text layer.
class PdfParseProvider implements OcrProvider {
  readonly name = 'pdf-parse';
  async extractText(pdf: Buffer): Promise<{ text: string; confidenceBoost: number }> {
    const data = await pdfParse(pdf);
    return { text: data.text ?? '', confidenceBoost: 0 };
  }
}

// Mistral OCR provider. Higher quality extraction, used when a key is present.
class MistralOcrProvider implements OcrProvider {
  readonly name = 'mistral-ocr';
  async extractText(pdf: Buffer): Promise<{ text: string; confidenceBoost: number }> {
    const { Mistral } = await import('@mistralai/mistralai');
    const client = new Mistral({ apiKey: env.MISTRAL_API_KEY });
    const base64 = pdf.toString('base64');
    const response = await client.ocr.process({
      model: env.MISTRAL_OCR_MODEL,
      document: {
        type: 'document_url',
        documentUrl: `data:application/pdf;base64,${base64}`,
      },
    });
    const text = (response.pages ?? [])
      .map((page) => page.markdown ?? '')
      .join('\n');
    // Mistral produces cleaner text, so grant a small confidence boost.
    return { text, confidenceBoost: 0.1 };
  }
}

export class OcrService {
  private readonly primary: OcrProvider;
  private readonly fallback: OcrProvider;

  constructor() {
    this.fallback = new PdfParseProvider();
    this.primary = env.mistralEnabled ? new MistralOcrProvider() : this.fallback;
  }

  // Extracts text with the primary provider, falling back to local parsing if
  // the primary fails, then derives structured fields and a confidence score.
  async process(pdf: Buffer): Promise<OcrResult> {
    let text = '';
    let confidenceBoost = 0;
    let provider = this.primary.name;

    try {
      const result = await this.primary.extractText(pdf);
      text = result.text;
      confidenceBoost = result.confidenceBoost;
    } catch (err) {
      logger.warn({ err }, `OCR primary provider ${this.primary.name} failed, using fallback`);
      const result = await this.fallback.extractText(pdf);
      text = result.text;
      provider = this.fallback.name;
    }

    const { fields, confidence } = extractInvoiceFields(text);
    return {
      fields,
      confidence: Math.min(1, Number((confidence + confidenceBoost).toFixed(2))),
      rawText: text,
      provider,
    };
  }
}

export const ocrService = new OcrService();
