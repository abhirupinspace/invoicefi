#![cfg(test)]

use super::*;
use invoice_nft::{InvoiceNft, InvoiceNftClient};
use soroban_sdk::{
    testutils::Address as _, token, Address, BytesN, Env, String,
};

struct Harness<'a> {
    env: Env,
    market: MarketplaceClient<'a>,
    nft: InvoiceNftClient<'a>,
    pay: token::Client<'a>,
    pay_admin: token::StellarAssetClient<'a>,
    admin: Address,
}

fn setup<'a>() -> Harness<'a> {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);

    // Invoice NFT.
    let nft_id = env.register(InvoiceNft, ());
    let nft = InvoiceNftClient::new(&env, &nft_id);
    nft.init(&admin);

    // Payment token (a Stellar Asset Contract).
    let sac = env.register_stellar_asset_contract_v2(admin.clone());
    let pay = token::Client::new(&env, &sac.address());
    let pay_admin = token::StellarAssetClient::new(&env, &sac.address());

    // Marketplace.
    let market_id = env.register(Marketplace, ());
    let market = MarketplaceClient::new(&env, &market_id);
    market.init(&admin, &nft_id, &sac.address());

    Harness { env, market, nft, pay, pay_admin, admin }
}

fn mint_to(h: &Harness, seller: &Address) -> u64 {
    h.nft.mint(
        &String::from_str(&h.env, "INV-M1"),
        seller,
        &10_000i128,
        &1_800_000_000u64,
        &true,
        &BytesN::from_array(&h.env, &[1u8; 32]),
    )
}

#[test]
fn list_escrows_the_nft() {
    let h = setup();
    let seller = Address::generate(&h.env);
    let token_id = mint_to(&h, &seller);

    let listing_id = h.market.list(&seller, &token_id, &9_600i128);
    assert_eq!(listing_id, 1);
    // The marketplace now holds the NFT.
    assert_eq!(h.nft.owner_of(&token_id), h.market.address);

    let listing = h.market.get_listing(&listing_id);
    assert_eq!(listing.price, 9_600);
    assert_eq!(listing.status, ListingStatus::Active);
}

#[test]
fn buy_transfers_payment_and_ownership_atomically() {
    let h = setup();
    let seller = Address::generate(&h.env);
    let buyer = Address::generate(&h.env);
    let token_id = mint_to(&h, &seller);
    h.pay_admin.mint(&buyer, &50_000i128);

    let listing_id = h.market.list(&seller, &token_id, &9_600i128);
    h.market.buy(&buyer, &listing_id);

    // Buyer owns the NFT, seller was paid, buyer was debited.
    assert_eq!(h.nft.owner_of(&token_id), buyer);
    assert_eq!(h.pay.balance(&seller), 9_600);
    assert_eq!(h.pay.balance(&buyer), 40_400);
    assert_eq!(h.market.get_listing(&listing_id).status, ListingStatus::Sold);
}

#[test]
fn cancel_returns_nft_to_seller() {
    let h = setup();
    let seller = Address::generate(&h.env);
    let token_id = mint_to(&h, &seller);

    let listing_id = h.market.list(&seller, &token_id, &9_600i128);
    h.market.cancel(&seller, &listing_id);

    assert_eq!(h.nft.owner_of(&token_id), seller);
    assert_eq!(h.market.get_listing(&listing_id).status, ListingStatus::Cancelled);
}

#[test]
#[should_panic]
fn buying_a_cancelled_listing_fails() {
    let h = setup();
    let seller = Address::generate(&h.env);
    let buyer = Address::generate(&h.env);
    let token_id = mint_to(&h, &seller);
    h.pay_admin.mint(&buyer, &50_000i128);

    let listing_id = h.market.list(&seller, &token_id, &9_600i128);
    h.market.cancel(&seller, &listing_id);
    h.market.buy(&buyer, &listing_id);
}

#[test]
fn get_listings_returns_all() {
    let h = setup();
    let seller = Address::generate(&h.env);
    let t1 = mint_to(&h, &seller);
    let t2 = h.nft.mint(
        &String::from_str(&h.env, "INV-M2"),
        &seller,
        &2_000i128,
        &1_800_000_000u64,
        &true,
        &BytesN::from_array(&h.env, &[2u8; 32]),
    );
    h.market.list(&seller, &t1, &9_600i128);
    h.market.list(&seller, &t2, &1_900i128);
    let _ = h.admin;
    assert_eq!(h.market.get_listings().len(), 2);
}
