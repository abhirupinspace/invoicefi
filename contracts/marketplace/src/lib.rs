#![no_std]

//! Marketplace contract.
//!
//! Lets a verified invoice owner list their invoice NFT for sale and lets an
//! investor buy it. Listings are held in escrow: on `list` the NFT moves to the
//! marketplace, and on `buy` payment and the NFT change hands atomically inside
//! a single transaction, so a buyer can never pay without receiving the token.

use soroban_sdk::{
    contract, contractclient, contracterror, contractimpl, contracttype, panic_with_error,
    symbol_short, token, Address, Env, Symbol, Vec,
};

// Minimal client for the InvoiceNFT contract. Declared locally so the
// marketplace does not link the NFT contract implementation into its own WASM.
#[contractclient(name = "NftClient")]
pub trait NftInterface {
    fn transfer(env: Env, from: Address, to: Address, token_id: u64);
    fn owner_of(env: Env, token_id: u64) -> Address;
}

#[contracttype]
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum ListingStatus {
    Active = 0,
    Sold = 1,
    Cancelled = 2,
}

#[contracttype]
#[derive(Clone)]
pub struct Listing {
    pub id: u64,
    pub seller: Address,
    pub token_id: u64,
    pub price: i128,
    pub status: ListingStatus,
}

#[contracttype]
pub enum DataKey {
    Admin,
    Nft,
    PayToken,
    Counter,
    Listing(u64),
    Ids,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    NotInitialized = 1,
    AlreadyInitialized = 2,
    ListingNotFound = 3,
    ListingNotActive = 4,
    InvalidPrice = 5,
    NotSeller = 6,
}

const LIST: Symbol = symbol_short!("list");
const BUY: Symbol = symbol_short!("buy");
const CANCEL: Symbol = symbol_short!("cancel");

#[contract]
pub struct Marketplace;

#[contractimpl]
impl Marketplace {
    /// Configures the marketplace with the NFT and payment token contracts.
    pub fn init(env: Env, admin: Address, nft: Address, pay_token: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic_with_error!(&env, Error::AlreadyInitialized);
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Nft, &nft);
        env.storage().instance().set(&DataKey::PayToken, &pay_token);
        env.storage().instance().set(&DataKey::Counter, &0u64);
        env.storage().instance().set(&DataKey::Ids, &Vec::<u64>::new(&env));
    }

    /// Lists an invoice NFT for sale. The NFT is escrowed by the marketplace.
    pub fn list(env: Env, seller: Address, token_id: u64, price: i128) -> u64 {
        seller.require_auth();
        if price <= 0 {
            panic_with_error!(&env, Error::InvalidPrice);
        }

        // Move the token into escrow. The NFT contract verifies seller owns it.
        let nft = NftClient::new(&env, &Self::nft(&env));
        nft.transfer(&seller, &env.current_contract_address(), &token_id);

        let mut counter: u64 = env.storage().instance().get(&DataKey::Counter).unwrap_or(0);
        counter += 1;

        let listing = Listing {
            id: counter,
            seller: seller.clone(),
            token_id,
            price,
            status: ListingStatus::Active,
        };
        env.storage().persistent().set(&DataKey::Listing(counter), &listing);
        env.storage().instance().set(&DataKey::Counter, &counter);

        let mut ids: Vec<u64> = env.storage().instance().get(&DataKey::Ids).unwrap();
        ids.push_back(counter);
        env.storage().instance().set(&DataKey::Ids, &ids);

        env.events().publish((LIST, seller), (counter, token_id, price));
        counter
    }

    /// Buys a listed invoice NFT. Payment and ownership transfer atomically.
    pub fn buy(env: Env, buyer: Address, listing_id: u64) {
        buyer.require_auth();
        let mut listing = Self::require_listing(&env, listing_id);
        if listing.status != ListingStatus::Active {
            panic_with_error!(&env, Error::ListingNotActive);
        }

        // Pay the seller.
        let pay = token::Client::new(&env, &Self::pay_token(&env));
        pay.transfer(&buyer, &listing.seller, &listing.price);

        // Release the escrowed NFT to the buyer.
        let nft = NftClient::new(&env, &Self::nft(&env));
        nft.transfer(&env.current_contract_address(), &buyer, &listing.token_id);

        listing.status = ListingStatus::Sold;
        env.storage().persistent().set(&DataKey::Listing(listing_id), &listing);

        env.events().publish((BUY, buyer), (listing_id, listing.token_id, listing.price));
    }

    /// Cancels an active listing and returns the NFT to the seller.
    pub fn cancel(env: Env, seller: Address, listing_id: u64) {
        seller.require_auth();
        let mut listing = Self::require_listing(&env, listing_id);
        if listing.status != ListingStatus::Active {
            panic_with_error!(&env, Error::ListingNotActive);
        }
        if listing.seller != seller {
            panic_with_error!(&env, Error::NotSeller);
        }

        let nft = NftClient::new(&env, &Self::nft(&env));
        nft.transfer(&env.current_contract_address(), &seller, &listing.token_id);

        listing.status = ListingStatus::Cancelled;
        env.storage().persistent().set(&DataKey::Listing(listing_id), &listing);

        env.events().publish((CANCEL, seller), listing_id);
    }

    /// Returns a single listing.
    pub fn get_listing(env: Env, listing_id: u64) -> Listing {
        Self::require_listing(&env, listing_id)
    }

    /// Returns every listing ever created.
    pub fn get_listings(env: Env) -> Vec<Listing> {
        let ids: Vec<u64> = env.storage().instance().get(&DataKey::Ids).unwrap_or(Vec::new(&env));
        let mut out = Vec::new(&env);
        for id in ids.iter() {
            if let Some(listing) = env.storage().persistent().get::<DataKey, Listing>(&DataKey::Listing(id)) {
                out.push_back(listing);
            }
        }
        out
    }

    fn require_listing(env: &Env, listing_id: u64) -> Listing {
        env.storage()
            .persistent()
            .get(&DataKey::Listing(listing_id))
            .unwrap_or_else(|| panic_with_error!(env, Error::ListingNotFound))
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
