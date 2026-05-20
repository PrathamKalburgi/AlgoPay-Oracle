/**
 * AlgoPay Oracle SDK — Input Validation
 *
 * Lightweight schema validation for PaymentEvent and proof objects.
 * No external dependencies — validates manually for zero overhead.
 *
 * Usage:
 *   const { validatePaymentEvent } = require("@algopayoracle/oracle-sdk/validate");
 *   const event = validatePaymentEvent(req.body);  // throws ConfigError on invalid input
 */

"use strict";

const { ConfigError, InsufficientAmountError } = require("./errors");

const MIN_AMOUNT       = 100;
const MAX_PAYMENT_ID   = 256;   // chars
const MAX_ACTION_LEN   = 64;
const CURRENCY_RE      = /^[A-Z]{3}$/;   // ISO 4217: 3 uppercase letters

/**
 * Validate and normalise a PaymentEvent.
 * Throws a typed error on the first validation failure.
 *
 * @param {object} input
 * @returns {import("./index").PaymentEvent} normalised PaymentEvent
 * @throws {ConfigError | InsufficientAmountError}
 */
function validatePaymentEvent(input) {
  if (!input || typeof input !== "object") {
    throw new ConfigError("PaymentEvent must be an object");
  }

  const { payment_id, amount, currency = "INR", action = "unlock", provider = "unknown" } = input;

  // payment_id
  if (!payment_id || typeof payment_id !== "string") {
    throw new ConfigError("PaymentEvent.payment_id must be a non-empty string");
  }
  if (payment_id.length > MAX_PAYMENT_ID) {
    throw new ConfigError(`PaymentEvent.payment_id must be ≤ ${MAX_PAYMENT_ID} characters`);
  }

  // amount — must be a safe positive integer
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new ConfigError("PaymentEvent.amount must be a positive integer");
  }
  if (amount < MIN_AMOUNT) {
    throw new InsufficientAmountError(amount, MIN_AMOUNT);
  }

  // currency — 3-char ISO 4217 code
  const normCurrency = String(currency).toUpperCase();
  if (!CURRENCY_RE.test(normCurrency)) {
    throw new ConfigError(`PaymentEvent.currency must be a 3-character ISO 4217 code (e.g. INR, USD), got: "${currency}"`);
  }

  // action
  if (!action || typeof action !== "string") {
    throw new ConfigError("PaymentEvent.action must be a non-empty string");
  }
  if (action.length > MAX_ACTION_LEN) {
    throw new ConfigError(`PaymentEvent.action must be ≤ ${MAX_ACTION_LEN} characters`);
  }

  // timestamp sanity (if provided — internal proofs carry this)
  if (input.timestamp !== undefined) {
    const now = Math.floor(Date.now() / 1000);
    if (!Number.isInteger(input.timestamp)) {
      throw new ConfigError("PaymentEvent.timestamp must be an integer (unix seconds)");
    }
    if (input.timestamp > now + 60) {
      throw new ConfigError(`PaymentEvent.timestamp is too far in the future: ${input.timestamp}`);
    }
  }

  return {
    payment_id,
    amount,
    currency: normCurrency,
    action,
    provider: typeof provider === "string" ? provider : "unknown",
  };
}

/**
 * Validate that a proof has all required fields for off-chain verification.
 * Does not check the signature — use ProofVerifier for that.
 *
 * @param {object} proof
 * @throws {ConfigError}
 */
function validateProofFields(proof) {
  const required = ["payment_id", "canonical_id", "amount", "currency", "action", "timestamp", "app_id", "oracle_address", "signature"];
  for (const field of required) {
    if (proof[field] == null) {
      throw new ConfigError(`Proof is missing required field: ${field}`);
    }
  }
  if (proof.oracle_address.length !== 58) {
    throw new ConfigError("Proof oracle_address must be a valid Algorand address (58 characters)");
  }
}

module.exports = { validatePaymentEvent, validateProofFields, MIN_AMOUNT };
