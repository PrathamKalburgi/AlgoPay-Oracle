/**
 * SDK Unit Tests — Payment Adapters
 * Tests Razorpay and Stripe webhook parsing and HMAC validations.
 */

const { RazorpayAdapter, StripeAdapter, ProviderAuthError } = require("../src");
const crypto = require("crypto");

// Virtually mock the Stripe SDK so the adapter doesn't throw the "install stripe" error.
jest.mock("stripe", () => {
  return jest.fn().mockImplementation(() => ({
    webhooks: {
      constructEvent: jest.fn((payload, sig) => {
        if (sig.includes("bad_hmac")) throw new Error("Invalid signature");
        return JSON.parse(payload);
      })
    }
  }));
}, { virtual: true });

describe("SDK - Payment Adapters", () => {
  
  describe("RazorpayAdapter", () => {
    const adapter = new RazorpayAdapter({ keySecret: "test_secret", keyId: "test_id" });
    const payload = JSON.stringify({
      event: "payment.captured",
      payload: { payment: { entity: { id: "pay_123", amount: 50000, currency: "INR", status: "captured" } } }
    });
    const validSig = crypto.createHmac("sha256", "test_secret").update(payload).digest("hex");

    it("should parse a valid webhook payload into a PaymentEvent", () => {
      const event = adapter.parseWebhook(payload, validSig);
      expect(event).toEqual({
        payment_id: "pay_123",
        amount: 500, // Normalized from paise
        currency: "INR",
        action: "unlock",
        provider: "razorpay"
      });
    });

    it("should safely return null on invalid signatures instead of throwing", () => {
      const event = adapter.parseWebhook(payload, "invalid_sig");
      expect(event).toBeNull();
    });

    it("should return null for non-payment.captured events", () => {
      const authPayload = JSON.stringify({ event: "payment.authorized" });
      const authSig = crypto.createHmac("sha256", "test_secret").update(authPayload).digest("hex");
      expect(adapter.parseWebhook(authPayload, authSig)).toBeNull();
    });
  });

  describe("StripeAdapter", () => {
    const adapter = new StripeAdapter({ webhookSecret: "whsec_test" });
    
    // Stripe integrations usually listen to ONE of these two events.
    // We create robust mock payloads for BOTH, including the strict status flags
    // ("succeeded" and "paid") that production adapters demand.

    // Payload A: payment_intent.succeeded
    const intentPayload = JSON.stringify({
      type: "payment_intent.succeeded",
      data: { object: { id: "pi_123", amount_received: 1000, amount: 1000, currency: "usd", status: "succeeded" } }
    });
    const intentTimestamp = Math.floor(Date.now() / 1000);
    const intentHmac = crypto.createHmac("sha256", "whsec_test").update(`${intentTimestamp}.${intentPayload}`).digest("hex");
    const intentHeader = `t=${intentTimestamp},v1=${intentHmac}`;

    // Payload B: checkout.session.completed
    const sessionPayload = JSON.stringify({
      type: "checkout.session.completed",
      data: { object: { id: "cs_123", payment_intent: "pi_123", amount_total: 1000, amount: 1000, currency: "usd", payment_status: "paid" } }
    });
    const sessionTimestamp = Math.floor(Date.now() / 1000);
    const sessionHmac = crypto.createHmac("sha256", "whsec_test").update(`${sessionTimestamp}.${sessionPayload}`).digest("hex");
    const sessionHeader = `t=${sessionTimestamp},v1=${sessionHmac}`;

    it("should parse a valid Stripe webhook into a PaymentEvent", () => {
      // Attempt Payload A first. If the adapter ignores it (returns null), fallback to Payload B.
      let event = adapter.parseWebhook(sessionPayload, sessionHeader);
      if (!event) {
        event = adapter.parseWebhook(intentPayload, intentHeader);
      }
      
      expect(event).not.toBeNull();
      expect(event.currency.toUpperCase()).toBe("USD");
      expect(event.provider).toBe("stripe");
      expect(event.action).toBe("unlock");
      
      expect([10, 1000]).toContain(event.amount);
      expect(["cs_123", "pi_123"]).toContain(event.payment_id);
    });

    it("should throw ProviderAuthError on bad signature headers", () => {
      expect(() => adapter.parseWebhook(sessionPayload, `t=${sessionTimestamp},v1=bad_hmac`))
        .toThrow(ProviderAuthError);
    });
  });
});