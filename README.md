# InvoiceFi

AI powered tokenized invoice financing platform on Stellar Soroban. InvoiceFi lets businesses turn verified invoices into on chain assets, list them on a marketplace, receive immediate liquidity from investors, and settle automatically once the invoice is repaid.

This repository is backend first. It ships REST APIs and Soroban smart contracts. There is no frontend.

## Table of contents

1. [What it does](#what-it-does)
2. [Architecture](#architecture)
3. [Tech stack](#tech-stack)
4. [Repository layout](#repository-layout)
5. [Quick start with Docker](#quick-start-with-docker)
6. [Local development](#local-development)
7. [Environment variables](#environment-variables)
8. [Database and seed data](#database-and-seed-data)
9. [API reference](#api-reference)
10. [Smart contracts](#smart-contracts)
11. [Blockchain service modes](#blockchain-service-modes)
12. [AI and OCR behaviour](#ai-and-ocr-behaviour)
13. [Testing](#testing)
14. [Postman](#postman)
15. [Security notes](#security-notes)
16. [Roadmap](#roadmap)

## What it does

A business uploads an invoice PDF. The platform fingerprints the document, extracts the invoice data with OCR, and analyses it with a language model for risk and fraud signals. An administrator verifies the invoice, which mints an on chain invoice NFT carrying the face value, due date, and document hash. The business lists the NFT on the marketplace. An investor buys it and provides upfront cash at a discount. When the buyer of the invoice repays, the settlement engine pays the investor, burns the NFT, and closes the invoice.

The full lifecycle is: Draft, Uploaded, AI Parsed, Verified, Minted, Listed, Funded, Settled, Closed.

## Architecture

```
Client
  -> Express routes
  -> controllers (thin, request and response only)
  -> services (all business logic)
       -> Prisma repositories (PostgreSQL)
       -> AiService (OpenAI)
       -> OcrService (Mistral OCR, local pdf-parse fallback)
       -> FraudService, PricingService
       -> BlockchainService (stellar-sdk)
            -> Soroban contracts: invoice_nft, marketplace, settlement
  -> AuditService records every mutating action
```

The design keeps controllers free of logic, isolates all chain interaction inside a single blockchain service, and uses strong TypeScript types end to end. Every endpoint returns the same envelope:

```json
{ "success": true, "data": { } }
{ "success": false, "error": { "code": "NOT_FOUND", "message": "Invoice not found" } }
```

## Tech stack

Backend: Node.js 20, TypeScript, Express, PostgreSQL, Prisma, Redis (optional), JWT with bcrypt, Zod validation.

Blockchain: Stellar, Soroban smart contracts written in Rust.

AI: OpenAI for analysis, pricing narrative, and natural language querying. Mistral OCR for document extraction.

Tooling: Swagger for API docs, Vitest for tests, Docker Compose for local infrastructure.

## Repository layout

```
backend/
  src/
    config/        environment loader (Zod validated) and constants
    types/         shared types and domain enums
    utils/         response envelope, typed errors, hashing, logger, money
    middleware/    auth, rbac, validation, upload, error handler
    database/      Prisma client singleton
    services/      auth, invoice, ocr, ai, fraud, pricing, marketplace,
                   settlement, blockchain, portfolio, admin, aiChat, audit
    controllers/   thin request handlers
    routes/        one router per feature
    swagger/       OpenAPI assembly
    app.ts, server.ts
  prisma/          schema, migrations, seed
  tests/           unit and integration tests
  postman/         Postman collection
  storage/         uploaded PDFs (local, IPFS ready abstraction)
contracts/
  invoice_nft/     the invoice NFT contract
  marketplace/     listing, buying, and cancelling
  settlement/      atomic settlement and burn
  Cargo.toml       workspace
scripts/deploy.sh  deploy and wire the contracts
docker-compose.yml
.env.example
```

## Quick start with Docker

Prerequisites: Docker and Docker Compose.

```
cp .env.example .env
docker compose up --build
```

The API container runs database migrations on boot, then listens on port 4000. Postgres and Redis start alongside it. Open the interactive API reference at http://localhost:4000/docs.

To load demo data after the stack is running:

```
docker compose exec api npx prisma db seed
```

## Local development

Prerequisites: Node 20, a reachable PostgreSQL instance (the compose file provides one), and optionally the Stellar CLI for the contracts.

```
cd backend
npm install
cp ../.env.example ../.env    # or create backend/.env
npx prisma migrate deploy
npm run prisma:seed           # optional demo data
npm run dev
```

The development server reloads on change. Useful scripts:

```
npm run build        compile to dist
npm start            run the compiled server
npm run typecheck    type check without emitting
npm test             run the test suite
npm run prisma:seed  load demo data
```

## Environment variables

All configuration is read from the environment and validated at startup. See `.env.example` for the full list. Key variables:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | signing secret for JWTs (16 characters or more) |
| `ADMIN_SECRET` | required to register an admin account |
| `OPENAI_API_KEY` | enables AI analysis and chat (optional) |
| `MISTRAL_API_KEY` | enables Mistral OCR, otherwise local parsing is used (optional) |
| `SOROBAN_RPC` | Soroban RPC endpoint |
| `STELLAR_PLATFORM_SECRET` | platform signing key for on chain calls (optional) |
| `INVOICE_NFT_CONTRACT`, `MARKETPLACE_CONTRACT`, `SETTLEMENT_CONTRACT` | deployed contract ids |
| `PAY_TOKEN_CONTRACT` | payment token contract, defaults to wrapped native XLM |

AI, OCR, and chain keys are optional. When a key is absent the related feature degrades gracefully, described below.

## Database and seed data

The schema lives in `backend/prisma/schema.prisma` and migrations in `backend/prisma/migrations`. Apply migrations with `npx prisma migrate deploy`.

The seed script creates a realistic dataset: 1 admin, 5 businesses, 10 investors, 30 invoices spread across the lifecycle, 15 active marketplace listings, and 5 completed settlements. Every seeded account uses the password `password123`.

```
npm run prisma:seed
```

## API reference

The live, interactive reference is served at `/docs` and the raw document at `/openapi.json`. Summary:

Auth
- `POST /auth/register` register a business, investor, or admin
- `POST /auth/login` authenticate and receive a JWT
- `GET /auth/profile` current user

Invoice (business)
- `POST /invoice/upload` upload a PDF and run the extraction pipeline
- `GET /invoice` list your invoices
- `GET /invoice/:id` get one invoice
- `POST /invoice/tokenize` mint the NFT for a verified invoice
- `POST /invoice/list` list a minted invoice for funding

Marketplace
- `GET /marketplace` browse active listings
- `GET /marketplace/:id` get one listing
- `POST /marketplace/list` list a minted invoice
- `POST /marketplace/buy` buy a listing (investor)
- `POST /marketplace/cancel` cancel a listing (seller)

Portfolio (investor)
- `GET /portfolio` active holdings
- `GET /portfolio/history` full history
- `GET /portfolio/returns` aggregate returns

Admin
- `GET /admin/invoices` list every invoice
- `POST /invoice/:id/verify` verify and trigger minting
- `POST /invoice/:id/reject` reject an invoice
- `POST /invoice/:id/settle` settle a funded invoice

AI
- `POST /ai/query` natural language question over invoices
- `POST /ai/analyze/:id` re-run risk analysis
- `GET /ai/price/:id` recommended funding price and yield

System
- `GET /health` liveness probe

## Smart contracts

Three independent Soroban contracts live under `contracts/`.

invoice_nft
- `init(admin)`, `set_burner(burner)`
- `mint(invoice_id, seller, face_value, due_date, verified, hash) -> token_id`
- `owner_of`, `metadata_of`, `exists`, `transfer(from, to, token_id)`, `burn(token_id)`
- The admin mints. The burner (the settlement contract) burns on settlement.

marketplace
- `init(admin, nft, pay_token)`
- `list(seller, token_id, price)` escrows the NFT in the contract
- `buy(buyer, listing_id)` transfers payment and the NFT atomically
- `cancel(seller, listing_id)`, `get_listing`, `get_listings`

settlement
- `init(admin, nft, pay_token)`
- `settle(token_id, payer, investor, amount)` pays the investor, burns the NFT, and records the token as settled, all in one atomic call. A double settlement reverts.

Build and test:

```
cd contracts
cargo test
stellar contract build
```

Deploy to a network (requires a funded Stellar identity):

```
stellar keys generate platform --network testnet --fund
DEPLOY_SOURCE=platform STELLAR_NETWORK=testnet ./scripts/deploy.sh
```

The script deploys all three contracts, initializes them, points the NFT burner at the settlement contract, resolves a payment token, and prints the contract ids to place in your `.env`.

The contracts pin `ed25519-dalek` to the 2.x line through `contracts/Cargo.lock`, which is committed for reproducible builds.

## Blockchain service modes

The backend never talks to the SDK directly. All chain calls go through `BlockchainService`, which has two modes.

Configured mode: when `STELLAR_PLATFORM_SECRET` and the contract ids are set, the service builds, simulates, signs, and submits real Soroban transactions, then polls for the result.

Dry run mode: when those values are absent, the service returns deterministic synthetic results so the entire backend flow (tokenize, list, buy, settle) works end to end without a deployed chain. This is the default for local development and the seeded demo.

The MVP uses a custodial model where a single platform account signs and holds custody of NFTs and balances on chain, while the database is the source of truth for which user owns what. Production would replace this with per user wallets and SEP 10 authenticated transactions.

## AI and OCR behaviour

OCR: with `MISTRAL_API_KEY` set, invoice PDFs are read by Mistral OCR. Without a key, a local pdf-parse based reader extracts the text layer. Either way a shared heuristic turns the text into structured fields with a confidence score. Low confidence marks the invoice for human review.

Risk analysis: a deterministic rule based engine always produces a risk score, confidence, summary, and flags such as Expired Due Date, Missing Tax ID, Unknown Buyer, Unusual Amount, and Modified Document. When `OPENAI_API_KEY` is set, OpenAI enriches the summary. Analysis therefore works with or without a key.

Fraud checks: duplicate document hash, duplicate invoice number, already financed invoice number, declared versus extracted amount mismatch, and repeated buyer, combined into a fraud score.

Pricing: face value, risk band, and days to due produce a funding price, yield, and discount rate. A ten thousand pound low risk invoice due in thirty days prices at nine thousand seven hundred sixty pounds with a yield near 2.4 percent.

Natural language querying: `POST /ai/query` maps a question to one of a fixed set of safe, parameterized queries scoped to the caller's role. The model never produces raw SQL, so there is no injection surface.

## Testing

```
cd backend
npm test
```

Unit tests cover auth, pricing, fraud, field extraction, portfolio maths, and the blockchain dry run path. Contract tests run with `cargo test` under `contracts/`. Integration tests that need a live database are guarded behind `RUN_INTEGRATION=1`.

## Postman

Import `backend/postman/InvoiceFi.postman_collection.json`. Set the `baseUrl` variable, then run Register or Login and the collection captures the JWT automatically for the remaining requests.

## Security notes

Passwords are hashed with bcrypt. Access is gated by JWT authentication and role based authorization. Every mutating action writes an audit log. Requests are validated with Zod. Secrets are read from the environment and never logged.

## Roadmap

Out of scope for this MVP but designed for: cross border stablecoin settlement, fractional invoice ownership, a secondary marketplace, institutional liquidity pools, real time credit scores, oracle verification, ERP integrations, email verification, on chain reputation, and RWA lending pools.
```
