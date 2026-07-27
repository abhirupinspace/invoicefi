#![no_std]

//! Settlement contract.
//!
//! Closes the lifecycle of a financed invoice. When the invoice buyer repays,
//! the platform triggers `settle`, which atomically moves the repayment to the
//! current NFT owner (the investor), burns the invoice NFT, and records the
//! token as settled so it can never be settled twice.

use soroban_sdk::{
    contract, contractclient, contracterror, contractimpl, contracttype, panic_with_error,
    symbol_short, token, Address, Env, Symbol,
};

// Minimal client for the InvoiceNFT contract, declared locally so the
// settlement WASM does not link the NFT contract implementation.
#[contractclient(name = "NftClient")]
pub trait NftInterface {
    fn burn(env: Env, token_id: u64);
}

#[contracttype]
pub enum DataKey {
    Admin,
    Nft,
    PayToken,
    Settled(u64),
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    NotInitialized = 1,
    AlreadyInitialized = 2,
    AlreadySettled = 3,
    InvalidAmount = 4,
}

const SETTLE: Symbol = symbol_short!("settle");

#[contract]
pub struct Settlement;

#[contractimpl]
impl Settlement {
    /// Configures the settlement contract with the NFT and payment token.
    pub fn init(env: Env, admin: Address, nft: Address, pay_token: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic_with_error!(&env, Error::AlreadyInitialized);
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Nft, &nft);
        env.storage().instance().set(&DataKey::PayToken, &pay_token);
    }

    /// Settles a financed invoice. Performs mark paid, release funds, burn, and
    /// close as one atomic operation. `payer` repays `amount` to `investor`
    /// (the current NFT owner), then the NFT is burned. Reverts if the token was
    /// already settled.
    pub fn settle(
        env: Env,
        token_id: u64,
        payer: Address,
        investor: Address,
        amount: i128,
    ) {
        let admin = Self::admin(&env);
        admin.require_auth();

        if Self::is_settled(env.clone(), token_id) {
            panic_with_error!(&env, Error::AlreadySettled);
        }
        if amount <= 0 {
            panic_with_error!(&env, Error::InvalidAmount);
        }

        // The repayer authorizes moving funds to the investor.
        payer.require_auth();
        let pay = token::Client::new(&env, &Self::pay_token(&env));
        pay.transfer(&payer, &investor, &amount);

        // Burn the invoice NFT. This contract must be set as the NFT burner.
        let nft = NftClient::new(&env, &Self::nft(&env));
        nft.burn(&token_id);

        env.storage().persistent().set(&DataKey::Settled(token_id), &true);
        env.events().publish((SETTLE, investor), (token_id, amount));
    }

    /// Whether a token has already been settled.
    pub fn is_settled(env: Env, token_id: u64) -> bool {
        env.storage()
            .persistent()
            .get(&DataKey::Settled(token_id))
            .unwrap_or(false)
    }

    fn admin(env: &Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::Admin)
            .unwrap_or_else(|| panic_with_error!(env, Error::NotInitialized))
    }

    fn nft(env: &Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::Nft)
            .unwrap_or_else(|| panic_with_error!(env, Error::NotInitialized))
    }

    fn pay_token(env: &Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::PayToken)
            .unwrap_or_else(|| panic_with_error!(env, Error::NotInitialized))
    }
}

#[cfg(test)]
mod test;
