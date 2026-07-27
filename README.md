# InvoiceFi

AI powered tokenized invoice financing platform on Stellar Soroban. InvoiceFi lets businesses turn verified invoices into on chain assets, list them on a marketplace, receive immediate liquidity from investors, and settle automatically once the invoice is repaid.

This repository is backend first. It ships REST APIs and Soroban smart contracts. There is no frontend.

## What it does

A business uploads an invoice PDF. The platform extracts the invoice data with OCR, analyses it with a language model for risk and fraud signals, and stores a fingerprint of the document. An administrator verifies the invoice, which mints an on chain invoice NFT that carries the face value, due date, and document hash. The business lists the NFT on the marketplace. An investor buys it and provides upfront cash at a discount. When the buyer of the invoice pays, the settlement engine releases funds to the investor, burns the NFT, and closes the invoice.

## Architecture

```
Client
  -> Express routes
  -> controllers (thin, request and response only)
  -> services (all business logic)
       -> Prisma repositories (PostgreSQL)
       -> AiService (OpenAI)
       -> OcrService (Mistral OCR)
       -> FraudService, PricingService
       -> BlockchainService (stellar-sdk)
            -> Soroban contracts: invoice_nft, marketplace, settlement
  -> AuditService records every mutating action
```

The design keeps controllers free of logic, isolates all chain interaction inside a single blockchain service, and uses strong TypeScript types end to end. Every endpoint returns the same envelope.

## Tech stack

Backend: Node.js 20, TypeScript, Express, PostgreSQL, Prisma, Redis (optional), JWT with bcrypt, Zod validation.

Blockchain: Stellar, Soroban smart contracts written in Rust.

AI: OpenAI for analysis, pricing narrative, and natural language querying. Mistral OCR for document extraction.

Tooling: Swagger for API docs, Vitest for tests, Docker Compose for local infrastructure.

## Repository layout

```
backend/      Express API, Prisma schema, services, tests
contracts/    Soroban smart contracts (invoice_nft, marketplace, settlement)
tasks/        Build plan and progress notes
docker-compose.yml
.env.example
```

## Quick start

Prerequisites: Node 20, Docker, and the Stellar CLI if you want to build the contracts.

1. Copy the environment file and adjust values.

   ```
   cp .env.example .env
   ```

2. Start infrastructure and the API.

   ```
   docker compose up --build
   ```

   The API runs migrations on boot and listens on port 4000. Swagger UI is served at `/docs`.

### Running the backend without Docker

```
cd backend
npm install
npx prisma migrate dev
npm run dev
```

You still need a reachable PostgreSQL instance. The compose file provides one on `localhost:5432`.

## Environment variables

See `.env.example` for the full list. The important ones are `DATABASE_URL`, `JWT_SECRET`, `OPENAI_API_KEY`, `MISTRAL_API_KEY`, `SOROBAN_RPC`, and the deployed contract ids. AI and OCR keys are optional. When a key is absent the related feature returns a clear service unavailable response and the rest of the platform keeps working.

## Documentation

Full setup, API reference, and contract details are expanded as the build progresses. The live API reference is always available at `/docs` once the server is running.

## Status

This project is under active construction and follows the phased plan in `tasks/todo.md`.
