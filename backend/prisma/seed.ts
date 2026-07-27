import {
  InvestmentStatus,
  InvoiceStatus,
  ListingStatus,
  PrismaClient,
  Role,
  VerificationStatus,
} from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '..', '.env') });

const prisma = new PrismaClient();

const DAY = 1000 * 60 * 60 * 24;
const CURRENCIES = ['GBP', 'USD', 'EUR'];
const BUYERS = ['Globex', 'Initech', 'Umbrella', 'Soylent', 'Hooli', 'Stark Industries'];

function hash(seed: string): string {
  return crypto.createHash('sha256').update(seed).digest('hex');
}

async function main(): Promise<void> {
  console.log('Clearing existing data...');
  await prisma.auditLog.deleteMany();
  await prisma.investment.deleteMany();
  await prisma.marketplaceListing.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.user.deleteMany();

  const password = await bcrypt.hash('password123', 8);

  console.log('Creating users...');
  const admin = await prisma.user.create({
    data: { name: 'Platform Admin', email: 'admin@invoicefi.dev', password, role: Role.ADMIN },
  });

  const businesses = await Promise.all(
    Array.from({ length: 5 }, (_, i) =>
      prisma.user.create({
        data: {
          name: `Business ${i + 1}`,
          email: `business${i + 1}@invoicefi.dev`,
          password,
          role: Role.BUSINESS,
        },
      }),
    ),
  );

  const investors = await Promise.all(
    Array.from({ length: 10 }, (_, i) =>
      prisma.user.create({
        data: {
          name: `Investor ${i + 1}`,
          email: `investor${i + 1}@invoicefi.dev`,
          password,
          role: Role.INVESTOR,
        },
      }),
    ),
  );

  console.log('Creating invoices, listings, investments...');
  const now = Date.now();
  let tokenCounter = 0;

  // Status plan across 30 invoices:
  //   0..4   settled and closed (5 completed settlements)
  //   5..19  listed with an active marketplace listing (15 listings)
  //   20..24 funded, awaiting settlement (active investments)
  //   25..27 verified and minted, not yet listed
  //   28..29 pending review
  for (let i = 0; i < 30; i += 1) {
    const seller = businesses[i % businesses.length];
    const amount = 2000 + (i % 10) * 1500 + 500;
    const currency = CURRENCIES[i % CURRENCIES.length];
    const dueInDays = (i % 6) - 2; // yields overdue, due soon, and future dates
    const dueDate = new Date(now + dueInDays * 7 * DAY);
    const issueDate = new Date(dueDate.getTime() - 30 * DAY);
    const riskScore = (i * 7) % 100;
    const fraudScore = (i * 3) % 40;

    let status: InvoiceStatus = InvoiceStatus.PARSED;
    let verificationStatus: VerificationStatus = VerificationStatus.PENDING;
    let tokenId: string | null = null;

    if (i < 5) {
      status = InvoiceStatus.CLOSED;
      verificationStatus = VerificationStatus.VERIFIED;
      tokenId = String(++tokenCounter);
    } else if (i < 20) {
      status = InvoiceStatus.LISTED;
      verificationStatus = VerificationStatus.VERIFIED;
      tokenId = String(++tokenCounter);
    } else if (i < 25) {
      status = InvoiceStatus.FUNDED;
      verificationStatus = VerificationStatus.VERIFIED;
      tokenId = String(++tokenCounter);
    } else if (i < 28) {
      status = InvoiceStatus.MINTED;
      verificationStatus = VerificationStatus.VERIFIED;
      tokenId = String(++tokenCounter);
    } else {
      status = i === 29 ? InvoiceStatus.NEEDS_REVIEW : InvoiceStatus.PARSED;
    }

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber: `INV-${1000 + i}`,
        sellerId: seller.id,
        buyerName: BUYERS[i % BUYERS.length],
        buyerEmail: `accounts@${BUYERS[i % BUYERS.length].toLowerCase().replace(/\s/g, '')}.com`,
        amount,
        currency,
        issueDate,
        dueDate,
        paymentTerms: 'Net 30',
        status,
        verificationStatus,
        riskScore,
        fraudScore,
        invoiceHash: hash(`seed-invoice-${i}`),
        tokenId,
      },
    });

    // Price the funding at a small discount to face value.
    const price = Math.round(amount * 0.96);

    if (i < 5) {
      // Completed settlement: sold listing plus a settled investment.
      await prisma.marketplaceListing.create({
        data: {
          invoiceId: invoice.id,
          askingPrice: price,
          status: ListingStatus.SOLD,
          chainListingId: String(i + 1),
        },
      });
      await prisma.investment.create({
        data: {
          invoiceId: invoice.id,
          investorId: investors[i % investors.length].id,
          purchasePrice: price,
          expectedReturn: amount,
          status: InvestmentStatus.SETTLED,
        },
      });
    } else if (i < 20) {
      // Active listing available on the marketplace.
      await prisma.marketplaceListing.create({
        data: {
          invoiceId: invoice.id,
          askingPrice: price,
          status: ListingStatus.ACTIVE,
          chainListingId: String(i + 1),
        },
      });
    } else if (i < 25) {
      // Funded: sold listing plus an active investment awaiting settlement.
      await prisma.marketplaceListing.create({
        data: {
          invoiceId: invoice.id,
          askingPrice: price,
          status: ListingStatus.SOLD,
          chainListingId: String(i + 1),
        },
      });
      await prisma.investment.create({
        data: {
          invoiceId: invoice.id,
          investorId: investors[i % investors.length].id,
          purchasePrice: price,
          expectedReturn: amount,
          status: InvestmentStatus.ACTIVE,
        },
      });
    }
  }

  await prisma.auditLog.create({
    data: { action: 'SEED', actor: admin.id, metadata: { note: 'database seeded' } },
  });

  const counts = {
    users: await prisma.user.count(),
    invoices: await prisma.invoice.count(),
    listings: await prisma.marketplaceListing.count(),
    activeListings: await prisma.marketplaceListing.count({ where: { status: ListingStatus.ACTIVE } }),
    investments: await prisma.investment.count(),
    settlements: await prisma.investment.count({ where: { status: InvestmentStatus.SETTLED } }),
  };
  console.log('Seed complete:', counts);
  console.log('Login with any seeded email and password "password123".');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
