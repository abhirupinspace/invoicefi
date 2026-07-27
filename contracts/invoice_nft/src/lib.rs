#![no_std]

//! InvoiceNFT contract.
//!
//! A minimal non fungible token that represents a single verified invoice. Each
//! token carries the invoice face value, due date, verification flag, and a
//! SHA256 document hash. The platform (admin) mints tokens for verified
//! invoices. Ownership can be transferred, and tokens are burned on settlement.

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, Address, BytesN, Env,
    String, Symbol,
};

#[contracttype]
#[derive(Clone)]
pub struct InvoiceMeta {
    pub invoice_id: String,
    pub seller: Address,
    pub face_value: i128,
    pub due_date: u64,
    pub verified: bool,
    pub hash: BytesN<32>,
}

#[contracttype]
pub enum DataKey {
    Admin,
    Burner,
    Counter,
    Owner(u64),
    Meta(u64),
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    NotInitialized = 1,
    AlreadyInitialized = 2,
    TokenNotFound = 3,
    NotOwner = 4,
    InvalidFaceValue = 5,
}

const MINT: Symbol = symbol_short!("mint");
const TRANSFER: Symbol = symbol_short!("transfer");
const BURN: Symbol = symbol_short!("burn");

#[contract]
pub struct InvoiceNft;

#[contractimpl]
impl InvoiceNft {
    /// Sets the admin. Must be called once after deployment.
    pub fn init(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic_with(&env, Error::AlreadyInitialized);
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        // The burner defaults to the admin and is later pointed at the
        // settlement contract so it can burn tokens on settlement.
        env.storage().instance().set(&DataKey::Burner, &admin);
        env.storage().instance().set(&DataKey::Counter, &0u64);
    }

    /// Updates the address allowed to burn tokens. Admin only.
    pub fn set_burner(env: Env, burner: Address) {
        let admin = get_admin(&env);
        admin.require_auth();
        env.storage().instance().set(&DataKey::Burner, &burner);
    }

    /// Mints a new invoice token owned by `seller`. Only the admin may mint.
    pub fn mint(
        env: Env,
        invoice_id: String,
        seller: Address,
        face_value: i128,
        due_date: u64,
        verified: bool,
        hash: BytesN<32>,
    ) -> u64 {
        let admin = get_admin(&env);
        admin.require_auth();

        if face_value <= 0 {
            panic_with(&env, Error::InvalidFaceValue);
        }

        let mut counter: u64 = env
            .storage()
            .instance()
            .get(&DataKey::Counter)
            .unwrap_or(0);
        counter += 1;

        let meta = InvoiceMeta {
            invoice_id,
            seller: seller.clone(),
            face_value,
            due_date,
            verified,
            hash,
        };

        env.storage().persistent().set(&DataKey::Meta(counter), &meta);
        env.storage()
            .persistent()
            .set(&DataKey::Owner(counter), &seller);
        env.storage().instance().set(&DataKey::Counter, &counter);

        env.events().publish((MINT, seller), counter);
        counter
    }

    /// Returns the current owner of a token.
    pub fn owner_of(env: Env, token_id: u64) -> Address {
        env.storage()
            .persistent()
            .get(&DataKey::Owner(token_id))
            .unwrap_or_else(|| panic_with(&env, Error::TokenNotFound))
    }

    /// Returns the invoice metadata for a token.
    pub fn metadata_of(env: Env, token_id: u64) -> InvoiceMeta {
        env.storage()
            .persistent()
            .get(&DataKey::Meta(token_id))
            .unwrap_or_else(|| panic_with(&env, Error::TokenNotFound))
    }

    /// Whether a token exists.
    pub fn exists(env: Env, token_id: u64) -> bool {
        env.storage().persistent().has(&DataKey::Owner(token_id))
    }

    /// Transfers ownership. The current owner must authorize the call.
    pub fn transfer(env: Env, from: Address, to: Address, token_id: u64) {
        from.require_auth();
        let owner = Self::owner_of(env.clone(), token_id);
        if owner != from {
            panic_with(&env, Error::NotOwner);
        }
        env.storage()
            .persistent()
            .set(&DataKey::Owner(token_id), &to);
        env.events().publish((TRANSFER, from, to), token_id);
    }

    /// Burns a token. Only the burner (settlement contract) may burn.
    pub fn burn(env: Env, token_id: u64) {
        let burner: Address = env
            .storage()
            .instance()
            .get(&DataKey::Burner)
            .unwrap_or_else(|| panic_with(&env, Error::NotInitialized));
        burner.require_auth();
        if !env.storage().persistent().has(&DataKey::Owner(token_id)) {
            panic_with(&env, Error::TokenNotFound);
        }
        env.storage().persistent().remove(&DataKey::Owner(token_id));
        env.storage().persistent().remove(&DataKey::Meta(token_id));
        env.events().publish((BURN,), token_id);
    }

    /// Returns the admin address.
    pub fn get_admin(env: Env) -> Address {
        get_admin(&env)
    }

    /// Total number of tokens ever minted.
    pub fn total_minted(env: Env) -> u64 {
        env.storage()
            .instance()
            .get(&DataKey::Counter)
            .unwrap_or(0)
    }
}

fn get_admin(env: &Env) -> Address {
    env.storage()
        .instance()
        .get(&DataKey::Admin)
        .unwrap_or_else(|| panic_with(env, Error::NotInitialized))
}

fn panic_with(env: &Env, error: Error) -> ! {
    panic_with_error!(env, error)
}

use soroban_sdk::panic_with_error;

#[cfg(test)]
mod test;
