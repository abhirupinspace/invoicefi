# Lessons

Technical gotchas worth remembering on this project.

## Soroban: do not depend on another contract crate for its client

Depending on a sibling contract crate (for example `invoice_nft`) as a normal
`[dependencies]` entry links that contract's exported WASM symbols (`init`, etc)
into the dependent contract, causing "symbol multiply defined" at `stellar
contract build`. Fix: declare a minimal cross contract client locally with
`#[contractclient(name = "...")]`, and keep the real contract crate only as a
`[dev-dependencies]` entry for tests.

## Soroban: pin ed25519-dalek to the 2.x line

A fresh resolve pulled `ed25519-dalek 3.0.0`, which breaks `soroban-env-host
22.1.3` (`ChaCha20Rng: CryptoRng` not satisfied). Fix: `cargo update -p
ed25519-dalek@3.0.0 --precise 2.2.0` and commit `contracts/Cargo.lock` so the
pin persists. The lockfile is un ignored for the contracts workspace only.

## Prisma: generate migrations offline

Without a running database, create the committed migration with
`prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma
--script > migrations/0_init/migration.sql`. Since no environment had applied
migrations yet, regenerating the single init migration after a schema change was
cleaner than diffing against a shadow database.

## Contract helpers inside #[contractimpl]

A helper method with `&Env` inside `#[contractimpl]` gets exported by the macro
and fails. Move shared helpers to free functions outside the impl block.

## Swagger in production build

Do not set `removeComments` in tsconfig. swagger-jsdoc parses the `@openapi`
JSDoc from the compiled `dist/routes/*.js`, so the comments must survive the
build. The glob covers both `.ts` and `.js` so docs work in dev and prod.
