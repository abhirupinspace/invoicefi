import {
  Address,
  BASE_FEE,
  Contract,
  Keypair,
  nativeToScVal,
  rpc,
  scValToNative,
  TransactionBuilder,
  xdr,
} from '@stellar/stellar-sdk';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { ServiceUnavailableError } from '../utils/appError';

// Isolates every Stellar and Soroban interaction. Business services depend on
// this interface only, never on the SDK directly.
//
// MVP custodial model: a single platform account signs and holds custody of all
// invoice NFTs and payment balances on chain. The database is the source of
// truth for which user owns what. Production would replace this with per user
// wallets and SEP 10 authenticated transactions.

export interface MintParams {
  invoiceId: string;
  faceValue: bigint;
  dueDate: number;
  verified: boolean;
  hash: Buffer;
}

export interface ListParams {
  tokenId: string;
  price: bigint;
}

export interface BuyParams {
  listingId: string;
}

export interface SettleParams {
  tokenId: string;
  amount: bigint;
}

export interface ChainResult {
  dryRun: boolean;
  txHash?: string;
  value?: string;
}

export class BlockchainService {
  private readonly dryRun: boolean;
  private readonly server?: rpc.Server;
  private readonly keypair?: Keypair;
  private dryRunCounter = 0;

  constructor() {
    this.dryRun = !env.chainConfigured;
    if (!this.dryRun) {
      this.server = new rpc.Server(env.SOROBAN_RPC, {
        allowHttp: env.SOROBAN_RPC.startsWith('http://'),
      });
      this.keypair = Keypair.fromSecret(env.STELLAR_PLATFORM_SECRET);
    } else {
      logger.warn(
        'Blockchain service running in dry run mode; set STELLAR_PLATFORM_SECRET and contract ids to enable on chain calls',
      );
    }
  }

  get platformAddress(): string {
    return this.keypair?.publicKey() ?? 'GDRYRUN000000000000000000000000000000000000000000000000';
  }

  // Mints an invoice NFT owned by the custodial platform account.
  async mintInvoice(params: MintParams): Promise<ChainResult> {
    if (this.dryRun) return this.synthetic();
    const seller = new Address(this.platformAddress);
    const value = await this.invoke(env.INVOICE_NFT_CONTRACT, 'mint', [
      nativeToScVal(params.invoiceId, { type: 'string' }),
      seller.toScVal(),
      nativeToScVal(params.faceValue, { type: 'i128' }),
      nativeToScVal(params.dueDate, { type: 'u64' }),
      nativeToScVal(params.verified, { type: 'bool' }),
      xdr.ScVal.scvBytes(params.hash),
    ]);
    return value;
  }

  // Lists a token on the marketplace, escrowing it in the contract.
  async listInvoice(params: ListParams): Promise<ChainResult> {
    if (this.dryRun) return this.synthetic();
    const seller = new Address(this.platformAddress);
    return this.invoke(env.MARKETPLACE_CONTRACT, 'list', [
      seller.toScVal(),
      nativeToScVal(BigInt(params.tokenId), { type: 'u64' }),
      nativeToScVal(params.price, { type: 'i128' }),
    ]);
  }

  // Buys a listed token. Payment and ownership move atomically on chain.
  async buyInvoice(params: BuyParams): Promise<ChainResult> {
    if (this.dryRun) return this.synthetic();
    const buyer = new Address(this.platformAddress);
    return this.invoke(env.MARKETPLACE_CONTRACT, 'buy', [
      buyer.toScVal(),
      nativeToScVal(BigInt(params.listingId), { type: 'u64' }),
    ]);
  }

  // Cancels a listing, returning the escrowed token to the seller.
  async cancelListing(listingId: string): Promise<ChainResult> {
    if (this.dryRun) return this.synthetic();
    const seller = new Address(this.platformAddress);
    return this.invoke(env.MARKETPLACE_CONTRACT, 'cancel', [
      seller.toScVal(),
      nativeToScVal(BigInt(listingId), { type: 'u64' }),
    ]);
  }

  // Settles a financed invoice: pays the investor and burns the NFT.
  async settleInvoice(params: SettleParams): Promise<ChainResult> {
    if (this.dryRun) return this.synthetic();
    const account = new Address(this.platformAddress);
    return this.invoke(env.SETTLEMENT_CONTRACT, 'settle', [
      nativeToScVal(BigInt(params.tokenId), { type: 'u64' }),
      account.toScVal(),
      account.toScVal(),
      nativeToScVal(params.amount, { type: 'i128' }),
    ]);
  }

  // Transfers NFT ownership between two custodial positions.
  async transferOwnership(tokenId: string, to: string): Promise<ChainResult> {
    if (this.dryRun) return this.synthetic();
    const from = new Address(this.platformAddress);
    return this.invoke(env.INVOICE_NFT_CONTRACT, 'transfer', [
      from.toScVal(),
      new Address(to).toScVal(),
      nativeToScVal(BigInt(tokenId), { type: 'u64' }),
    ]);
  }

  // Low level contract invocation: build, simulate, sign, send, and poll.
  private async invoke(
    contractId: string,
    method: string,
    args: xdr.ScVal[],
  ): Promise<ChainResult> {
    if (!this.server || !this.keypair) {
      throw new ServiceUnavailableError('Blockchain is not configured');
    }
    const contract = new Contract(contractId);
    const source = await this.server.getAccount(this.keypair.publicKey());

    const built = new TransactionBuilder(source, {
      fee: BASE_FEE,
      networkPassphrase: env.STELLAR_NETWORK_PASSPHRASE,
    })
      .addOperation(contract.call(method, ...args))
      .setTimeout(60)
      .build();

    const simulation = await this.server.simulateTransaction(built);
    if (rpc.Api.isSimulationError(simulation)) {
      throw new ServiceUnavailableError(
        `Contract simulation failed: ${simulation.error}`,
      );
    }

    const prepared = rpc.assembleTransaction(built, simulation).build();
    prepared.sign(this.keypair);

    const sent = await this.server.sendTransaction(prepared);
    if (String(sent.status) === 'ERROR') {
      throw new ServiceUnavailableError('Transaction submission failed');
    }

    const result = await this.waitForTransaction(sent.hash);
    let value: string | undefined;
    if (result.returnValue) {
      try {
        value = String(scValToNative(result.returnValue));
      } catch {
        value = undefined;
      }
    }
    return { dryRun: false, txHash: sent.hash, value };
  }

  private async waitForTransaction(
    hash: string,
  ): Promise<rpc.Api.GetSuccessfulTransactionResponse> {
    if (!this.server) throw new ServiceUnavailableError('Blockchain not configured');
    const maxAttempts = 30;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const response = await this.server.getTransaction(hash);
      if (String(response.status) === 'SUCCESS') {
        return response as rpc.Api.GetSuccessfulTransactionResponse;
      }
      if (String(response.status) === 'FAILED') {
        throw new ServiceUnavailableError('Transaction failed on chain');
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    throw new ServiceUnavailableError('Timed out waiting for transaction');
  }

  // Produces a deterministic synthetic result for dry run mode so the backend
  // flow works end to end without a deployed contract.
  private synthetic(): ChainResult {
    this.dryRunCounter += 1;
    return {
      dryRun: true,
      txHash: `dryrun-${Date.now()}-${this.dryRunCounter}`,
      value: String(this.dryRunCounter),
    };
  }
}

export const blockchainService = new BlockchainService();
