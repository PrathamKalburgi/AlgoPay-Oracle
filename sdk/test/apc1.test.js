/**
 * SDK Unit Tests — APC-1 Format
 * Proves that internal signed proofs are correctly mapped to the public
 * APC-1 credential standard, and that the structure validator catches type drifts.
 */

const { 
  toAPC1, 
  validateAPC1Structure, 
  isExpired, 
  APC_VERSION 
} = require("../src");

describe("SDK - APC-1 Credential Standard", () => {

  const mockProof = {
    payment_id: "pay_xyz",
    canonical_id: "razorpay:pay_xyz",
    amount: 1000,
    currency: "INR",
    action: "mint",
    timestamp: 1600000000,
    oracle_address: "B".repeat(58),
    signature: "base64_mock_sig",
    provider: "razorpay"
  };

  describe("toAPC1 Mapping", () => {
    it("should map an internal proof to a standard APC-1 credential", () => {
      const apc1 = toAPC1(mockProof, { network: "mainnet", appId: 999 });
      
      expect(apc1.apc).toBe(APC_VERSION);
      expect(apc1.canonical_id).toBe("razorpay:pay_xyz");
      expect(apc1.chain).toBe("algorand");
      expect(apc1.network).toBe("mainnet");
      expect(apc1.app_id).toBe(999);
      expect(apc1.provider).toBe("razorpay");
    });
  });

  describe("validateAPC1Structure", () => {
    it("should return valid: true for a structurally compliant APC-1 object", () => {
      const validCred = toAPC1(mockProof, { network: "testnet" });
      const result = validateAPC1Structure(validCred);
      
      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it("should return false and stack errors for type mismatches or unsupported values", () => {
      const invalidCred = toAPC1(mockProof);
      invalidCred.amount = "1000"; // Invalid: must be an integer, not a string
      invalidCred.network = "devnet"; // Invalid: must be localnet, testnet, or mainnet
      invalidCred.apc = "2"; // Invalid: unsupported version
      
      const result = validateAPC1Structure(invalidCred);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("amount must be a positive integer");
      expect(result.errors).toContain("network must be localnet, testnet, or mainnet");
      expect(result.errors.some(e => e.includes("unsupported apc version"))).toBe(true);
    });
  });

  describe("isExpired", () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it("should return false if the proof timestamp is within the maximum age window", () => {
      const nowSeconds = 1700000000;
      jest.setSystemTime(nowSeconds * 1000);
      
      // Proof is 100 seconds old
      const cred = { timestamp: nowSeconds - 100 }; 
      expect(isExpired(cred, 300)).toBe(false);
    });

    it("should return true if the proof timestamp exceeds the maximum age window", () => {
      const nowSeconds = 1700000000;
      jest.setSystemTime(nowSeconds * 1000);
      
      // Proof is 301 seconds old (limit is 300)
      const cred = { timestamp: nowSeconds - 301 }; 
      expect(isExpired(cred, 300)).toBe(true);
    });
  });
});