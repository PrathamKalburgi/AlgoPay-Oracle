/**
 * AlgoPay Oracle SDK — AlgoPayClient
 *
 * Main entry point. Wraps OracleSigner + Algorand submission + ProofVerifier.
 *
 * Design:
 *   - Provider-agnostic at the credential layer: verifyAndCommit() accepts a
 *     PaymentEvent from any adapter (Razorpay, Stripe, UPI, manual).
 *   - The payment rail (how money moved) is the adapter's concern.
 *   - The credential (proof of payment) is always APC-1.
 *   - One canonical proof path — no legacy branches, no format drift.
 *
 * Quick start:
 *   const client = new AlgoPayClient({
 *     mnemonic: process.env.ORACLE_MNEMONIC,
 *     network:  "testnet",
 *     appId:    Number(process.env.ALGO_APP_ID),
 *   });
 *
 *   const result = await client.verifyAndCommit({
 *     payment_id: "pay_XXXXXXX",
 *     amount:     100,
 *     action:     "unlock",
 *     provider:   "razorpay",   // optional — enables cross-provider replay protection
 *   });
 */

const algosdk      = require("algosdk");
const { OracleSigner }  = require("./OracleSigner");
const { ProofVerifier } = require("./ProofVerifier");
const { createClients } = require("./networks");
const { toAPC1 }        = require("./apc1");
const { ConfigError }   = require("./errors");

class AlgoPayClient {
  /**
   * @param {object} opts
   * @param {string}   opts.mnemonic          - 25-word oracle account mnemonic
   * @param {"localnet"|"testnet"|"mainnet"} [opts.network]
   * @param {number}   [opts.appId]           - deployed AlgoPayOracle App ID
   * @param {algosdk.Algodv2}  [opts.algod]   - custom algod (overrides network)
   * @param {algosdk.Indexer}  [opts.indexer] - custom indexer
   * @param {string}   [opts.explorerBase]    - custom explorer URL
   */
  constructor({ mnemonic, network = "testnet", appId = null, algod, indexer, explorerBase } = {}) {
    if (!mnemonic) throw new ConfigError("mnemonic is required");

    this.network = network;
    this.appId   = appId;
    this.signer  = new OracleSigner(mnemonic);

    if (algod && indexer) {
      this.algod        = algod;
      this.indexer      = indexer;
      this.explorerBase = explorerBase || "";
    } else {
      const clients     = createClients(network);
      this.algod        = clients.algod;
      this.indexer      = clients.indexer;
      this.explorerBase = explorerBase || clients.config.explorerBase;
    }

    this.verifier = new ProofVerifier({ indexer: this.indexer, network });
  }

  // ── Core API ──────────────────────────────────────────────────────────────

  /**
   * Sign a payment proof and commit it to Algorand.
   * This is the only method most integrations need.
   *
   * @param {object} payment
   * @param {string} payment.payment_id  - provider-issued payment reference
   * @param {number} payment.amount      - integer fiat amount
   * @param {string} [payment.action]    - "unlock" | "mint" | "vote" | any string
   * @param {string} [payment.currency]  - ISO 4217 (default: "INR")
   * @param {string} [payment.provider]  - payment rail label (enables namespaced replay protection)
   *
   * @returns {Promise<{
   *   txId:         string,   — confirmed Algorand transaction ID
   *   proof:        object,   — internal signed proof
   *   apc1:         object,   — APC-1 standardized credential
   *   explorerUrl:  string,
   *   verifyUrl:    string,
   *   access_seconds: number
   * }>}
   */
  async verifyAndCommit({ payment_id, amount, action = "unlock", currency = "INR", provider = "unknown" }) {
    const proof = this.signer.sign({ payment_id, amount, action, currency, provider }, this.appId || 0);
    const txId  = await this._submitProof(proof);

    return {
      txId,
      proof,
      apc1:           toAPC1(proof, { network: this.network, appId: this.appId, provider }),
      explorerUrl:    `${this.explorerBase}/transaction/${txId}`,
      verifyUrl:      `/verify-proof/${txId}`,
      access_seconds: 300,
    };
  }

