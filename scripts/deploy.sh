#!/usr/bin/env bash
#
# Deploys the InvoiceFi Soroban contracts and wires them together.
#
# Prerequisites:
#   - Stellar CLI installed and a funded identity created, for example:
#       stellar keys generate platform --network testnet --fund
#   - Run from the repository root.
#
# Usage:
#   DEPLOY_SOURCE=platform STELLAR_NETWORK=testnet ./scripts/deploy.sh
#
# On success it prints the contract ids to copy into your .env file.

set -euo pipefail

NETWORK="${STELLAR_NETWORK:-testnet}"
SOURCE="${DEPLOY_SOURCE:-platform}"
WASM_DIR="contracts/target/wasm32v1-none/release"

echo "Building contracts..."
( cd contracts && stellar contract build )

ADMIN="$(stellar keys address "$SOURCE")"
echo "Deployer (admin) address: $ADMIN"

echo "Deploying invoice_nft..."
NFT="$(stellar contract deploy --wasm "$WASM_DIR/invoice_nft.wasm" --source "$SOURCE" --network "$NETWORK")"

echo "Deploying marketplace..."
MARKET="$(stellar contract deploy --wasm "$WASM_DIR/marketplace.wasm" --source "$SOURCE" --network "$NETWORK")"

echo "Deploying settlement..."
SETTLE="$(stellar contract deploy --wasm "$WASM_DIR/settlement.wasm" --source "$SOURCE" --network "$NETWORK")"

# Resolve the payment token. Use PAY_TOKEN_CONTRACT if set, otherwise wrap the
# native XLM asset into a Stellar Asset Contract.
if [ -n "${PAY_TOKEN_CONTRACT:-}" ]; then
  PAY="$PAY_TOKEN_CONTRACT"
else
  echo "Resolving native asset contract..."
  PAY="$(stellar contract asset deploy --asset native --source "$SOURCE" --network "$NETWORK" 2>/dev/null \
    || stellar contract id asset --asset native --network "$NETWORK")"
fi
echo "Payment token: $PAY"

echo "Initializing contracts..."
stellar contract invoke --id "$NFT" --source "$SOURCE" --network "$NETWORK" -- init --admin "$ADMIN"
stellar contract invoke --id "$MARKET" --source "$SOURCE" --network "$NETWORK" -- init --admin "$ADMIN" --nft "$NFT" --pay_token "$PAY"
stellar contract invoke --id "$SETTLE" --source "$SOURCE" --network "$NETWORK" -- init --admin "$ADMIN" --nft "$NFT" --pay_token "$PAY"

echo "Pointing the NFT burner at the settlement contract..."
stellar contract invoke --id "$NFT" --source "$SOURCE" --network "$NETWORK" -- set_burner --burner "$SETTLE"

cat <<EOF

Deployment complete. Add these to your .env:

INVOICE_NFT_CONTRACT=$NFT
MARKETPLACE_CONTRACT=$MARKET
SETTLEMENT_CONTRACT=$SETTLE
PAY_TOKEN_CONTRACT=$PAY
STELLAR_PLATFORM_SECRET=<secret key of the '$SOURCE' identity>

EOF
