/**
 * SDK Unit Tests — AlgoPayClient
 * Tests orchestration between Signer, Indexer, and Smart Contract ABI calls.
 */

const { AlgoPayClient, ConfigError } = require("../src");
const algosdk = require("algosdk");

jest.mock("algosdk", () => {
  const actual = jest.requireActual("algosdk");
  return {
    ...actual,
    Algodv2: jest.fn(),
    Indexer: jest.fn(),
    mnemonicToSecretKey: jest.fn(() => ({ addr: "MOCK_ADDR", sk: new Uint8Array(64) })),
    decodeAddress: jest.fn(() => ({ publicKey: new Uint8Array(32) })),
    signBytes: jest.fn(() => new Uint8Array([1,2,3])),
    makePaymentTxnWithSuggestedParamsFromObject: jest.fn(() => ({
      signTxn: jest.fn()
    })),
    waitForConfirmation: jest.fn(),
    AtomicTransactionComposer: jest.fn().mockImplementation(() => ({
      addMethodCall: jest.fn(),
      execute: jest.fn().mockResolvedValue({ txIDs: ["TX1", "TX2", "TX3", "TX_CONTRACT"] }),
      simulate: jest.fn().mockResolvedValue({ methodResults: [{ returnValue: true }] })
    })),
    makeBasicAccountTransactionSigner: jest.fn()
  };
});

describe("SDK - AlgoPayClient", () => {
  const mnemonic = "word ".repeat(24) + "word";
  
  const mockAlgod = {
    getTransactionParams: jest.fn().mockReturnValue({ do: jest.fn().mockResolvedValue({ minFee: 1000 }) }),
    sendRawTransaction: jest.fn().mockReturnValue({ do: jest.fn().mockResolvedValue({ txid: "TX_ANCHOR" }) }),
    getApplicationByID: jest.fn().mockReturnValue({ 
      do: jest.fn().mockResolvedValue({ params: { "global-state": [
        { key: Buffer.from("total_verified").toString("base64"), value: { uint: 42 } }
      ] }})
    })
  };

  afterEach(() => jest.clearAllMocks());

  it("should throw ConfigError if no mnemonic is provided", () => {
    expect(() => new AlgoPayClient({})).toThrow(ConfigError);
  });

  describe("verifyAndCommit", () => {
    it("Anchor Mode (no appId): fires a 0-ALGO self payment", async () => {
      const client = new AlgoPayClient({ mnemonic, network: "testnet", algod: mockAlgod, indexer: {} });
      const result = await client.verifyAndCommit({ payment_id: "pay_1", amount: 100 });
      
      expect(result.txId).toBe("TX_ANCHOR");
      expect(result.apc1.app_id).toBeNull();
      expect(algosdk.makePaymentTxnWithSuggestedParamsFromObject).toHaveBeenCalled();
    });

    it("Contract Mode (with appId): executes an AtomicTransactionComposer group", async () => {
      const client = new AlgoPayClient({ mnemonic, appId: 999, algod: mockAlgod, indexer: {} });
      const result = await client.verifyAndCommit({ payment_id: "pay_2", amount: 100 });
      
      expect(result.txId).toBe("TX_CONTRACT");
      expect(result.apc1.app_id).toBe(999);
      expect(algosdk.AtomicTransactionComposer).toHaveBeenCalled();
    });
  });

  describe("Smart Contract State Readers", () => {
    it("should fetch total verified from ABI global state", async () => {
      const client = new AlgoPayClient({ mnemonic, appId: 999, algod: mockAlgod, indexer: {} });
      const total = await client.getTotalVerified();
      expect(total).toBe(42);
    });

    it("should simulate an ABI call to check if an oracle is registered", async () => {
      const client = new AlgoPayClient({ mnemonic, appId: 999, algod: mockAlgod, indexer: {} });
      const isReg = await client.isOracleRegistered("MOCK_ADDR");
      expect(isReg).toBe(true);
    });
  });
});