  /**
   * Verify a proof by txId (indexer lookup).
   * @param {string} txId
   * @param {object} [opts]
   */
  async verifyProof(txId, opts = {}) {
    return this.verifier.verifyTxn(txId, opts);
  }

  /**
   * Verify a proof object offline (no network).
   * @param {object} proof
   * @param {object} [opts]
   */
  verifyProofOffchain(proof, opts = {}) {
    return this.verifier.verifyOffchain(proof, opts);
  }

  // ── Oracle rotation ───────────────────────────────────────────────────────

  /**
   * Register a new oracle in the contract. Creator-only.
   * @param {string} addressOrBase64 - Algorand address or base64 pubkey
   * @returns {Promise<string>} txId
   */
  async addOracle(addressOrBase64) {
    if (!this.appId) throw new ConfigError("appId required for oracle management");
    return this._oracleAdminCall("add_oracle", AlgoPayClient._toPubKeyBytes(addressOrBase64));
  }

  /**
   * Deregister an oracle. Creator-only. Cannot remove the last oracle.
   * @param {string} addressOrBase64
   * @returns {Promise<string>} txId
   */
  async removeOracle(addressOrBase64) {
    if (!this.appId) throw new ConfigError("appId required for oracle management");
    return this._oracleAdminCall("remove_oracle", AlgoPayClient._toPubKeyBytes(addressOrBase64));
  }

  /**
   * Check if an oracle pubkey is registered in the contract.
   * @param {string} addressOrBase64
   * @returns {Promise<boolean>}
   */
  async isOracleRegistered(addressOrBase64) {
    if (!this.appId) throw new ConfigError("appId required");
    const pubkey = AlgoPayClient._toPubKeyBytes(addressOrBase64);
    const params = await this.algod.getTransactionParams().do();
    const method = new algosdk.ABIMethod({
      name: "is_oracle", args: [{ name: "pubkey", type: "byte[]" }], returns: { type: "bool" },
    });
    const signer = algosdk.makeBasicAccountTransactionSigner(this.signer.account);
    const atc    = new algosdk.AtomicTransactionComposer();
    atc.addMethodCall({
      appID: this.appId, method,
      methodArgs: [Buffer.from(pubkey)],
      boxes:      [{ appIndex: 0, name: Buffer.from(pubkey) }],
      sender:     this.signer.address, suggestedParams: params, signer,
    });
    const result = await atc.simulate(this.algod);
    return result.methodResults[0].returnValue;
  }

// ── Contract stats ────────────────────────────────────────────────────────

  async getTotalVerified() {
    if (!this.appId) throw new ConfigError("appId required");
    const info  = await this.algod.getApplicationByID(this.appId).do();
    // FIX: Fallback to handle both algosdk v2 and v3 response structures
    const state = info.params["global-state"] || info.params.globalState || [];
    const entry = state.find(s => Buffer.from(s.key, "base64").toString() === "total_verified");
    return entry ? Number(entry.value.uint) : 0;
  }

  async getOracleCount() {
    if (!this.appId) throw new ConfigError("appId required");
    const info  = await this.algod.getApplicationByID(this.appId).do();
    // FIX: Fallback to handle both algosdk v2 and v3 response structures
    const state = info.params["global-state"] || info.params.globalState || [];
    const entry = state.find(s => Buffer.from(s.key, "base64").toString() === "oracle_count");
    return entry ? Number(entry.value.uint) : 0;
  }

  // ── Identity ──────────────────────────────────────────────────────────────

  getAddress()         { return this.signer.address; }
  getPublicKeyBase64() { return this.signer.getPublicKeyBase64(); }
  getPublicKeyBytes()  { return this.signer.getPublicKeyBytes(); }
  getExplorerUrl(txId) { return `${this.explorerBase}/transaction/${txId}`; }

  // ── Internal ──────────────────────────────────────────────────────────────

