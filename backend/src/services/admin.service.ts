import { Invoice, InvoiceStatus, VerificationStatus } from '@prisma/client';
import { prisma } from '../database/prisma';
import { AUDIT_ACTIONS } from '../config/constants';
import { AuthUser } from '../types';
import { BadRequestError, NotFoundError } from '../utils/appError';
import { auditService } from './audit.service';
import { invoiceService } from './invoice.service';
import { settlementService } from './settlement.service';

// Admin operations: verify, reject, and settle invoices. Verification triggers
// on chain minting so a verified invoice is immediately tokenized.
export class AdminService {
  async listInvoices(): Promise<Invoice[]> {
    return prisma.invoice.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async verify(actor: AuthUser, invoiceId: string): Promise<Invoice> {
    const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) throw new NotFoundError('Invoice not found');
    if (invoice.verificationStatus === VerificationStatus.VERIFIED) {
      throw new BadRequestError('Invoice is already verified');
    }
    if (invoice.status === InvoiceStatus.REJECTED) {
      throw new BadRequestError('A rejected invoice cannot be verified');
    }

    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        verificationStatus: VerificationStatus.VERIFIED,
        status: InvoiceStatus.VERIFIED,
      },
    });
    await auditService.log(AUDIT_ACTIONS.INVOICE_VERIFY, actor.id, { invoiceId });

    // Verification triggers minting.
    return invoiceService.tokenize(actor, invoiceId);
  }

  async reject(actor: AuthUser, invoiceId: string, reason?: string): Promise<Invoice> {
    const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) throw new NotFoundError('Invoice not found');
    if (invoice.status === InvoiceStatus.MINTED || invoice.tokenId) {
      throw new BadRequestError('A tokenized invoice cannot be rejected');
    }

    const updated = await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        verificationStatus: VerificationStatus.REJECTED,
        status: InvoiceStatus.REJECTED,
      },
    });
    await auditService.log(AUDIT_ACTIONS.INVOICE_REJECT, actor.id, {
      invoiceId,
      reason,
    });
    return updated;
  }

  async settle(actor: AuthUser, invoiceId: string): Promise<Invoice> {
    return settlementService.settle(actor, invoiceId);
  }
}

export const adminService = new AdminService();
