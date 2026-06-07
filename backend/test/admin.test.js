/**
 * Tests for the protected Admin endpoints (used for rotating Oracles).
 * Ensures that sensitive operations are heavily guarded by API keys and cannot
 * be accidentally triggered by public users.
 */

require("./setup");
const request = require("supertest");
const { publicApp } = require("../index"); 

describe("Admin API Endpoints", () => {
  
  describe("Authentication Guard Middleware", () => {
    it("should return an unauthorized error for requests lacking the admin key header", async () => {
      // Note: Because your admin routes are mounted on publicApp in index.js, 
      // we query them directly.
      const response = await request(publicApp).get("/admin/status");
      expect(response.status).toBe(401);
    });

    it("should return an unauthorized error for requests using an invalid admin key", async () => {
      const response = await request(publicApp)
        .get("/admin/status")
        .set("x-admin-key", "hacker_trying_to_guess_key");
        
      expect(response.status).toBe(401);
    });
  });

  describe("Protected Operations", () => {
    it("GET /admin/status should return comprehensive system metrics when authorized", async () => {
      const response = await request(publicApp)
        .get("/admin/status")
        .set("x-admin-key", process.env.ADMIN_API_KEY);
        
      expect(response.status).toBe(200);
      expect(response.body.address).toBe("MOCK_ORACLE_ADDR");
      // Total verified is fetched via our mock of `getApplicationByID` parsing global state
      expect(response.body.total_verified).toBeDefined(); 
    });

    it("POST /admin/oracle/add should enforce input validation (requiring an address)", async () => {
      const response = await request(publicApp)
        .post("/admin/oracle/add")
        .set("x-admin-key", process.env.ADMIN_API_KEY)
        .send({}); // Intentionally omitting the required address
        
      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/address required/);
    });
  });

});