  async _submitProof(proof) {
    const params = await this.algod.getTransactionParams().do();
    params.flatFee = true;
    params.fee     = Math.max(Number(params.minFee ?? 1000), 1000) * 8;

    // proof JSON in note = the anchor. Indexer picks this up for verifyProof().
    const note = new TextEncoder().encode(JSON.stringify(proof));

    if (this.appId) {
      const oraclePubKeyBytes = this.signer.getPublicKeyBytes();

      const verifyMethod = new algosdk.ABIMethod({
        name: "verify_payment",
        args: [
          { name: "payment_id",    type: "string" },  
          { name: "action",        type: "string" },
          { name: "amount",        type: "uint64" },
          { name: "currency",      type: "string" },
          { name: "timestamp",     type: "uint64" },
	  { name: "app_id",        type: "uint64" },
          { name: "oracle_pubkey", type: "byte[]" },
          { name: "signature",     type: "byte[]" },
        ],
        returns: { type: "bool" },
      });

      const nopMethod = new algosdk.ABIMethod({
        name: "nop", args: [], returns: { type: "void" },
      });

      const signer = algosdk.makeBasicAccountTransactionSigner(this.signer.account);
      const atc    = new algosdk.AtomicTransactionComposer();

      for (let i = 1; i <= 3; i++) {
        atc.addMethodCall({
          appID: this.appId, method: nopMethod, methodArgs: [],
          sender: this.signer.address, suggestedParams: params,
          note: new TextEncoder().encode(`pad${i}`), signer,
        });
      }

      atc.addMethodCall({
        appID:      this.appId,
        method:     verifyMethod,
        methodArgs: [
          proof.canonical_id,                              // namespaced box key
          proof.action,
          proof.amount,
          proof.currency,
          proof.timestamp,
	  this.appId,
          Buffer.from(oraclePubKeyBytes),
          Buffer.from(proof.signature, "base64"),
        ],
        boxes: [
          { appIndex: 0, name: Buffer.from(oraclePubKeyBytes) },             // oracle registry
          { appIndex: 0, name: new TextEncoder().encode(proof.canonical_id) }, // replay lock
        ],
        sender: this.signer.address, suggestedParams: params, note, signer,
      });

      const result = await atc.execute(this.algod, 6);
      return result.txIDs[3];

    } else {
      // Anchor mode — 0-ALGO self-payment, proof JSON in note field
      const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        sender: this.signer.address, receiver: this.signer.address, amount: 0,
        note, suggestedParams: params,
      });
      const signed = txn.signTxn(this.signer.account.sk);
      const { txid } = await this.algod.sendRawTransaction(signed).do();
      await algosdk.waitForConfirmation(this.algod, txid, 6);
      return txid;
    }
  }

  async _oracleAdminCall(methodName, pubkeyBytes) {
    const params = await this.algod.getTransactionParams().do();
    params.flatFee = true;
    params.fee     = Math.max(Number(params.minFee ?? 1000), 1000) * 2;

    const method = new algosdk.ABIMethod({
      name: methodName, args: [{ name: "pubkey", type: "byte[]" }], returns: { type: "void" },
    });
    const signer = algosdk.makeBasicAccountTransactionSigner(this.signer.account);
    const atc    = new algosdk.AtomicTransactionComposer();
    atc.addMethodCall({
      appID: this.appId, method,
      methodArgs: [Buffer.from(pubkeyBytes)],
      boxes:      [{ appIndex: 0, name: Buffer.from(pubkeyBytes) }],
      sender: this.signer.address, suggestedParams: params, signer,
    });
    const result = await atc.execute(this.algod, 4);
    return result.txIDs[0];
  }

  static _toPubKeyBytes(addressOrBase64) {
    if (typeof addressOrBase64 === "string" && addressOrBase64.length === 58) {
      return algosdk.decodeAddress(addressOrBase64).publicKey;
    }
    return Buffer.from(addressOrBase64, "base64");
  }
}

module.exports = { AlgoPayClient };
