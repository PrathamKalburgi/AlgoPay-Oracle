/**
 * @algopayoracle/oracle-sdk — TypeScript Definitions
 * APC-1 · Ed25519 · Algorand
 */

// ─── Core types ───────────────────────────────────────────────────────────────

/** Normalized payment event — the single shape consumed by AlgoPayClient */
export interface PaymentEvent {
  /** Provider-issued payment reference (e.g. "pay_XXXXXXX") */
  payment_id: string;
  /** Integer fiat amount in base currency units (e.g. 100 for ₹100) */
  amount: number;
  /** ISO 4217 currency code (default: "INR") */
  currency?: string;
  /** Intended Web3 action (default: "unlock") */
  action?: string;
  /** Payment rail label — enables cross-provider replay protection (default: "unknown") */
  provider?: string;
}

/** Internal signed proof — output of OracleSigner.sign() */
export interface SignedProof {
  /** Original provider-issued ID (display only) */
  payment_id: string;
  /** Namespaced replay key: "provider:payment_id" — what was signed and stored on-chain */
  canonical_id: string;
  provider: string;
  amount: number;
  action: string;
  currency: string;
  /** Unix seconds when proof was signed (backdated ~30s for network latency) */
  timestamp: number;
  /** The Algorand Application ID this proof is locked to (0 for anchor mode) */
  app_id: number;
  /** Algorand address of the signing oracle */
  oracle_address: string;
  /** Base64 Ed25519 signature */
  signature: string;
}

/** APC-1 (AlgoPay Credential v1) — standardized portable payment proof */
export interface APC1Proof {
  /** Format version — always "1" */
  apc: "1";
  payment_id: string;
  /** canonical_id is the on-chain replay key — must be present for verification */
  canonical_id: string;
  amount: number;
  currency: string;
  action: string;
  timestamp: number;
  oracle_address: string;
  signature: string;
  chain: "algorand";
  network: "localnet" | "testnet" | "mainnet";
  app_id: number | null;
  provider: string;
}

/** Result of AlgoPayClient.verifyAndCommit() */
export interface CommitResult {
  /** Confirmed Algorand transaction ID */
  txId: string;
  /** Internal signed proof */
  proof: SignedProof;
  /** APC-1 standardized credential */
  apc1: APC1Proof;
  /** Lora explorer link */
  explorerUrl: string;
  /** Relative URL for your backend's /verify-proof endpoint */
  verifyUrl: string;
  /** Access window in seconds (default: 300) */
  access_seconds: number;
}

/** Result of proof verification */
export interface VerifyResult {
  valid: boolean;
  /** Human-readable reason when valid is false */
  reason?: string;
  proof?: SignedProof;
  txId?: string;
}

/** Options for proof verification */
export interface VerifyOptions {
  /** Only accept proofs signed by this oracle address */
  expectedOracleAddress?: string;
  /** Only accept proofs with this action */
  expectedAction?: string;
  /** Maximum proof age in seconds (default: 300) */
  maxAgeSecs?: number;
}

// ─── PaymentAdapter interface ─────────────────────────────────────────────────
//
// The adapter contract: any object implementing PaymentAdapter can be used
// to normalize gateway-specific webhooks into AlgoPay PaymentEvents.
//
// Implementing a custom adapter (e.g. PayU, CCAvenue, PhonePe):
//
//   class PayUAdapter implements PaymentAdapter {
//     parseWebhook(rawBody: Buffer, signature: string): PaymentEvent | null {
//       if (!this.verifyChecksum(rawBody, signature)) return null;
//       const body = JSON.parse(rawBody.toString());
//       return {
//         payment_id: body.mihpayid,
//         amount:     Math.round(Number(body.amount)),
//         currency:   "INR",
//         action:     "unlock",
//         provider:   "payu",
//       };
//     }
//   }

export interface PaymentAdapter {
  /**
   * Parse and verify a gateway webhook event.
   * Returns null on invalid signature or non-payment events.
   * Never throws — invalid input returns null.
   */
  parseWebhook(rawBody: Buffer | string, signature: string): PaymentEvent | null;
}

