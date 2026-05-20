/**
 * @algopayoracle/oracle-sdk — Custom Payment Adapter Example
 *
 * Demonstrates how to integrate any payment gateway with AlgoPay Oracle.
 * The SDK's core (AlgoPayClient) only speaks PaymentEvent.
 * Your adapter is the translation layer between your gateway and PaymentEvent.
 *
 * This file shows three adapters:
 *   1. PayUAdapter     — real-world Indian payment gateway
 *   2. PhonePeAdapter  — UPI-native gateway
 *   3. GenericAdapter  — minimal template to copy for any provider
 *
 * The PaymentAdapter interface (from index.d.ts):
 *
 *   interface PaymentAdapter {
 *     parseWebhook(rawBody: Buffer | string, signature: string): PaymentEvent | null;
 *   }
 *
 * Rules for a correct adapter:
 *   1. Verify the gateway's own signature/checksum before trusting any field
 *   2. Return null (never throw) on invalid signature or non-payment events
 *   3. Amount must come from the gateway payload — never from the request body directly
 *   4. Set provider so canonical_id = "provider:payment_id" is unique per rail
 */

"use strict";

const crypto = require("crypto");
const { AlgoPayClient } = require("../src");

// ════════════════════════════════════════════════════════════════════════════
//  1. PayUAdapter — PayU India
//     Docs: https://devguide.payu.in/webhook/webhook-overview/
// ════════════════════════════════════════════════════════════════════════════

class PayUAdapter {
  /**
   * @param {object} opts
   * @param {string} opts.merchantSalt  - PayU merchant salt
   * @param {string} [opts.defaultAction]
   */
  constructor({ merchantSalt, defaultAction = "unlock" }) {
    if (!merchantSalt) throw new Error("PayUAdapter: merchantSalt is required");
    this.merchantSalt  = merchantSalt;
    this.defaultAction = defaultAction;
  }

  /**
   * PayU sends a hash in the payload for webhook verification.
   * Hash formula (reverse): sha512(salt|status||||||udf5|udf4|udf3|udf2|udf1|email|productinfo|amount|txnid|key)
   */
  parseWebhook(rawBody, _signature) {
    let body;
    try { body = Object.fromEntries(new URLSearchParams(rawBody.toString())); }
    catch { return null; }

    if (body.status !== "success") return null;
    if (!body.txnid || !body.amount) return null;

    // Verify PayU hash (simplified — see PayU docs for full field list)
    const hashString = [
      this.merchantSalt,
      body.status,
      "", "", "", "",                        // udf5–udf2 (empty if not used)
      body.udf1 || "",
      body.email || "",
      body.productinfo || "",
      body.amount,
      body.txnid,
      body.key,
    ].join("|");

    const expectedHash = crypto.createHash("sha512").update(hashString).digest("hex");
    if (body.hash !== expectedHash) return null;

    return {
      payment_id: body.txnid,
      amount:     Math.round(Number(body.amount)),  // PayU sends as string "100.00"
      currency:   "INR",
      action:     this.defaultAction,
      provider:   "payu",
    };
  }
}

// ════════════════════════════════════════════════════════════════════════════
//  2. PhonePeAdapter — PhonePe Business
//     Docs: https://developer.phonepe.com/v1/reference/check-status-api
// ════════════════════════════════════════════════════════════════════════════

class PhonePeAdapter {
  /**
   * @param {object} opts
   * @param {string} opts.saltKey    - PhonePe salt key
   * @param {number} opts.saltIndex  - PhonePe salt index (usually 1)
   * @param {string} [opts.defaultAction]
   */
  constructor({ saltKey, saltIndex = 1, defaultAction = "unlock" }) {
    if (!saltKey) throw new Error("PhonePeAdapter: saltKey is required");
    this.saltKey       = saltKey;
    this.saltIndex     = saltIndex;
    this.defaultAction = defaultAction;
  }

  /**
   * PhonePe sends X-VERIFY header: sha256(base64payload + "/pg/v1/pay" + salt) + "###" + saltIndex
   */
  parseWebhook(rawBody, xVerifyHeader) {
    if (!xVerifyHeader) return null;

    const [receivedHash, receivedIndex] = xVerifyHeader.split("###");
    if (Number(receivedIndex) !== this.saltIndex) return null;

    const base64Body    = Buffer.from(rawBody).toString("base64");
    const hashInput     = base64Body + "/pg/v1/pay" + this.saltKey;
    const expectedHash  = crypto.createHash("sha256").update(hashInput).digest("hex");

    if (receivedHash !== expectedHash) return null;

    let parsed;
    try { parsed = JSON.parse(Buffer.from(base64Body, "base64").toString()); }
    catch { return null; }

    const data = parsed?.data;
    if (!data?.merchantTransactionId || !data?.amount) return null;
    if (parsed?.code !== "PAYMENT_SUCCESS") return null;

    return {
      payment_id: data.merchantTransactionId,
      amount:     Math.round(data.amount / 100),  // PhonePe sends in paise
      currency:   "INR",
      action:     this.defaultAction,
      provider:   "phonepe",
    };
  }
}

