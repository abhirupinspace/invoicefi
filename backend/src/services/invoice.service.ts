import { Invoice, InvoiceStatus, Prisma, Role } from '@prisma/client';
import { prisma } from '../database/prisma';
import { env } from '../config/env';
import { AUDIT_ACTIONS, SUPPORTED_CURRENCIES } from '../config/constants';
import { AuthUser, ExtractedInvoiceFields } from '../types';
import { sha256Buffer } from '../utils/hash';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../utils/appError';
import { storage } from './storage';
import { ocrService } from './ocr';
import { aiService } from './ai.service';
import { fraudService } from './fraud.service';
import { auditService } from './audit.service';

// Fields a client may declare on upload to override or supplement OCR output.
export interface InvoiceOverrides {
  invoiceNumber?: string;
  buyerName?: string;
  buyerEmail?: string;
  amount?: number;
  currency?: string;
  issueDate?: string;
  dueDate?: string;
  paymentTerms?: string;
}

export interface UploadInput {
  sellerId: string;
  originalName: string;
  buffer: Buffer;
  overrides: InvoiceOverrides;
}

const DAY_MS = 1000 * 60 * 60 * 24;

function coerceDate(value?: string): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function pick<T>(override: T | undefined, extracted: T | undefined): T | undefined {
  return override !== undefined && override !== null ? override : extracted;
}

export class InvoiceService {
  // Full upload pipeline: store, fingerprint, OCR, merge, fraud, AI, persist.
  async upload(input: UploadInput): Promise<Invoice> {
    const hash = sha256Buffer(input.buffer);

    // Reject an identical document before doing expensive work.
    const existingByHash = await prisma.invoice.findUnique({
      where: { invoiceHash: hash },
      select: { id: true },
    });
    if (existingByHash) {
      throw new ConflictError('This exact document has already been uploaded');
    }

    const key = `invoices/${input.sellerId}/${hash}.pdf`;
    await storage.save(key, input.buffer);

    const ocr = await ocrService.process(input.buffer);
    const extracted = ocr.fields;
    const o = input.overrides;

    // Merge declared values over extracted ones.
    const invoiceNumber =
      pick(o.invoiceNumber, extracted.invoiceNumber) ??
      `INV-${hash.slice(0, 10).toUpperCase()}`;

    const declaredAmount = o.amount;
    const amount = pick(o.amount, extracted.amount);
    const currency = (pick(o.currency, extracted.currency) ?? '').toUpperCase();
    const buyerName = pick(o.buyerName, extracted.buyerName);
    const buyerEmail = pick(o.buyerEmail, extracted.buyerEmail);
    const paymentTerms = pick(o.paymentTerms, extracted.paymentTerms);
    const issueDate =
      coerceDate(o.issueDate) ?? coerceDate(extracted.issueDate) ?? new Date();
    const dueDate =
      coerceDate(o.dueDate) ??
      coerceDate(extracted.dueDate) ??
      new Date(issueDate.getTime() + 30 * DAY_MS);

    // Hard validation only for explicitly declared values.
    if (declaredAmount !== undefined && declaredAmount <= 0) {
      throw new BadRequestError('Declared amount must be greater than zero');
    }
    if (o.dueDate && o.issueDate && dueDate <= issueDate) {
      throw new BadRequestError('Due date must be after issue date');
    }
    if (currency && !SUPPORTED_CURRENCIES.includes(currency as never) && o.currency) {
      throw new BadRequestError(
        `Unsupported currency. Supported: ${SUPPORTED_CURRENCIES.join(', ')}`,
      );
    }

    // Duplicate invoice number is a conflict at the data layer.
    const existingByNumber = await prisma.invoice.findUnique({
      where: { invoiceNumber },
      select: { id: true },
    });
    if (existingByNumber) {
      throw new ConflictError(`Invoice number ${invoiceNumber} already exists`);
    }

    const fraud = await fraudService.evaluate({
      invoiceNumber,
      invoiceHash: hash,
      buyerName,
      buyerEmail,
      sellerId: input.sellerId,
      extractedAmount: extracted.amount,
      declaredAmount,
    });

    const analysis = await aiService.analyzeInvoice({
      invoiceNumber,
      buyerName,
      vendor: extracted.vendor,
      amount,
      currency: currency || undefined,
      issueDate,
      dueDate,
      paymentTerms,
      rawText: ocr.rawText,
      ocrConfidence: ocr.confidence,
      buyerSeenBefore: false,
      hasTaxId: Boolean(extracted.vat),
    });

    // Decide whether the invoice can proceed automatically or needs a human.
    const missingCritical =
      amount === undefined ||
      amount <= 0 ||
      !currency ||
      !SUPPORTED_CURRENCIES.includes(currency as never);
    const lowConfidence = ocr.confidence < env.OCR_CONFIDENCE_THRESHOLD;
    const status =
      missingCritical || lowConfidence
        ? InvoiceStatus.NEEDS_REVIEW
        : InvoiceStatus.PARSED;

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        sellerId: input.sellerId,
        buyerName: buyerName ?? 'Unknown',
        buyerEmail: buyerEmail ?? null,
        amount: new Prisma.Decimal(amount ?? 0),
        currency: currency || 'GBP',
        issueDate,
        dueDate,
        paymentTerms: paymentTerms ?? null,
        status,
        riskScore: analysis.riskScore,
        fraudScore: fraud.fraudScore,
        invoiceHash: hash,
        pdfPath: key,
        extracted: extracted as unknown as Prisma.InputJsonValue,
        analysis: {
          ...analysis,
          fraud,
          ocrProvider: ocr.provider,
          ocrConfidence: ocr.confidence,
        } as unknown as Prisma.InputJsonValue,
      },
    });

    await auditService.log(AUDIT_ACTIONS.INVOICE_UPLOAD, input.sellerId, {
      invoiceId: invoice.id,
      invoiceNumber,
      hash,
    });
    await auditService.log(AUDIT_ACTIONS.INVOICE_PARSE, input.sellerId, {
      invoiceId: invoice.id,
      status,
      confidence: ocr.confidence,
      riskScore: analysis.riskScore,
      fraudScore: fraud.fraudScore,
    });

    return invoice;
  }

  async list(actor: AuthUser): Promise<Invoice[]> {
    if (actor.role === Role.ADMIN) {
      return prisma.invoice.findMany({ orderBy: { createdAt: 'desc' } });
    }
    return prisma.invoice.findMany({
      where: { sellerId: actor.id },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getById(actor: AuthUser, id: string): Promise<Invoice> {
    const invoice = await prisma.invoice.findUnique({ where: { id } });
    if (!invoice) throw new NotFoundError('Invoice not found');
    const isOwner = invoice.sellerId === actor.id;
    const isAdmin = actor.role === Role.ADMIN;
    const isInvestor = actor.role === Role.INVESTOR;
    // Owners and admins see everything; investors may view any invoice so they
    // can assess marketplace opportunities.
    if (!isOwner && !isAdmin && !isInvestor) {
      throw new ForbiddenError('You cannot view this invoice');
    }
    return invoice;
  }

  // Fetch an invoice for internal service use with no access check.
  async requireById(id: string): Promise<Invoice> {
    const invoice = await prisma.invoice.findUnique({ where: { id } });
    if (!invoice) throw new NotFoundError('Invoice not found');
    return invoice;
  }

  extractedOf(invoice: Invoice): ExtractedInvoiceFields {
    return (invoice.extracted as ExtractedInvoiceFields) ?? {};
  }
}

export const invoiceService = new InvoiceService();
