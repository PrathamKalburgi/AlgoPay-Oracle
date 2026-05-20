/**
 * AlgoPay Oracle SDK — ProofVerifier
 *
 * Verifies APC-1 proofs both off-chain (Ed25519 sig check) and
 * on-chain (Algorand indexer transaction lookup).
 *
 * Verification chain:
 *   1. APC-1 version supported
 *   2. Required fields present and typed correctly
 *   3. canonical_id format sane (provider:payment_id or raw id)
 *   4. Proof not expired
 *   5. Oracle address filter (optional)
 *   6. Action filter (optional)
 *   7. Ed25519 signature verified using canonical_id (not payment_id)
 */

"use strict";

const { OracleSigner }    = require("./OracleSigner");
const { validateAPC1Structure, isSupportedVersion, isExpired } = require("./apc1");
const { InvalidSignatureError, ProofExpiredError } = require("./errors");

class ProofVerifier {
  /**
   * @param {object} opts
   * @param {object}  opts.indexer  - algosdk.Indexer instance
   * @param {string}  [opts.network]
   */
  constructor({ indexer, network = "testnet" } = {}) {
    this.indexer = indexer;
    this.network = network;
  }

  /**
   * Verify an APC-1 proof object offline — no network calls.
   *
   * @param {object} proof
   * @param {object} [opts]
   * @param {string} [opts.expectedOracleAddress]
   * @param {string} [opts.expectedAction]
   * @param {number} [opts.maxAgeSecs]         - default 300
   * @returns {{ valid: boolean, reason?: string, proof?: object }}
   */
  verifyOffchain(proof, opts = {}) {
    // 1. APC-1 version check — fail early on unknown versions
    if (proof.apc && !isSupportedVersion(proof)) {
      return { valid: false, reason: `unsupported APC version: "${proof.apc}"` };
    }

    // 2. Required fields (works for both full APC-1 and internal proof objects)
    const required = ["payment_id", "canonical_id", "amount", "currency", "action", "timestamp", "oracle_address", "signature"];
    for (const f of required) {
      if (proof[f] == null) return { valid: false, reason: `missing required field: ${f}` };
    }

    // 3. canonical_id consistency check
    //    If provider is set and not "unknown", canonical_id should start with "provider:"
    if (proof.provider && proof.provider !== "unknown") {
      const expected_prefix = `${proof.provider}:`;
      if (!proof.canonical_id.startsWith(expected_prefix) && proof.canonical_id !== proof.payment_id) {
        return { valid: false, reason: `canonical_id "${proof.canonical_id}" does not match provider "${proof.provider}"` };
      }
    }

    // 4. Expiry
    const maxAge = opts.maxAgeSecs ?? 300;
    if (isExpired(proof, maxAge)) {
      const age = Math.floor(Date.now() / 1000) - proof.timestamp;
      return { valid: false, reason: `proof expired — age ${age}s exceeds maximum ${maxAge}s` };
    }

    // 5. Oracle address filter
    if (opts.expectedOracleAddress && proof.oracle_address !== opts.expectedOracleAddress) {
      return { valid: false, reason: `oracle address mismatch: expected ${opts.expectedOracleAddress}` };
    }

    // 6. Action filter
    if (opts.expectedAction && proof.action !== opts.expectedAction) {
      return { valid: false, reason: `action mismatch: expected "${opts.expectedAction}", got "${proof.action}"` };
    }

    // 7. Ed25519 signature — uses canonical_id (the on-chain replay key)
    const sigValid = OracleSigner.verifyOffchain(proof);
    if (!sigValid) return { valid: false, reason: "Ed25519 signature verification failed" };

    return { valid: true, proof };
  }

  /**
   * Verify a proof by fetching its anchor transaction from the Algorand indexer.
   * The proof JSON is stored in the transaction's note field.
   *
   * @param {string} txId
   * @param {object} [opts] - same as verifyOffchain opts
   * @returns {Promise<{ valid: boolean, reason?: string, proof?: object, txId: string }>}
   */
  async verifyTxn(txId, opts = {}) {
    if (!this.indexer) return { valid: false, reason: "indexer not configured", txId };

    let info;
    try {
      info = await this.indexer.lookupTransactionByID(txId).do();
    } catch (e) {
      return { valid: false, reason: `indexer lookup failed: ${e.message}`, txId };
    }

    const txn = info.transaction;
    if (!txn?.note) return { valid: false, reason: "transaction not found or has no note field", txId };

    let proof;
    try {
      proof = JSON.parse(Buffer.from(txn.note, "base64").toString("utf8"));
    } catch {
      return { valid: false, reason: "note field is not valid JSON", txId };
    }

    const result = this.verifyOffchain(proof, opts);
    return { ...result, txId };
  }

  /**
   * Batch verify multiple txIds.
   * @param {string[]} txIds
   * @param {object}   [opts]
   * @returns {Promise<Array>}
   */
  async verifyBatch(txIds, opts = {}) {
    return Promise.all(txIds.map(id => this.verifyTxn(id, opts)));
  }
}

module.exports = { ProofVerifier };
