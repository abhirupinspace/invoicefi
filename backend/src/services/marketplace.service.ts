import {
  InvestmentStatus,
  InvoiceStatus,
  ListingStatus,
  MarketplaceListing,
  Prisma,
  Role,
} from '@prisma/client';
import { prisma } from '../database/prisma';
import { AUDIT_ACTIONS } from '../config/constants';
import { AuthUser } from '../types';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../utils/appError';
import { toMinorUnits } from '../utils/money';
import { auditService } from './audit.service';
import { blockchainService } from './blockchain.service';

export interface ListInput {
  invoiceId: string;
  askingPrice: number;
}

export class MarketplaceService {
  // Lists a minted invoice for funding. Escrows the NFT on chain and records the
  // listing. Only the invoice owner or an admin may list.
  async list(actor: AuthUser, input: ListInput): Promise<MarketplaceListing> {
    const invoice = await prisma.invoice.findUnique({
      where: { id: input.invoiceId },
    });
    if (!invoice) throw new NotFoundError('Invoice not found');
    if (actor.role !== Role.ADMIN && invoice.sellerId !== actor.id) {
      throw new ForbiddenError('Only the invoice owner can list it');
    }
    if (invoice.status !== InvoiceStatus.MINTED || !invoice.tokenId) {
      throw new BadRequestError('Invoice must be minted before listing');
    }
    const active = await prisma.marketplaceListing.findFirst({
      where: { invoiceId: invoice.id, status: ListingStatus.ACTIVE },
    });
    if (active) throw new ConflictError('Invoice already has an active listing');
    if (input.askingPrice <= 0) {
      throw new BadRequestError('Asking price must be greater than zero');
    }

    const chain = await blockchainService.listInvoice({
      tokenId: invoice.tokenId,
      price: toMinorUnits(input.askingPrice),
    });

    const listing = await prisma.$transaction(async (tx) => {
      const created = await tx.marketplaceListing.create({
        data: {
          invoiceId: invoice.id,
          askingPrice: new Prisma.Decimal(input.askingPrice),
          status: ListingStatus.ACTIVE,
          chainListingId: chain.value ?? null,
          txHash: chain.txHash ?? null,
        },
      });
      await tx.invoice.update({
        where: { id: invoice.id },
        data: { status: InvoiceStatus.LISTED },
      });
      return created;
    });

    await auditService.log(AUDIT_ACTIONS.MARKETPLACE_LIST, actor.id, {
      invoiceId: invoice.id,
      listingId: listing.id,
      askingPrice: input.askingPrice,
      chainListingId: chain.value,
      dryRun: chain.dryRun,
    });

    return listing;
  }

  async getListings(): Promise<MarketplaceListing[]> {
    return prisma.marketplaceListing.findMany({
      where: { status: ListingStatus.ACTIVE },
      include: { invoice: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getListing(id: string): Promise<MarketplaceListing> {
    const listing = await prisma.marketplaceListing.findUnique({
      where: { id },
      include: { invoice: true },
    });
    if (!listing) throw new NotFoundError('Listing not found');
    return listing;
  }

  // An investor buys a listed invoice. Payment and NFT ownership move atomically
  // on chain, an investment is recorded, and the invoice becomes funded.
  async buy(actor: AuthUser, listingId: string): Promise<{ investmentId: string }> {
    if (actor.role !== Role.INVESTOR && actor.role !== Role.ADMIN) {
      throw new ForbiddenError('Only investors can buy invoices');
    }
    const listing = await prisma.marketplaceListing.findUnique({
      where: { id: listingId },
      include: { invoice: true },
    });
    if (!listing) throw new NotFoundError('Listing not found');
    if (listing.status !== ListingStatus.ACTIVE) {
      throw new ConflictError('Listing is not available');
    }

    const chain = await blockchainService.buyInvoice({
      listingId: listing.chainListingId ?? '0',
    });

    const faceValue = listing.invoice.amount;
    const investment = await prisma.$transaction(async (tx) => {
      const created = await tx.investment.create({
        data: {
          invoiceId: listing.invoiceId,
          investorId: actor.id,
          purchasePrice: listing.askingPrice,
          expectedReturn: faceValue,
          status: InvestmentStatus.ACTIVE,
          txHash: chain.txHash ?? null,
        },
      });
      await tx.marketplaceListing.update({
        where: { id: listing.id },
        data: { status: ListingStatus.SOLD },
      });
      await tx.invoice.update({
        where: { id: listing.invoiceId },
        data: { status: InvoiceStatus.FUNDED },
      });
      return created;
    });

    await auditService.log(AUDIT_ACTIONS.MARKETPLACE_BUY, actor.id, {
      invoiceId: listing.invoiceId,
      listingId: listing.id,
      investmentId: investment.id,
      dryRun: chain.dryRun,
    });

    return { investmentId: investment.id };
  }

  // Cancels an active listing owned by the actor and returns the NFT.
  async cancel(actor: AuthUser, listingId: string): Promise<MarketplaceListing> {
    const listing = await prisma.marketplaceListing.findUnique({
      where: { id: listingId },
      include: { invoice: true },
    });
    if (!listing) throw new NotFoundError('Listing not found');
    if (actor.role !== Role.ADMIN && listing.invoice.sellerId !== actor.id) {
      throw new ForbiddenError('Only the seller can cancel this listing');
    }
    if (listing.status !== ListingStatus.ACTIVE) {
      throw new ConflictError('Listing is not active');
    }

    const chain = await blockchainService.cancelListing(
      listing.chainListingId ?? '0',
    );

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.marketplaceListing.update({
        where: { id: listing.id },
        data: { status: ListingStatus.CANCELLED },
      });
      await tx.invoice.update({
        where: { id: listing.invoiceId },
        data: { status: InvoiceStatus.MINTED },
      });
      return result;
    });

    await auditService.log(AUDIT_ACTIONS.MARKETPLACE_CANCEL, actor.id, {
      invoiceId: listing.invoiceId,
      listingId: listing.id,
      dryRun: chain.dryRun,
    });

    return updated;
  }
}

export const marketplaceService = new MarketplaceService();
