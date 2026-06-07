/**
 * SDK Unit Tests — Main Entry Point (API Contract)
 * Acts as a runtime verification for `index.d.ts`.
 * Proves that every class, function, and constant the SDK promises to export
 * is successfully exposed via the main `index.js` entry point.
 */

const sdk = require("../src");

describe("SDK - API Contract (index.js exports)", () => {
  it("should export Core Classes", () => {
    expect(sdk.AlgoPayClient).toBeDefined();
    expect(sdk.OracleSigner).toBeDefined();
    expect(sdk.ProofVerifier).toBeDefined();
  });

  it("should export Network Utilities", () => {
    expect(sdk.NETWORKS).toBeDefined();
    expect(sdk.createClients).toBeDefined();
    expect(sdk.createCustomClients).toBeDefined();
  });

  it("should export APC-1 Standard Constants and Functions", () => {
    expect(sdk.APC_VERSION).toBe("1");
    expect(sdk.SUPPORTED_APC).toBeInstanceOf(Set);
    expect(typeof sdk.toAPC1).toBe("function");
    expect(typeof sdk.validateAPC1Structure).toBe("function");
    expect(typeof sdk.isSupportedVersion).toBe("function");
    expect(typeof sdk.isExpired).toBe("function");
  });

  it("should export Input Validation Functions", () => {
    expect(typeof sdk.validatePaymentEvent).toBe("function");
    expect(typeof sdk.validateProofFields).toBe("function");
    expect(typeof sdk.MIN_AMOUNT).toBe("number");
  });

  it("should export all Custom Error Classes", () => {
    expect(sdk.AlgoPayError).toBeDefined();
    expect(sdk.InsufficientAmountError).toBeDefined();
    expect(sdk.ProofExpiredError).toBeDefined();
    expect(sdk.OracleNotRegisteredError).toBeDefined();
    expect(sdk.ReplayError).toBeDefined();
    expect(sdk.InvalidSignatureError).toBeDefined();
    expect(sdk.ConfigError).toBeDefined();
    expect(sdk.ProviderAuthError).toBeDefined();
  });

  it("should export Payment Adapters", () => {
    expect(sdk.RazorpayAdapter).toBeDefined();
    expect(sdk.StripeAdapter).toBeDefined();
  });
});