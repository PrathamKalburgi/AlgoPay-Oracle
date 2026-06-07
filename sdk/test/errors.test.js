/**
 * SDK Unit Tests — Custom Error Classes
 * Proves that all custom errors properly inherit from AlgoPayError
 * and correctly format their metadata properties.
 */

const {
  AlgoPayError,
  InsufficientAmountError,
  ProofExpiredError,
  OracleNotRegisteredError,
  ReplayError,
  InvalidSignatureError,
  ConfigError,
  ProviderAuthError,
} = require("../src");

describe("SDK - Error Classes", () => {
  it("AlgoPayError: should act as the base class", () => {
    const err = new AlgoPayError("Base error", "BASE_CODE");
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("AlgoPayError");
    expect(err.message).toBe("Base error");
    expect(err.code).toBe("BASE_CODE");
  });

  it("InsufficientAmountError: should capture amount and minAmount", () => {
    const err = new InsufficientAmountError(50, 100);
    expect(err).toBeInstanceOf(AlgoPayError);
    expect(err.name).toBe("InsufficientAmountError");
    expect(err.amount).toBe(50);
    expect(err.minAmount).toBe(100);
    expect(err.message).toContain("below minimum");
  });

  it("ProofExpiredError: should calculate age correctly", () => {
    const timestamp = 1000;
    const now = 1500;
    const err = new ProofExpiredError(timestamp, now);
    expect(err).toBeInstanceOf(AlgoPayError);
    expect(err.name).toBe("ProofExpiredError");
    expect(err.timestamp).toBe(1000);
    expect(err.age).toBe(500);
    expect(err.message).toContain("500s ago");
  });

  it("OracleNotRegisteredError: should capture the address", () => {
    const err = new OracleNotRegisteredError("MOCK_ADDR");
    expect(err).toBeInstanceOf(AlgoPayError);
    expect(err.name).toBe("OracleNotRegisteredError");
    expect(err.address).toBe("MOCK_ADDR");
  });

  it("ReplayError: should capture the paymentId", () => {
    const err = new ReplayError("pay_123");
    expect(err).toBeInstanceOf(AlgoPayError);
    expect(err.name).toBe("ReplayError");
    expect(err.paymentId).toBe("pay_123");
  });

  it("InvalidSignatureError: should have fixed defaults", () => {
    const err = new InvalidSignatureError();
    expect(err).toBeInstanceOf(AlgoPayError);
    expect(err.name).toBe("InvalidSignatureError");
    expect(err.code).toBe("INVALID_SIGNATURE");
  });

  it("ConfigError: should capture custom messages", () => {
    const err = new ConfigError("Missing config");
    expect(err).toBeInstanceOf(AlgoPayError);
    expect(err.name).toBe("ConfigError");
    expect(err.message).toBe("Missing config");
  });

  it("ProviderAuthError: should capture provider and reason", () => {
    const err = new ProviderAuthError("razorpay", "bad hash");
    expect(err).toBeInstanceOf(AlgoPayError);
    expect(err.name).toBe("ProviderAuthError");
    expect(err.provider).toBe("razorpay");
    expect(err.message).toContain("razorpay signature verification failed: bad hash");
  });
});