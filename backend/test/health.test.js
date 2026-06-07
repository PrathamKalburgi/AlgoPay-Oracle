/**
 * Tests for the public health and oracle configuration info endpoints.
 * * We use `supertest` to wrap our Express `publicApp` instance, allowing us to 
 * simulate HTTP requests against our routes without needing to bind the server 
 * to an actual network port.
 */

require("./setup");
const request = require("supertest");

// Note: Ensure your backend `index.js` exports `publicApp` at the very bottom:
// module.exports = { publicApp };
const { publicApp } = require("../index"); 

describe("Public API - Health & Info", () => {
  
  describe("GET /health", () => {
    it("should return 200 OK and correctly parsed Algorand network status", async () => {
      const response = await request(publicApp).get("/health");
      
      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      // The round should match the `10000` returned by our Algod status mock in setup.js
      expect(response.body.round).toBe(10000); 
      expect(response.body.network).toBeDefined();
    });
  });

  describe("GET /oracle/info", () => {
    it("should return the oracle's derived public address and app ID configuration", async () => {
      const response = await request(publicApp).get("/oracle/info");
      
      expect(response.status).toBe(200);
      // Ensures the mnemonic processing correctly injected the mocked address
      expect(response.body.address).toBe("MOCK_ORACLE_ADDR");
      expect(response.body.app_id).toBe(12345);
      expect(response.body.pubkey_base64).toBeDefined();
    });
  });

});