/**
 * SDK Unit Tests — OracleSigner
 * Isolates the Ed25519 signing logic and ensures canonical_id replay protection works.
 */
const { OracleSigner, ConfigError } = require("../src");
const algosdk = require("algosdk");

jest.mock("algosdk", () => {
  const actual = jest.requireActual("algosdk");
  return {
    ...actual,
    mnemonicToSecretKey: jest.fn(() => ({ addr: "MOCK_ADDR", sk: new Uint8Array(64) })),
    decodeAddress: jest.fn(() => ({ publicKey: new Uint8Array(32) })),
    signBytes: jest.fn(() => new Uint8Array([1, 2, 3])), // Mocked signature
    verifyBytes: jest.fn(),
  };
});

describe("SDK - OracleSigner", () => {
  const MOCK_MNEMONIC = "word ".repeat(24) + "word";

  afterEach(() => jest.clearAllMocks());

  it("should throw ConfigError on missing or invalid mnemonic", () => {
    expect(() => new OracleSigner()).toThrow(ConfigError);
    
    algosdk.mnemonicToSecretKey.mockImplementationOnce(() => { throw new Error("bad"); });
    expect(() => new OracleSigner("invalid mnemonic words")).toThrow(ConfigError);
  });

  it("should properly namespace canonical_id based on provider", () => {
    const signer = new OracleSigner(MOCK_MNEMONIC);
    
    // Known provider
    const proofRazorpay = signer.sign({ payment_id: "pay_123", amount: 100, provider: "razorpay" });
    expect(proofRazorpay.canonical_id).toBe("razorpay:pay_123");

    // Unknown/Demo provider falls back to raw payment_id
    const proofDemo = signer.sign({ payment_id: "demo_456", amount: 100 });
    expect(proofDemo.canonical_id).toBe("demo_456");
  });

  it("should backdate the signature timestamp by 30 seconds for latency absorption", () => {
    jest.useFakeTimers().setSystemTime(1000000 * 1000); 
    const signer = new OracleSigner(MOCK_MNEMONIC);
    const proof = signer.sign({ payment_id: "pay_123", amount: 100 });
    
    expect(proof.timestamp).toBe(1000000 - 30);
    jest.useRealTimers();
  });

  it("verifyOffchain should return boolean based on Ed25519 signature validity", () => {
    const proof = {
      canonical_id: "razorpay:pay_123", action: "unlock", currency: "INR", 
      amount: 100, timestamp: 1600000000, app_id: 1, signature: "base64", oracle_address: "MOCK_ADDR"
    };

    algosdk.verifyBytes.mockReturnValueOnce(true);
    expect(OracleSigner.verifyOffchain(proof)).toBe(true);

    algosdk.verifyBytes.mockReturnValueOnce(false);
    expect(OracleSigner.verifyOffchain(proof)).toBe(false);
    
    // Test throwing/corrupt data fallback
    algosdk.verifyBytes.mockImplementationOnce(() => { throw new Error("Corrupt"); });
    expect(OracleSigner.verifyOffchain(proof)).toBe(false);
  });
});