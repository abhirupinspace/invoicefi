import { env } from '../config/env';
import { InvoiceAnalysis, InvoiceFlag } from '../types';
import { logger } from '../utils/logger';

// Input the analyser reasons over. Values come from OCR plus database context.
export interface AnalyzeInput {
  invoiceNumber?: string;
  buyerName?: string;
  vendor?: string;
  amount?: number;
  currency?: string;
  issueDate?: Date;
  dueDate?: Date;
  paymentTerms?: string;
  rawText?: string;
  ocrConfidence: number;
  // Context signals supplied by the caller.
  buyerSeenBefore: boolean;
  hasTaxId: boolean;
}

const CLAMP = (n: number): number => Math.max(0, Math.min(100, Math.round(n)));

// Deterministic rule based analysis. This is the source of truth for risk and
// runs whenever OpenAI is not configured or a call fails, so the pipeline
// always produces a score. When OpenAI is enabled its narrative augments this.
function ruleBasedAnalysis(input: AnalyzeInput): InvoiceAnalysis {
  const flags: InvoiceFlag[] = [];
  let risk = 20; // baseline

  const now = new Date();
  if (input.dueDate && input.dueDate.getTime() < now.getTime()) {
    flags.push('Expired Due Date');
    risk += 25;
  }

  if (!input.hasTaxId) {
    flags.push('Missing Tax ID');
    risk += 10;
  }

  if (!input.buyerName) {
    flags.push('Unknown Buyer');
    risk += 15;
  } else if (!input.buyerSeenBefore) {
    risk += 8;
  }

  if (input.amount !== undefined) {
    if (input.amount <= 0) {
      flags.push('Unusual Amount');
      risk += 20;
    } else if (input.amount > 250000) {
      flags.push('Unusual Amount');
      risk += 15;
    }
  } else {
    flags.push('Unusual Amount');
    risk += 12;
  }

  // Low OCR confidence suggests a poorly structured or altered document.
  if (input.ocrConfidence < 0.5) {
    flags.push('Modified Document');
    risk += 12;
  }

  const confidence = Number((0.5 + input.ocrConfidence / 2).toFixed(2));
  const summary = buildSummary(input, flags);

  return { riskScore: CLAMP(risk), confidence, summary, flags: dedupe(flags) };
}

function dedupe(flags: InvoiceFlag[]): InvoiceFlag[] {
  return Array.from(new Set(flags));
}

function buildSummary(input: AnalyzeInput, flags: InvoiceFlag[]): string {
  const who = input.buyerName ? `buyer ${input.buyerName}` : 'an unnamed buyer';
  const value =
    input.amount !== undefined && input.currency
      ? `${input.currency} ${input.amount.toLocaleString()}`
      : 'an unspecified amount';
  const base = `Invoice ${input.invoiceNumber ?? 'without a clear number'} for ${value} issued to ${who}.`;
  if (flags.length === 0) return `${base} No anomalies detected.`;
  return `${base} Flags raised: ${flags.join(', ')}.`;
}

export class AiService {
  // Analyses an invoice for risk, anomalies, and a plain language summary.
  async analyzeInvoice(input: AnalyzeInput): Promise<InvoiceAnalysis> {
    const base = ruleBasedAnalysis(input);
    if (!env.openaiEnabled) return base;

    try {
      const narrative = await this.summariseWithOpenAI(input, base);
      return { ...base, summary: narrative || base.summary };
    } catch (err) {
      logger.warn({ err }, 'OpenAI analysis failed, using rule based result');
      return base;
    }
  }

  private async summariseWithOpenAI(
    input: AnalyzeInput,
    base: InvoiceAnalysis,
  ): Promise<string> {
    const { default: OpenAI } = await import('openai');
    const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
    const completion = await client.chat.completions.create({
      model: env.OPENAI_MODEL,
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content:
            'You are a credit risk analyst for an invoice financing platform. Given invoice fields and a computed risk profile, write a concise two sentence summary highlighting the key risk drivers. Do not invent facts.',
        },
        {
          role: 'user',
          content: JSON.stringify({
            invoiceNumber: input.invoiceNumber,
            buyer: input.buyerName,
            vendor: input.vendor,
            amount: input.amount,
            currency: input.currency,
            dueDate: input.dueDate,
            riskScore: base.riskScore,
            flags: base.flags,
          }),
        },
      ],
    });
    return completion.choices[0]?.message?.content?.trim() ?? '';
  }

  // Generates a short pricing narrative used by the pricing engine.
  async pricingNarrative(context: Record<string, unknown>): Promise<string | undefined> {
    if (!env.openaiEnabled) return undefined;
    try {
      const { default: OpenAI } = await import('openai');
      const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
      const completion = await client.chat.completions.create({
        model: env.OPENAI_MODEL,
        temperature: 0.3,
        messages: [
          {
            role: 'system',
            content:
              'You explain invoice financing prices to investors in one concise sentence. Be factual and reference the discount and yield.',
          },
          { role: 'user', content: JSON.stringify(context) },
        ],
      });
      return completion.choices[0]?.message?.content?.trim();
    } catch (err) {
      logger.warn({ err }, 'OpenAI pricing narrative failed');
      return undefined;
    }
  }
}

export const aiService = new AiService();
