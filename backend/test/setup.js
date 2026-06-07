/**
 * Global Jest Setup and Mocks
 * * This file is executed before your test suites run. It intercepts calls to external 
 * services (like the Algorand blockchain) to ensure our tests are deterministic, fast, 
 * and do not consume actual TestNet resources.
 */

const algosdk = require("algosdk");

// 1. Force the environment into test mode and inject dummy configuration
process.env.NODE_ENV = "test";
process.env.ORACLE_MNEMONIC = "word ".repeat(24) + "word"; // Valid 25-word dummy mnemonic
process.env.ALGO_APP_ID = "12345";
process.env.ADMIN_API_KEY = "test_super_secret_admin_key";
process.env.RAZORPAY_KEY_ID = "rzp_test_123";
process.env.RAZORPAY_KEY_SECRET = "test_razorpay_secret";

// 2. Deeply mock the algosdk to prevent actual blockchain I/O
jest.mock("algosdk", () => {
  const actual = jest.requireActual("algosdk");
  return {
    ...actual,
    // Mock the Algod node client
    Algodv2: jest.fn().mockImplementation(() => ({
      status: jest.fn().mockReturnValue({
        do: jest.fn().mockResolvedValue({ "last-round": 10000 })
      }),
      getTransactionParams: jest.fn().mockReturnValue({
        do: jest.fn().mockResolvedValue({ minFee: 1000 })
      }),
      sendRawTransaction: jest.fn().mockReturnValue({
        do: jest.fn().mockResolvedValue({ txid: "MOCK_ANCHOR_TXID" })
      }),
      getApplicationByID: jest.fn().mockReturnValue({
        do: jest.fn().mockResolvedValue({
          params: { "global-state": [] } // Mock empty global state for contract reads
        })
      })
    })),
    // Mock the Indexer client for verification lookups
    Indexer: jest.fn().mockImplementation(() => ({
      lookupTransactionByID: jest.fn().mockReturnValue({
        do: jest.fn().mockResolvedValue({
          transaction: {
            note: Buffer.from(JSON.stringify({
              apc: "1",
              payment_id: "pay_test",
              canonical_id: "razorpay:pay_test",
              amount: 500,
              currency: "INR",
              action: "unlock",
              // FIX: Generate a fresh timestamp every time the test runs so the verifier doesn't reject it!
              timestamp: Math.floor(Date.now() / 1000), 
              oracle_address: "A".repeat(58),
              signature: "base64sig"
            })).toString("base64")
          }
        })
      })
    })),
    // Mock cryptographic functions for deterministic output
    mnemonicToSecretKey: jest.fn(() => ({ addr: "MOCK_ORACLE_ADDR", sk: new Uint8Array(64) })),
    decodeAddress: jest.fn(() => ({ publicKey: new Uint8Array(32) })),
    verifyBytes: jest.fn().mockReturnValue(true), // Force Ed25519 verifications to pass
    
    // Mock the ATC used for smart contract interactions
    AtomicTransactionComposer: jest.fn().mockImplementation(() => ({
      addMethodCall: jest.fn(),
      execute: jest.fn().mockResolvedValue({ txIDs: ["TX1", "TX2", "TX3", "MOCK_CONTRACT_TXID"] })
    }))
  };
});