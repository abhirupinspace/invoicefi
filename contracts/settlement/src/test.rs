#![cfg(test)]

use super::*;
use invoice_nft::{InvoiceNft, InvoiceNftClient};
use soroban_sdk::{testutils::Address as _, token, Address, BytesN, Env, String};

#[test]
fn settle_pays_investor_burns_nft_and_blocks_double_settle() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);

    // NFT contract, with the settlement contract set as burner.
    let nft_id = env.register(InvoiceNft, ());
    let nft = InvoiceNftClient::new(&env, &nft_id);
    nft.init(&admin);

    // Payment token.
    let sac = env.register_stellar_asset_contract_v2(admin.clone());
    let pay = token::Client::new(&env, &sac.address());
    let pay_admin = token::StellarAssetClient::new(&env, &sac.address());

    // Settlement contract.
    let settle_id = env.register(Settlement, ());
    let settlement = SettlementClient::new(&env, &settle_id);
    settlement.init(&admin, &nft_id, &sac.address());
    nft.set_burner(&settle_id);

    // A financed invoice: investor owns the NFT, the buyer will repay.
    let investor = Address::generate(&env);
    let buyer = Address::generate(&env);
    let token_id = nft.mint(
        &String::from_str(&env, "INV-S1"),
        &investor,
        &10_000i128,
        &1_800_000_000u64,
        &true,
        &BytesN::from_array(&env, &[9u8; 32]),
    );
    pay_admin.mint(&buyer, &10_000i128);

    settlement.settle(&token_id, &buyer, &investor, &10_000i128);

    assert_eq!(pay.balance(&investor), 10_000);
    assert!(!nft.exists(&token_id));
    assert!(settlement.is_settled(&token_id));
}

#[test]
#[should_panic]
fn double_settlement_reverts() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);

    let nft_id = env.register(InvoiceNft, ());
    let nft = InvoiceNftClient::new(&env, &nft_id);
    nft.init(&admin);

    let sac = env.register_stellar_asset_contract_v2(admin.clone());
    let pay_admin = token::StellarAssetClient::new(&env, &sac.address());

    let settle_id = env.register(Settlement, ());
    let settlement = SettlementClient::new(&env, &settle_id);
    settlement.init(&admin, &nft_id, &sac.address());
    nft.set_burner(&settle_id);

    let investor = Address::generate(&env);
    let buyer = Address::generate(&env);
    let token_id = nft.mint(
        &String::from_str(&env, "INV-S2"),
        &investor,
        &5_000i128,
        &1_800_000_000u64,
        &true,
        &BytesN::from_array(&env, &[3u8; 32]),
    );
    pay_admin.mint(&buyer, &10_000i128);

    settlement.settle(&token_id, &buyer, &investor, &5_000i128);
    // Second settlement must revert. The NFT is already burned and the token is
    // marked settled.
    settlement.settle(&token_id, &buyer, &investor, &5_000i128);
}
