/**
 * SDK Unit Tests — ProofVerifier
 * Validates the verification gauntlet: structure, expiry, filters, and signature.
 */

const { ProofVerifier, OracleSigner } = require("../src");

describe("SDK - ProofVerifier", () => {
  let verifier;
  const mockProof = {
    apc: "1", payment_id: "pay_1", canonical_id: "razorpay:pay_1", provider: "razorpay",
    amount: 1000, currency: "INR", action: "unlock", timestamp: 1600000000,
    oracle_address: "MOCK_ADDR", signature: "base64"
  };

  beforeEach(() => {
    verifier = new ProofVerifier();
    // FIX: Replaced jest.mock() with jest.spyOn() so we don't break module resolution
    jest.spyOn(OracleSigner, 'verifyOffchain').mockReturnValue(true);
    jest.useFakeTimers().setSystemTime(1600000100 * 1000); // 100s after proof creation
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks(); // Cleans up the spy
  });

  describe("verifyOffchain", () => {
    it("returns valid:true for an intact proof", () => {
      const result = verifier.verifyOffchain(mockProof);
      expect(result.valid).toBe(true);
    });

    it("fails if APC version is unsupported", () => {
      const result = verifier.verifyOffchain({ ...mockProof, apc: "99" });
      expect(result.valid).toBe(false);
      expect(result.reason).toMatch(/unsupported APC version/);
    });

    it("fails if canonical_id does not correctly namespace the provider", () => {
      const result = verifier.verifyOffchain({ ...mockProof, canonical_id: "stripe:pay_1" });
      expect(result.valid).toBe(false);
      expect(result.reason).toMatch(/does not match provider/);
    });

    it("fails if proof exceeds max age", () => {
      jest.setSystemTime(1600000500 * 1000); // 500s later
      const result = verifier.verifyOffchain(mockProof, { maxAgeSecs: 300 });
      expect(result.valid).toBe(false);
      expect(result.reason).toMatch(/proof expired/);
    });

    it("fails on oracle_address or action mismatch filters", () => {
      expect(verifier.verifyOffchain(mockProof, { expectedOracleAddress: "OTHER_ADDR" }).valid).toBe(false);
      expect(verifier.verifyOffchain(mockProof, { expectedAction: "mint" }).valid).toBe(false);
    });

    it("fails if cryptographic Ed25519 verification fails", () => {
      OracleSigner.verifyOffchain.mockReturnValue(false); // Override the spy for this test
      const result = verifier.verifyOffchain(mockProof);
      expect(result.valid).toBe(false);
    });
  });

  describe("verifyTxn", () => {
    it("fetches, parses JSON note, and delegates to verifyOffchain", async () => {
      const mockIndexer = {
        lookupTransactionByID: jest.fn().mockReturnValue({
          do: jest.fn().mockResolvedValue({
            transaction: { note: Buffer.from(JSON.stringify(mockProof)).toString("base64") }
          })
        })
      };
      const networkVerifier = new ProofVerifier({ indexer: mockIndexer });
      const result = await networkVerifier.verifyTxn("TX_123");
      
      expect(result.valid).toBe(true);
      expect(result.txId).toBe("TX_123");
    });

    it("returns false if indexer throws or transaction has no note", async () => {
      const mockIndexer = {
        lookupTransactionByID: jest.fn().mockReturnValue({
          do: jest.fn().mockRejectedValue(new Error("Network down"))
        })
      };
      const result = await new ProofVerifier({ indexer: mockIndexer }).verifyTxn("TX_123");
      expect(result.valid).toBe(false);
      expect(result.reason).toMatch(/indexer lookup failed/);
    });
  });
});