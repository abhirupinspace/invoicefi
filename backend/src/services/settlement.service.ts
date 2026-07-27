import {
  InvestmentStatus,
  Invoice,
  InvoiceStatus,
  VerificationStatus,
} from '@prisma/client';
import { prisma } from '../database/prisma';
import { AUDIT_ACTIONS } from '../config/constants';
import { AuthUser } from '../types';
import { BadRequestError, ConflictError, NotFoundError } from '../utils/appError';
import { toMinorUnits } from '../utils/money';
import { auditService } from './audit.service';
import { blockchainService } from './blockchain.service';

// Closes the lifecycle of a financed invoice. Marks it repaid on chain, which
// pays the investor and burns the NFT, then updates the database.
export class SettlementService {
  async settle(actor: AuthUser, invoiceId: string): Promise<Invoice> {
    const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) throw new NotFoundError('Invoice not found');

    if (invoice.verificationStatus !== VerificationStatus.VERIFIED) {
      throw new BadRequestError('Only verified invoices can be settled');
    }
    if (invoice.status === InvoiceStatus.SETTLED || invoice.status === InvoiceStatus.CLOSED) {
      throw new ConflictError('Invoice is already settled');
    }
    if (invoice.status !== InvoiceStatus.FUNDED || !invoice.tokenId) {
      throw new BadRequestError('Only funded invoices can be settled');
    }

    const chain = await blockchainService.settleInvoice({
      tokenId: invoice.tokenId,
      amount: toMinorUnits(invoice.amount),
    });

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.invoice.update({
        where: { id: invoice.id },
        data: { status: InvoiceStatus.SETTLED },
      });
      await tx.investment.updateMany({
        where: { invoiceId: invoice.id, status: InvestmentStatus.ACTIVE },
        data: { status: InvestmentStatus.SETTLED },
      });
      // Mark the invoice closed once settlement has propagated.
      return tx.invoice.update({
        where: { id: result.id },
        data: { status: InvoiceStatus.CLOSED },
      });
    });

    await auditService.log(AUDIT_ACTIONS.SETTLEMENT_SETTLE, actor.id, {
      invoiceId: invoice.id,
      tokenId: invoice.tokenId,
      txHash: chain.txHash,
      dryRun: chain.dryRun,
    });

    return updated;
  }
}

export const settlementService = new SettlementService();
