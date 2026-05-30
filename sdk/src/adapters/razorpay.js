/**
 * AlgoPay Oracle SDK — Razorpay Adapter
 *
 * Implements the PaymentAdapter interface for Razorpay.
 * Normalizes Razorpay events into PaymentEvents consumed by AlgoPayClient.
 */

"use strict";

const crypto = require("crypto");
const https  = require("https");
const { ProviderAuthError, ConfigError } = require("../errors");

class RazorpayAdapter {
  /**
   * @param {object} opts
   * @param {string}    opts.keySecret     - Razorpay key secret
   * @param {string}    [opts.keyId]       - Razorpay key ID (required for createOrder)
   * @param {object}    [opts.orderStore]  - shared order store (set/get/consume/delete async interface)
   * @param {string}    [opts.defaultAction]
   */
  constructor({ keySecret, keyId, orderStore, defaultAction = "unlock" } = {}) {
    if (!keySecret) throw new ConfigError("RazorpayAdapter: keySecret is required");
    this.keySecret     = keySecret;
    this.keyId         = keyId;
    this.orderStore    = orderStore || null;
    this.defaultAction = defaultAction;
  }

  // ── parseWebhook ───────────────────────────────────────────────────────────

  /**
   * Parse and verify a Razorpay server-side webhook.
   * Implements PaymentAdapter.parseWebhook.
   * Returns null on any failure (invalid sig, wrong event, bad body).
   *
   * @param {Buffer|string} rawBody
   * @param {string}        signature - X-Razorpay-Signature header
   * @returns {import("../index").PaymentEvent|null}
   */
  parseWebhook(rawBody, signature) {
    if (!signature) return null;

    const expected = crypto.createHmac("sha256", this.keySecret).update(rawBody).digest();
    const received = Buffer.from(signature, "hex");
    if (expected.length !== received.length) return null;
    if (!crypto.timingSafeEqual(expected, received)) return null;

    let body;
    try { body = JSON.parse(rawBody.toString()); } catch { return null; }

    if (body.event !== "payment.captured") return null;

    const p = body?.payload?.payment?.entity;
    if (!p?.id || !p?.amount) return null;

    return {
      payment_id: p.id,
      amount:     Math.round(p.amount / 100),
      currency:   (p.currency || "INR").toUpperCase(),
      action:     this.defaultAction,
      provider:   "razorpay",
    };
  }

  // ── parseClientPayment ────────────────────────────────────────────────────

  /**
   * Verify a Razorpay client-side payment and return a PaymentEvent.
   * Amount is resolved from the server-side orderStore — never from the request.
   *
   * @param {object} opts
   * @param {string} opts.razorpay_order_id
   * @param {string} opts.razorpay_payment_id
   * @param {string} opts.razorpay_signature
   * @param {string} [opts.action]
   * @throws {ProviderAuthError} on invalid signature or missing order
   * @returns {import("../index").PaymentEvent}
   */
  async parseClientPayment({ razorpay_order_id, razorpay_payment_id, razorpay_signature, action }) {
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      throw new ProviderAuthError("razorpay", "missing required payment fields");
    }

    const expected = crypto
      .createHmac("sha256", this.keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest();
    const received = Buffer.from(razorpay_signature, "hex");

    if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) {
      throw new ProviderAuthError("razorpay", "payment signature mismatch");
    }

    // Amount MUST come from the server-side order record, not the request body
    // This is a synchronous path so we return a promise that resolves the event
    // Callers must await this if orderStore.consume is async
    if (!this.orderStore) {
      throw new ConfigError("RazorpayAdapter: orderStore is required for parseClientPayment — amount cannot be trusted from client");
    }
    const record = await this.orderStore.consume(razorpay_order_id);
    if (!record) {
      throw new ProviderAuthError("razorpay", `order "${razorpay_order_id}" not found or already used — call createOrder first`);
    }
    return {
      payment_id: razorpay_payment_id,
      amount:     record.amount,
      currency:   record.currency,
      action:     action || this.defaultAction,
      provider:   "razorpay",
    };
  }


  // ── createOrder ───────────────────────────────────────────────────────────

  /**
   * Create a Razorpay order and store the authoritative amount server-side.
   *
   * @param {object}  opts
   * @param {number}  opts.amount    - integer, in rupees
   * @param {string}  [opts.currency]
   * @returns {Promise<{ order_id, amount, currency, key_id }>}
   */
  async createOrder({ amount, currency = "INR" }) {
    if (!this.keyId)                                    throw new ConfigError("RazorpayAdapter: keyId is required for createOrder");
    if (!Number.isInteger(amount) || amount <= 0)       throw new ConfigError("RazorpayAdapter: amount must be a positive integer");

    const body = JSON.stringify({
      amount:   amount * 100,
      currency: currency.toUpperCase(),
      receipt:  "algopay_" + Date.now(),
    });

    const auth = Buffer.from(`${this.keyId}:${this.keySecret}`).toString("base64");

    const order = await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: "api.razorpay.com",
        path:     "/v1/orders",
        method:   "POST",
        headers:  { "Content-Type": "application/json", Authorization: `Basic ${auth}` },
      }, res => {
        let data = "";
        res.on("data", c => (data += c));
        res.on("end", () => {
          try { resolve(JSON.parse(data)); }
          catch { reject(new ConfigError("RazorpayAdapter: failed to parse order creation response")); }
        });
      });
      req.on("error", err => reject(new ConfigError(`RazorpayAdapter: order request failed — ${err.message}`)));
      req.write(body);
      req.end();
    });

    if (!order.id) {
      throw new ProviderAuthError("razorpay", `order creation failed: ${JSON.stringify(order)}`);
    }

    if (this.orderStore) {
      await this.orderStore.set(order.id, { amount, currency: currency.toUpperCase() });
    }

    return {
      order_id: order.id,
      amount,
      currency: currency.toUpperCase(),
      key_id:   this.keyId,
    };
  }
}

module.exports = { RazorpayAdapter };
