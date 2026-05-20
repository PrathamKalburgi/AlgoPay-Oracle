/**
 * AlgoPay Oracle SDK — OracleSigner
 *
 * Pure Ed25519 signing — no network calls.
 * The credential layer is provider-agnostic: sign() accepts a PaymentEvent
 * from any adapter and produces an APC-1 compatible signed proof.
 *
 * Replay protection namespacing:
 *   On-chain box keys use `provider:payment_id` (canonical_id), not raw payment_id.
 *   This prevents cross-provider collisions where two providers issue the same ID.
 *   The contract only sees canonical_id — it does not know or care about providers.
 */

const algosdk = require("algosdk");
const { ConfigError, InsufficientAmountError } = require("./errors");
const { validatePaymentEvent } = require("./validate");

const PROOF_PREFIX = "AlgoPay:v1:";
const MIN_AMOUNT   = 100;

class OracleSigner {
  /** @param {string} mnemonic - 25-word Algorand mnemonic */
  constructor(mnemonic) {
    if (!mnemonic) throw new ConfigError("mnemonic is required");
    try {
      this.account = algosdk.mnemonicToSecretKey(mnemonic);
    } catch (e) {
      throw new ConfigError(`Invalid mnemonic: ${e.message}`);
    }
    this.address = this.account.addr.toString();
  }

  /**
   * Sign a payment proof.
   *
   * @param {object} payload
   * @param {string} payload.payment_id  - provider-issued payment reference
   * @param {number} payload.amount      - integer fiat amount (e.g. 100 for ₹100)
   * @param {string} [payload.action]    - intended Web3 action (default: "unlock")
   * @param {string} [payload.currency]  - ISO 4217 (default: "INR")
   * @param {string} [payload.provider]  - payment provider label (default: "unknown")
   * @returns {object} signed proof — pass directly to AlgoPayClient._submitProof()
   */
  sign({ payment_id, amount, action = "unlock", currency = "INR", provider = "unknown"}, appId = 0) {
    // Delegate validation to validatePaymentEvent — consistent typed errors
    validatePaymentEvent({ payment_id, amount, action, currency, provider });

    // canonical_id = namespaced box key used on-chain for replay protection.
    // Prevents cross-provider replay: razorpay:pay_ABC != stripe:pay_ABC.
    // "unknown" provider falls back to raw payment_id (demo/manual mode).
    const canonical_id = provider !== "unknown"
      ? `${provider}:${payment_id}`
      : payment_id;

    const timestamp = Math.floor(Date.now() / 1000) - 30;  // backdate 30s — absorbs signing + tx propagation latency
    const message   = OracleSigner.buildMessage(canonical_id, action, currency, amount, timestamp, appId);
    const sigBytes  = algosdk.signBytes(message, this.account.sk);

    return {
      payment_id,      // original provider ID — for display and logging
      canonical_id,    // namespaced — used in signing and as on-chain box key
      provider,
      amount,
      action,
      currency:       currency.toUpperCase(),
      timestamp,
      app_id:         appId,
      oracle_address: this.address,
      signature:      Buffer.from(sigBytes).toString("base64"),
    };
  }

  /**
   * Build the raw message bytes for signing.
   *
   * Byte order (must match AlgoPayOracle.py verify_payment exactly):
   *   AlgoPay:v1: + canonical_id + action + currency + amount(8B BE) + timestamp(8B BE)
   *
   * algosdk.signBytes prepends "MX" before the Ed25519 operation.
   * The contract prepends "MX" manually before ed25519verify_bare.
   * So the effective signed bytes are: MX + the message below.
   *
   * @param {string} canonical_id - namespaced payment ID (provider:payment_id)
   * @param {string} action
   * @param {string} currency
   * @param {number} amount
   * @param {number} timestamp - unix seconds
   * @returns {Uint8Array}
   */
  static buildMessage(canonical_id, action, currency, amount, timestamp, appId = 0) {
    const enc   = new TextEncoder();
    const parts = [
      enc.encode(PROOF_PREFIX),
      enc.encode(canonical_id),
      enc.encode(action),
      enc.encode(currency.toUpperCase()),
      algosdk.encodeUint64(amount),
      algosdk.encodeUint64(timestamp),
      algosdk.encodeUint64(appId),
    ];
    const total = parts.reduce((s, p) => s + p.length, 0);
    const msg   = new Uint8Array(total);
    let off = 0;
    for (const p of parts) { msg.set(p, off); off += p.length; }
    return msg;
  }

  /**
   * Verify a proof's signature offline — no network, no indexer.
   * Uses canonical_id if present, falls back to payment_id for backward compat.
   *
   * @param {object} proof
   * @returns {boolean}
   */
  static verifyOffchain(proof) {
    try {
      const id      = proof.canonical_id || proof.payment_id;
      const message = OracleSigner.buildMessage(
        id, proof.action, proof.currency || "INR", proof.amount, proof.timestamp, proof.app_id || 0
      );
      const sigBytes = Buffer.from(proof.signature, "base64");
      return algosdk.verifyBytes(message, sigBytes, proof.oracle_address);
    } catch {
      return false;
    }
  }

  /** @returns {string} Base64 pubkey — paste into create() call at contract deploy */
  getPublicKeyBase64() {
    return Buffer.from(algosdk.decodeAddress(this.address).publicKey).toString("base64");
  }

  /** @returns {Uint8Array} Raw 32-byte Ed25519 public key */
  getPublicKeyBytes() {
    return algosdk.decodeAddress(this.address).publicKey;
  }

  /** @returns {string} Algorand address of this oracle */
  getAddress() { return this.address; }
}

module.exports = { OracleSigner };