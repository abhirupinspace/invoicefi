-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('BUSINESS', 'INVESTOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'UPLOADED', 'PARSED', 'NEEDS_REVIEW', 'VERIFIED', 'MINTED', 'LISTED', 'FUNDED', 'SETTLED', 'CLOSED', 'REJECTED');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('ACTIVE', 'SOLD', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InvestmentStatus" AS ENUM ('ACTIVE', 'SETTLED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'BUSINESS',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "buyerName" TEXT NOT NULL,
    "buyerEmail" TEXT,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "paymentTerms" TEXT,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "riskScore" INTEGER,
    "fraudScore" INTEGER,
    "invoiceHash" TEXT NOT NULL,
    "pdfPath" TEXT,
    "tokenId" TEXT,
    "extracted" JSONB,
    "analysis" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "investments" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "investorId" TEXT NOT NULL,
    "purchasePrice" DECIMAL(18,2) NOT NULL,
    "expectedReturn" DECIMAL(18,2) NOT NULL,
    "status" "InvestmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "txHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "investments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_listings" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "askingPrice" DECIMAL(18,2) NOT NULL,
    "status" "ListingStatus" NOT NULL DEFAULT 'ACTIVE',
    "chainListingId" TEXT,
    "txHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketplace_listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actor" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_invoiceNumber_key" ON "invoices"("invoiceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_invoiceHash_key" ON "invoices"("invoiceHash");

-- CreateIndex
CREATE INDEX "invoices_sellerId_idx" ON "invoices"("sellerId");

-- CreateIndex
CREATE INDEX "invoices_status_idx" ON "invoices"("status");

-- CreateIndex
CREATE INDEX "investments_investorId_idx" ON "investments"("investorId");

-- CreateIndex
CREATE INDEX "investments_invoiceId_idx" ON "investments"("invoiceId");

-- CreateIndex
CREATE INDEX "marketplace_listings_status_idx" ON "marketplace_listings"("status");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investments" ADD CONSTRAINT "investments_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investments" ADD CONSTRAINT "investments_investorId_fkey" FOREIGN KEY ("investorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_listings" ADD CONSTRAINT "marketplace_listings_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

