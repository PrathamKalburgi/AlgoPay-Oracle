/**
 * Tests for the /create-order endpoint.
 * This ensures that before a user even opens the checkout UI, the backend
 * properly registers the intended payment amount in the order store to prevent tampering.
 */

require("./setup");
const request = require("supertest");
const { publicApp } = require("../index");
const { RazorpayAdapter } = require("@algopayoracle/oracle-sdk");

// Mock the razorpay adapter's network call so our backend doesn't try to make real
// HTTP POST requests to api.razorpay.com when creating an order.
jest.spyOn(RazorpayAdapter.prototype, 'createOrder').mockResolvedValue({
  id: "order_MOCK_123",
  amount: 50000, // Razorpay inherently uses base units (paise)
  currency: "INR"
});

describe("Public API - Order Creation", () => {
  
  describe("POST /create-order", () => {
    it("should comprehensively reject orders with missing or non-integer amounts", async () => {
      const response = await request(publicApp)
        .post("/create-order")
        .send({ amount: -50, currency: "INR" });
        
      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/positive integer/);
    });

    it("should successfully create a Razorpay order, normalizing the amount back from paise", async () => {
      const response = await request(publicApp)
        .post("/create-order")
        .send({ amount: 500, currency: "INR" });
        
      expect(response.status).toBe(200);
      expect(response.body.provider).toBe("razorpay");
      expect(response.body.order_id).toBe("order_MOCK_123");
      // Ensures the backend/adapter correctly translated 50000 paise back to 500 INR
      expect(response.body.amount).toBe(500); 
    });
  });

});