/**
 * Tests for the client-side verification endpoints.
 * When the frontend completes checkout, it sends the payment proof here.
 * This suite ensures we correctly validate the client's payload and consult
 * our server-side `InMemoryOrderStore` for the true amount.
 */

require("./setup");
const request = require("supertest");
const crypto = require("crypto");
const { publicApp } = require("../index");

describe("Public API - Frontend Client Verification", () => {
  
  describe("POST /verify-payment", () => {
    it("should immediately reject invalid or spoofed client-side signatures", async () => {
      const response = await request(publicApp)
        .post("/verify-payment")
        .send({
          razorpay_order_id: "order_123",
          razorpay_payment_id: "pay_123",
          razorpay_signature: "invalid_hacker_sig",
          action: "unlock"
        });
        
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it("should handle valid signatures but block execution if the order was never created server-side", async () => {
      // 1. Manually create a cryptographically valid frontend signature
      const text = "order_123|pay_123";
      const validSig = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
        .update(text)
        .digest("hex");

      const response = await request(publicApp)
        .post("/verify-payment")
        .send({
          razorpay_order_id: "order_123",
          razorpay_payment_id: "pay_123",
          razorpay_signature: validSig,
          action: "unlock"
        });

      // 2. We expect a 401 Unauthorized here. Why? Because even though the signature is real,
      // the `InMemoryOrderStore` doesn't have "order_123" saved (since we didn't call /create-order 
      // in this isolated test). This proves the SDK securely blocks unregistered rogue orders!
      expect(response.status).toBe(401); 
      // FIX: Matches the exact error string emitted by your backend's index.js
      expect(response.body.error).toMatch(/invalid payment signature or order expired/);
    });
  });

  describe("GET /verify-proof/:txId", () => {
    it("should poll the Algorand indexer and return a successfully validated off-chain proof", async () => {
      // This relies heavily on the indexer mock we established in `setup.js`
      const response = await request(publicApp).get("/verify-proof/MOCK_TX_ID");
      
      expect(response.status).toBe(200);
      expect(response.body.valid).toBe(true);
      expect(response.body.txId).toBe("MOCK_TX_ID");
      expect(response.body.proof.payment_id).toBe("pay_test");
    });
  });

});