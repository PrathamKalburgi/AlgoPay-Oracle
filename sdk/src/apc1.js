/**
 * AlgoPay Credential Standard v1 (APC-1)
 *
 * APC-1 is the standardized proof format produced by AlgoPay Oracle.
 * It is provider-agnostic: the same credential format is produced regardless
 * of whether the payment came from Razorpay, Stripe, UPI, or any other gateway.
 *
 * canonical_id is the replay key used on-chain (provider:payment_id).
 * It must appear in the credential so verifiers can reconstruct the signed message.
 *
 * Schema (v1):
 *   apc            "1"                    — format version
 *   payment_id     string                 — original provider-issued ID (display only)
 *   canonical_id   string                 — namespaced replay key: "provider:payment_id"
 *   amount         integer                — fiat amount in currency base units
 *   currency       string                 — ISO 4217 (INR, USD, EUR...)
 *   action         string                 — intended Web3 action
 *   timestamp      integer                — unix seconds when oracle signed
 *   oracle_address string                 — Algorand address of signing oracle
 *   signature      string                 — base64 Ed25519 signature over canonical message
 *   chain          "algorand"
 *   network        "localnet"|"testnet"|"mainnet"
 *   app_id         integer|null           — deployed AlgoPayOracle App ID
 *   provider       string                 — payment rail label
 */

"use strict";

const APC_VERSION   = "1";
const SUPPORTED_APC = new Set(["1"]);

/**
 * Wrap an internal signed proof as an APC-1 credential.
 * canonical_id is always included — it is the on-chain replay key.
 *
 * @param {object} proof - output of OracleSigner.sign()
 * @param {object} [meta] - { network, appId, provider }
 * @returns {object} APC-1 credential
 */
function toAPC1(proof, { network = "testnet", appId = null, provider } = {}) {
  return {
    apc:            APC_VERSION,
    payment_id:     proof.payment_id,
    canonical_id:   proof.canonical_id,   // the signed replay key — MUST be present
    amount:         proof.amount,
    currency:       proof.currency,
    action:         proof.action,
    timestamp:      proof.timestamp,
    oracle_address: proof.oracle_address,
    signature:      proof.signature,
    chain:          "algorand",
    network,
    app_id:         appId ?? null,
    provider:       provider ?? proof.provider ?? "unknown",
  };
}

/**
 * Validate APC-1 credential structure and field types.
 * Does NOT verify the cryptographic signature — use ProofVerifier for that.
 *
 * @param {object} cred
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateAPC1Structure(cred) {
  const errors = [];

  if (!SUPPORTED_APC.has(String(cred.apc)))         errors.push(`unsupported apc version: "${cred.apc}" (supported: ${[...SUPPORTED_APC].join(", ")})`);
  if (!cred.payment_id || typeof cred.payment_id !== "string")
                                                     errors.push("payment_id must be a non-empty string");
  if (!cred.canonical_id || typeof cred.canonical_id !== "string")
                                                     errors.push("canonical_id must be a non-empty string");
  if (!Number.isInteger(cred.amount) || cred.amount <= 0)
                                                     errors.push("amount must be a positive integer");
  if (typeof cred.currency !== "string" || cred.currency.length !== 3)
                                                     errors.push("currency must be a 3-character ISO code");
  if (!cred.action || typeof cred.action !== "string")
                                                     errors.push("action must be a non-empty string");
  if (!Number.isInteger(cred.timestamp))             errors.push("timestamp must be an integer");
  if (typeof cred.oracle_address !== "string" || cred.oracle_address.length !== 58)
                                                     errors.push("oracle_address must be a valid Algorand address (58 chars)");
  if (!cred.signature || typeof cred.signature !== "string")
                                                     errors.push("signature must be a base64 string");
  if (cred.chain !== "algorand")                     errors.push("chain must be 'algorand'");
  if (!["localnet", "testnet", "mainnet"].includes(cred.network))
                                                     errors.push("network must be localnet, testnet, or mainnet");

  return { valid: errors.length === 0, errors };
}

/**
 * Check if a verifier supports this APC-1 version.
 * Allows callers to gate on version before attempting verification.
 *
 * @param {object} cred
 * @returns {boolean}
 */
function isSupportedVersion(cred) {
  return SUPPORTED_APC.has(String(cred?.apc));
}

/**
 * Check if an APC-1 proof is expired.
 * @param {object} cred
 * @param {number} [maxAgeSecs] - default 300 (5 min)
 */
function isExpired(cred, maxAgeSecs = 300) {
  const now = Math.floor(Date.now() / 1000);
  return now - cred.timestamp > maxAgeSecs;
}

module.exports = { APC_VERSION, SUPPORTED_APC, toAPC1, validateAPC1Structure, isSupportedVersion, isExpired };
