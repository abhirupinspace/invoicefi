#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::Address as _, Address, BytesN, Env, String};

fn setup() -> (Env, InvoiceNftClient<'static>, Address) {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let contract_id = env.register(InvoiceNft, ());
    let client = InvoiceNftClient::new(&env, &contract_id);
    client.init(&admin);
    (env, client, admin)
}

fn sample_hash(env: &Env) -> BytesN<32> {
    BytesN::from_array(env, &[7u8; 32])
}

#[test]
fn mint_creates_owned_token_with_metadata() {
    let (env, client, _admin) = setup();
    let seller = Address::generate(&env);

    let token_id = client.mint(
        &String::from_str(&env, "INV-001"),
        &seller,
        &10_000i128,
        &1_800_000_000u64,
        &true,
        &sample_hash(&env),
    );

    assert_eq!(token_id, 1);
    assert_eq!(client.owner_of(&token_id), seller);
    let meta = client.metadata_of(&token_id);
    assert_eq!(meta.face_value, 10_000);
    assert_eq!(meta.verified, true);
    assert_eq!(client.total_minted(), 1);
    assert!(client.exists(&token_id));
}

#[test]
fn transfer_changes_owner() {
    let (env, client, _admin) = setup();
    let seller = Address::generate(&env);
    let buyer = Address::generate(&env);
    let token_id = client.mint(
        &String::from_str(&env, "INV-002"),
        &seller,
        &5_000i128,
        &1_800_000_000u64,
        &true,
        &sample_hash(&env),
    );

    client.transfer(&seller, &buyer, &token_id);
    assert_eq!(client.owner_of(&token_id), buyer);
}

#[test]
#[should_panic]
fn transfer_by_non_owner_fails() {
    let (env, client, _admin) = setup();
    let seller = Address::generate(&env);
    let other = Address::generate(&env);
    let token_id = client.mint(
        &String::from_str(&env, "INV-003"),
        &seller,
        &5_000i128,
        &1_800_000_000u64,
        &true,
        &sample_hash(&env),
    );
    // `other` does not own the token.
    client.transfer(&other, &other, &token_id);
}

#[test]
fn burn_removes_token() {
    let (env, client, _admin) = setup();
    let seller = Address::generate(&env);
    let token_id = client.mint(
        &String::from_str(&env, "INV-004"),
        &seller,
        &5_000i128,
        &1_800_000_000u64,
        &true,
        &sample_hash(&env),
    );

    client.burn(&token_id);
    assert!(!client.exists(&token_id));
}

#[test]
#[should_panic]
fn mint_with_invalid_face_value_fails() {
    let (env, client, _admin) = setup();
    let seller = Address::generate(&env);
    client.mint(
        &String::from_str(&env, "INV-005"),
        &seller,
        &0i128,
        &1_800_000_000u64,
        &true,
        &sample_hash(&env),
    );
}