// ─── AlgoPayClient ────────────────────────────────────────────────────────────

export interface AlgoPayClientOptions {
  /** 25-word Algorand mnemonic for the oracle signing account */
  mnemonic: string;
  /** Algorand network (default: "testnet") */
  network?: "localnet" | "testnet" | "mainnet";
  /** Deployed AlgoPayOracle App ID. Omit to run in anchor mode. */
  appId?: number | null;
  /** Custom algod client (overrides network) */
  algod?: unknown;
  /** Custom indexer client */
  indexer?: unknown;
  /** Custom explorer base URL */
  explorerBase?: string;
}

export declare class AlgoPayClient {
  readonly network: string;
  readonly appId: number | null;

  constructor(options: AlgoPayClientOptions);

  /** Sign and commit a payment to Algorand. Primary entry point. */
  verifyAndCommit(payment: PaymentEvent): Promise<CommitResult>;

  /** Verify a proof by txId (indexer lookup) */
  verifyProof(txId: string, opts?: VerifyOptions): Promise<VerifyResult>;

  /** Verify a proof off-chain (no network) */
  verifyProofOffchain(proof: SignedProof, opts?: VerifyOptions): VerifyResult;

  /** Register a new oracle (creator only) */
  addOracle(addressOrBase64: string): Promise<string>;

  /** Deregister an oracle (creator only) */
  removeOracle(addressOrBase64: string): Promise<string>;

  /** Check if an oracle is registered in the contract */
  isOracleRegistered(addressOrBase64: string): Promise<boolean>;

  /** Total verified payments from the contract */
  getTotalVerified(): Promise<number>;

  /** Number of registered oracles */
  getOracleCount(): Promise<number>;

  getAddress(): string;
  getPublicKeyBase64(): string;
  getPublicKeyBytes(): Uint8Array;
  getExplorerUrl(txId: string): string;
}

// ─── OracleSigner ─────────────────────────────────────────────────────────────

export interface SignOptions {
  payment_id: string;
  amount: number;
  action?: string;
  currency?: string;
  provider?: string;
}

export declare class OracleSigner {
  readonly address: string;

  constructor(mnemonic: string);

  /** Sign a payment proof */
  sign(options: SignOptions, appId?: number): SignedProof;

  /** Build raw message bytes (must match contract verify_payment exactly) */
  static buildMessage(
    canonical_id: string,
    action: string,
    currency: string,
    amount: number,
    timestamp: number,
    appId?: number
  ): Uint8Array;

  /** Verify a proof's signature off-chain */
  static verifyOffchain(proof: SignedProof): boolean;

  /** Base64 public key — paste into contract create() call */
  getPublicKeyBase64(): string;
  getPublicKeyBytes(): Uint8Array;
  getAddress(): string;
}

// ─── ProofVerifier ────────────────────────────────────────────────────────────

export interface ProofVerifierOptions {
  indexer?: unknown;
  network?: string;
}

export declare class ProofVerifier {
  constructor(options?: ProofVerifierOptions);

  verifyOffchain(proof: SignedProof | APC1Proof, opts?: VerifyOptions): VerifyResult;
  verifyTxn(txId: string, opts?: VerifyOptions): Promise<VerifyResult>;
  verifyBatch(txIds: string[], opts?: VerifyOptions): Promise<VerifyResult[]>;
}

// ─── Adapters ─────────────────────────────────────────────────────────────────

export interface OrderRecord {
  amount: number;
  currency: string;
}

export interface OrderStore {
  set(id: string, data: OrderRecord): Promise<void>;
  get(id: string): Promise<OrderRecord | null>;
  consume(id: string): Promise<OrderRecord | null>;
  delete(id: string): Promise<void>;
  size?(): number;
  destroy?(): void;
}

export interface RazorpayAdapterOptions {
  keySecret: string;
  keyId?: string;
  orderStore?: OrderStore;
  defaultAction?: string;
}