// ════════════════════════════════════════════════════════════════════════════
//  3. GenericAdapter — minimal copy-paste template
//
//  Steps to adapt for any gateway:
//    a) Replace verifySignature() with your gateway's HMAC/checksum method
//    b) Map gateway fields → payment_id, amount, currency
//    c) Set provider to a unique lowercase label
// ════════════════════════════════════════════════════════════════════════════

class GenericAdapter {
  constructor({ secret, defaultAction = "unlock" }) {
    this.secret        = secret;
    this.defaultAction = defaultAction;
  }

  parseWebhook(rawBody, signature) {
    // a) Verify signature — replace this with your gateway's method
    if (!this._verifySignature(rawBody, signature)) return null;

    let body;
    try { body = JSON.parse(rawBody.toString()); }
    catch { return null; }

    // b) Only process payment success events
    if (body.event_type !== "payment.success") return null;

    // c) Map to PaymentEvent
    return {
      payment_id: body.transaction_id,              // gateway's unique ID
      amount:     Math.round(Number(body.amount)),  // always integer
      currency:   (body.currency || "INR").toUpperCase(),
      action:     this.defaultAction,
      provider:   "mygateway",                      // your unique label
    };
  }

  _verifySignature(rawBody, signature) {
    // Replace with your gateway's actual verification
    const expected = crypto
      .createHmac("sha256", this.secret)
      .update(rawBody)
      .digest("hex");
    const received = Buffer.from(signature || "", "hex");
    if (expected.length !== received.length) return false;
    return crypto.timingSafeEqual(Buffer.from(expected, "hex"), received);
  }
}

// ════════════════════════════════════════════════════════════════════════════
//  Wiring into Express (same pattern for all adapters)
// ════════════════════════════════════════════════════════════════════════════

function wireAdapter(app, path, adapter, client, limiter) {
  app.post(path, limiter, async (req, res) => {
    // Every adapter implements the same parseWebhook interface
    const event = adapter.parseWebhook(
      req.rawBody,
      req.headers["x-signature"] || req.headers["x-verify"] || req.headers["x-razorpay-signature"]
    );

    if (!event) return res.status(401).json({ error: "invalid webhook signature" });

    try {
      const result = await client.verifyAndCommit(event);
      res.json({ received: true, txId: result.txId });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Demo: all three adapters wired to the same client
// ────────────────────────────────────────────────────────────────────────────

if (require.main === module) {
  require("dotenv").config();

  const express = require("express");
  const app     = express();
  const client  = new AlgoPayClient({
    mnemonic: process.env.ORACLE_MNEMONIC,
    network:  process.env.ALGO_NETWORK || "testnet",
    appId:    process.env.ALGO_APP_ID ? Number(process.env.ALGO_APP_ID) : null,
  });

  // Raw body middleware
  app.use((req, _res, next) => {
    const chunks = [];
    req.on("data", c => chunks.push(c));
    req.on("end", () => {
      req.rawBody = Buffer.concat(chunks);
      try { req.body = JSON.parse(req.rawBody); } catch { req.body = {}; }
      next();
    });
  });

  const noopLimiter = (_req, _res, next) => next();  // replace with express-rate-limit in production

  if (process.env.PAYU_SALT) {
    const payu = new PayUAdapter({ merchantSalt: process.env.PAYU_SALT });
    wireAdapter(app, "/webhook/payu", payu, client, noopLimiter);
    console.log("PayU adapter wired → POST /webhook/payu");
  }

  if (process.env.PHONEPE_SALT) {
    const phonepe = new PhonePeAdapter({ saltKey: process.env.PHONEPE_SALT });
    wireAdapter(app, "/webhook/phonepe", phonepe, client, noopLimiter);
    console.log("PhonePe adapter wired → POST /webhook/phonepe");
  }

  app.listen(5000, () => console.log("Custom adapter demo → http://localhost:5000"));
}

module.exports = { PayUAdapter, PhonePeAdapter, GenericAdapter };
