/**
 * @algopayoracle/oracle-sdk
 *
 * Everything you need is available from this single entry point.
 * You should never need to import from internal paths.
 *
 * Common usage:
 *
 *   const { AlgoPayClient } = require("@algopayoracle/oracle-sdk");
 *
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
 *     provider:   "razorpay",
 *   });
 */

"use strict";

// ── Core client (most users only need this) ───────────────────────────────────
const { AlgoPayClient }  = require("./AlgoPayClient");
const { OracleSigner }   = require("./OracleSigner");
const { ProofVerifier }  = require("./ProofVerifier");

// ── Network helpers ────────────────────────────────────────────────────────────
const { NETWORKS, createClients, createCustomClients } = require("./networks");

// ── APC-1 standard ────────────────────────────────────────────────────────────
const {
  APC_VERSION,
  SUPPORTED_APC,
  toAPC1,
  validateAPC1Structure,
  isSupportedVersion,
  isExpired,
} = require("./apc1");

// ── Input validation ──────────────────────────────────────────────────────────
const { validatePaymentEvent, validateProofFields, MIN_AMOUNT } = require("./validate");

// ── Error classes ─────────────────────────────────────────────────────────────
const errors = require("./errors");

// ── Payment adapters ──────────────────────────────────────────────────────────
const { RazorpayAdapter } = require("./adapters/razorpay");
const { StripeAdapter }   = require("./adapters/stripe");

// ── Infrastructure utilities ──────────────────────────────────────────────────
const { createLogger, requestLogger } = require("./utils/logger");
const { createOrderStore, InMemoryOrderStore } = require("./utils/store");

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  // Primary API
  AlgoPayClient,

  // Lower-level building blocks
  OracleSigner,
  ProofVerifier,

  // Network
  NETWORKS,
  createClients,
  createCustomClients,

  // APC-1 standard
  APC_VERSION,
  SUPPORTED_APC,
  toAPC1,
  validateAPC1Structure,
  isSupportedVersion,
  isExpired,

  // Input validation
  validatePaymentEvent,
  validateProofFields,
  MIN_AMOUNT,

  // Error classes (spread so consumers can do { AlgoPayError } = require(...))
  ...errors,

  // Adapters
  RazorpayAdapter,
  StripeAdapter,

  // Infrastructure
  createLogger,
  requestLogger,
  createOrderStore,
  InMemoryOrderStore,
};