export interface RazorpayClientPaymentInput {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  action?: string;
}

export declare class RazorpayAdapter implements PaymentAdapter {
  constructor(options: RazorpayAdapterOptions);

  parseWebhook(rawBody: Buffer | string, signature: string): PaymentEvent | null;
  parseClientPayment(input: RazorpayClientPaymentInput): Promise<PaymentEvent>;
  createOrder(opts: { amount: number; currency?: string }): Promise<{ order_id: string; amount: number; currency: string; key_id: string }>;
}

export interface StripeAdapterOptions {
  webhookSecret: string;
  secretKey?: string;
  defaultAction?: string;
}

export declare class StripeAdapter implements PaymentAdapter {
  constructor(options: StripeAdapterOptions);
  parseWebhook(rawBody: Buffer, signature: string): PaymentEvent | null;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

export interface NetworkConfig {
  algodToken: string;
  algodServer: string;
  algodPort: number;
  indexerToken: string;
  indexerServer: string;
  indexerPort: number;
  explorerBase: string;
}

export declare const NETWORKS: Record<"localnet" | "testnet" | "mainnet", NetworkConfig>;

export declare function createClients(network: "localnet" | "testnet" | "mainnet"): {
  algod: unknown;
  indexer: unknown;
  config: NetworkConfig;
};

export interface CustomClientOptions {
  algodUrl: string;
  algodToken?: string;
  indexerUrl: string;
  indexerToken?: string;
  explorerBase?: string;
}

export declare function createCustomClients(opts: CustomClientOptions): {
  algod: unknown;
  indexer: unknown;
  config: { explorerBase: string };
};

export declare const APC_VERSION: "1";
export declare function toAPC1(proof: SignedProof, meta?: { network?: string; appId?: number | null; provider?: string }): APC1Proof;
export declare function validateAPC1Structure(cred: unknown): { valid: boolean; errors: string[] };
export declare function isSupportedVersion(cred: unknown): boolean;
export declare function isExpired(cred: { timestamp: number }, maxAgeSecs?: number): boolean;

export declare function validatePaymentEvent(input: unknown): PaymentEvent;
export declare function validateProofFields(proof: unknown): void;

// ─── Logger ───────────────────────────────────────────────────────────────────

export interface Logger {
  info(msg: string, fields?: Record<string, unknown>): void;
  warn(msg: string, fields?: Record<string, unknown>): void;
  error(msg: string, fields?: Record<string, unknown>): void;
  debug(msg: string, fields?: Record<string, unknown>): void;
  child(fields: Record<string, unknown>): Logger;
}

export declare function createLogger(component: string): Logger;
export declare function requestLogger(req: unknown, res: unknown, next: () => void): void;

// ─── Order store ──────────────────────────────────────────────────────────────

export declare class InMemoryOrderStore implements OrderStore {
  constructor(ttlMs?: number);
  set(id: string, data: OrderRecord): Promise<void>;
  get(id: string): Promise<OrderRecord | null>;
  consume(id: string): Promise<OrderRecord | null>;
  delete(id: string): Promise<void>;
  size(): number;
  destroy(): void;
}

export declare function createOrderStore(options?: { ttlMs?: number }): InMemoryOrderStore;

// ─── Error classes ────────────────────────────────────────────────────────────

export declare class AlgoPayError extends Error {
  code: string;
}
export declare class InsufficientAmountError extends AlgoPayError {
  amount: number;
  minAmount: number;
}
export declare class ProofExpiredError extends AlgoPayError {
  timestamp: number;
  age: number;
}
export declare class OracleNotRegisteredError extends AlgoPayError {
  address: string;
}
export declare class ReplayError extends AlgoPayError {
  paymentId: string;
}
export declare class InvalidSignatureError extends AlgoPayError {}
export declare class ConfigError extends AlgoPayError {}
export declare class ProviderAuthError extends AlgoPayError {
  provider: string;
}
