/**
 * AlgoPay Oracle SDK — Error Classes
 *
 * All SDK errors extend AlgoPayError so callers can catch by base type.
 *
 * Usage:
 *   const { AlgoPayError, ProofExpiredError } = require("@algopayoracle/oracle-sdk/errors");
 *   try { await client.verifyAndCommit(...) }
 *   catch (e) {
 *     if (e instanceof ProofExpiredError) { ... }
 *     if (e instanceof OracleNotRegisteredError) { ... }
 *   }
 */

class AlgoPayError extends Error {
  constructor(message, code) {
    super(message);
    this.name    = "AlgoPayError";
    this.code    = code || "ALGOPAY_ERROR";
  }
}

/** Amount is below the contract's MIN_AMOUNT threshold */
class InsufficientAmountError extends AlgoPayError {
  constructor(amount, minAmount) {
    super(`Amount ${amount} is below minimum ${minAmount}`, "INSUFFICIENT_AMOUNT");
    this.name      = "InsufficientAmountError";
    this.amount    = amount;
    this.minAmount = minAmount;
  }
}

/** Proof timestamp is older than PROOF_VALIDITY_SECS */
class ProofExpiredError extends AlgoPayError {
  constructor(timestamp, now) {
    const age = now - timestamp;
    super(`Proof expired — signed ${age}s ago (max 300s)`, "PROOF_EXPIRED");
    this.name      = "ProofExpiredError";
    this.timestamp = timestamp;
    this.age       = age;
  }
}

/** oracle_pubkey is not in the contract's oracle registry */
class OracleNotRegisteredError extends AlgoPayError {
  constructor(address) {
    super(`Oracle ${address} is not registered in the contract`, "ORACLE_NOT_REGISTERED");
    this.name    = "OracleNotRegisteredError";
    this.address = address;
  }
}

/** payment_id has already been verified (replay attempt) */
class ReplayError extends AlgoPayError {
  constructor(paymentId) {
    super(`payment_id "${paymentId}" has already been processed`, "REPLAY_DETECTED");
    this.name      = "ReplayError";
    this.paymentId = paymentId;
  }
}

/** Ed25519 signature did not verify */
class InvalidSignatureError extends AlgoPayError {
  constructor() {
    super("Signature verification failed", "INVALID_SIGNATURE");
    this.name = "InvalidSignatureError";
  }
}

/** Configuration is missing or invalid */
class ConfigError extends AlgoPayError {
  constructor(message) {
    super(message, "CONFIG_ERROR");
    this.name = "ConfigError";
  }
}

/** Payment provider (Razorpay/Stripe) signature/HMAC check failed */
class ProviderAuthError extends AlgoPayError {
  constructor(provider, reason) {
    super(`${provider} signature verification failed: ${reason}`, "PROVIDER_AUTH_ERROR");
    this.name     = "ProviderAuthError";
    this.provider = provider;
  }
}

module.exports = {
  AlgoPayError,
  InsufficientAmountError,
  ProofExpiredError,
  OracleNotRegisteredError,
  ReplayError,
  InvalidSignatureError,
  ConfigError,
  ProviderAuthError,
};
