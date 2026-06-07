/**
 * SDK Unit Tests — Data Validation
 * Proves the SDK aggressively rejects malformed inputs, floating-point numbers,
 * negative amounts, and invalid ISO currencies before attempting cryptography.
 */

const { 
  validatePaymentEvent, 
  validateProofFields, 
  ConfigError, 
  InsufficientAmountError 
} = require("../src");

describe("SDK - Input Validation", () => {
  
  describe("validatePaymentEvent", () => {
    it("should normalize and accept a minimal valid event", () => {
      const result = validatePaymentEvent({ payment_id: "pay_123", amount: 500 });
      expect(result).toEqual({
        payment_id: "pay_123",
        amount: 500,
        currency: "INR", // defaults applied
        action: "unlock",
        provider: "unknown"
      });
    });

    it("should throw ConfigError on missing or invalid payment_ids", () => {
      expect(() => validatePaymentEvent({ amount: 500 })).toThrow(ConfigError);
      expect(() => validatePaymentEvent({ payment_id: "", amount: 500 })).toThrow(ConfigError);
      expect(() => validatePaymentEvent({ payment_id: 12345, amount: 500 })).toThrow(ConfigError);
    });

    it("should throw ConfigError on floating-point or non-integer amounts", () => {
      expect(() => validatePaymentEvent({ payment_id: "p1", amount: 100.50 })).toThrow(ConfigError);
      expect(() => validatePaymentEvent({ payment_id: "p1", amount: "100" })).toThrow(ConfigError);
    });

    it("should throw InsufficientAmountError if amount is below the minimum threshold", () => {
      expect(() => validatePaymentEvent({ payment_id: "p1", amount: 50 })).toThrow(InsufficientAmountError);
    });

    it("should throw ConfigError on invalid ISO 4217 currencies", () => {
      expect(() => validatePaymentEvent({ payment_id: "p1", amount: 500, currency: "US" })).toThrow(ConfigError);
      expect(() => validatePaymentEvent({ payment_id: "p1", amount: 500, currency: "DOLLAR" })).toThrow(ConfigError);
    });
  });

  describe("validateProofFields", () => {
    const validProof = {
      payment_id: "pay_1", canonical_id: "demo:pay_1", amount: 500, currency: "INR", 
      action: "unlock", timestamp: 1600000000, app_id: 123, 
      oracle_address: "A".repeat(58), signature: "base64"
    };

    it("should pass silently when all fields are present and valid", () => {
      expect(() => validateProofFields(validProof)).not.toThrow();
    });

    it("should throw ConfigError if any required field is missing", () => {
      const brokenProof = { ...validProof };
      delete brokenProof.canonical_id;
      
      expect(() => validateProofFields(brokenProof)).toThrow(ConfigError);
      expect(() => validateProofFields(brokenProof)).toThrow(/missing required field: canonical_id/);
    });

    it("should throw ConfigError if oracle_address is not exactly 58 characters", () => {
      const brokenProof = { ...validProof, oracle_address: "SHORT_ADDRESS" };
      expect(() => validateProofFields(brokenProof)).toThrow(ConfigError);
    });
  });
});