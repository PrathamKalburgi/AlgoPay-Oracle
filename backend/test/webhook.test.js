/**
 * Tests for Webhook ingestion (Without KYC/Real Provider Account).
 * * This is arguably the most critical test. Webhooks are public endpoints, meaning
 * anyone can POST to them. The only thing separating a valid payment from a malicious
 * exploit is the HMAC SHA-256 signature verification.
 * * We test this by manually creating an exact replica of Razorpay's JSON payload,
 * hashing it with our dummy secret, and sending it to our own endpoint.
 */

require("./setup");
const request = require("supertest");
const crypto = require("crypto");
const { publicApp } = require("../index");

describe("Public API - Razorpay Webhook Ingestion", () => {
  
  // 1. Construct a dummy webhook payload simulating a successful payment
  const mockWebhookPayload = {
    entity: "event",
    event: "payment.captured",
    contains: ["payment"],
    payload: {
      payment: {
        entity: {
          id: "pay_rzp_mock_123",
          amount: 50000, // 500 INR in base units
          currency: "INR",
          status: "captured"
        }
      }
    }
  };

  // Stringify the payload exactly as it would arrive over the wire
  const rawBodyString = JSON.stringify(mockWebhookPayload);

  // 2. Generate the expected HMAC signature using the dummy secret defined in setup.js
  const validSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(rawBodyString)
    .digest("hex");

  describe("POST /webhook/razorpay", () => {
    
    it("should reject raw requests that completely lack an authentication signature", async () => {
      const response = await request(publicApp)
        .post("/webhook/razorpay")
        .set("Content-Type", "application/json")
        .send(rawBodyString);
        
      expect(response.status).toBe(401);
      expect(response.body.error).toMatch(/invalid signature/);
    });

    it("should aggressively reject requests where the signature is invalid or spoofed", async () => {
      const response = await request(publicApp)
        .post("/webhook/razorpay")
        .set("Content-Type", "application/json")
        .set("x-razorpay-signature", "12345_spoofed_invalid_signature_string_67890")
        .send(rawBodyString);
        
      expect(response.status).toBe(401);
      expect(response.body.error).toMatch(/invalid signature/);
    });

    it("should process perfectly valid webhooks, parse them, and commit them to Algorand", async () => {
      const response = await request(publicApp)
        .post("/webhook/razorpay")
        .set("Content-Type", "application/json")
        // Pass our manually generated valid signature
        .set("x-razorpay-signature", validSignature) 
        .send(rawBodyString); // Send raw string to ensure Express body parsers don't alter the byte sequence
        
      expect(response.status).toBe(200);
      expect(response.body.received).toBe(true);
      // Confirms the SDK triggered verifyAndCommit which hit our AtomicTransactionComposer mock
      expect(response.body.txId).toBe("MOCK_CONTRACT_TXID"); 
    });
    
  });
});