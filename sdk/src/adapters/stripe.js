/**
 * AlgoPay Oracle SDK — Stripe Adapter
 *
 * Bridges Stripe payment events to AlgoPay PaymentEvents.
 * The credential layer (APC-1 / oracle signing) is provider-agnostic.
 * This adapter is the provider-specific translation layer for Stripe.
 *
 * Requires the 'stripe' npm package:
 *   npm install stripe
 *
 * Usage:
 *   const adapter = new StripeAdapter({ webhookSecret: process.env.STRIPE_WEBHOOK_SECRET });
 *   const event   = adapter.parseWebhook(req.rawBody, req.headers["stripe-signature"]);
 *   if (!event) return res.status(401).end();
 *   const result  = await client.verifyAndCommit(event);
 */

const { ProviderAuthError, ConfigError } = require("../errors");

class StripeAdapter {
  /**
   * @param {object} opts
   * @param {string} opts.webhookSecret  - Stripe webhook signing secret (whsec_...)
   * @param {string} [opts.secretKey]    - Stripe secret key (sk_test_... or sk_live_...)
   * @param {string} [opts.defaultAction]
   */
  constructor({ webhookSecret, secretKey, defaultAction = "unlock" } = {}) {
    if (!webhookSecret) throw new ConfigError("StripeAdapter: webhookSecret is required");
    this.webhookSecret = webhookSecret;
    this.defaultAction = defaultAction;

    // Lazy-load stripe — not a hard SDK dependency
    try {
      const Stripe  = require("stripe");
      this.stripe   = new Stripe(secretKey || process.env.STRIPE_SECRET_KEY || "");
    } catch {
      this.stripe = null;
    }
  }

  /**
   * Parse and verify a Stripe webhook event.
   * Stripe's SDK uses a timing-safe comparison internally.
   * Returns null on non-payment events, throws ProviderAuthError on bad sig.
   *
   * @param {Buffer} rawBody    - raw request body (Buffer, not parsed)
   * @param {string} signature  - stripe-signature header value
   * @returns {object|null}     PaymentEvent or null
   */
  parseWebhook(rawBody, signature) {
    if (!this.stripe) throw new ConfigError("StripeAdapter: install 'stripe' npm package");

    let event;
    try {
      // Stripe constructEvent uses timing-safe HMAC internally
      event = this.stripe.webhooks.constructEvent(rawBody, signature, this.webhookSecret);
    } catch (e) {
      throw new ProviderAuthError("stripe", e.message);
    }

    // Only handle successful payment intents
    if (event.type !== "payment_intent.succeeded") return null;

    const intent = event.data.object;
    if (!intent?.id || !intent?.amount) return null;

    return {
      payment_id: intent.id,
      amount:     Math.round(intent.amount / 100),   // cents → base unit
      currency:   (intent.currency || "usd").toUpperCase(),
      action:     this.defaultAction,
      provider:   "stripe",
    };
  }
}

module.exports = { StripeAdapter };
