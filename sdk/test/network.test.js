/**
 * SDK Unit Tests — Network Configurations
 */
const { createClients, createCustomClients } = require("../src");

describe("SDK - Networks", () => {
  it("should create predefined clients for testnet", () => {
    const clients = createClients("testnet");
    expect(clients.algod).toBeDefined();
    expect(clients.indexer).toBeDefined();
    expect(clients.config.explorerBase).toContain("testnet");
  });

  it("should throw error on unknown networks", () => {
    expect(() => createClients("polygon")).toThrow(/Unknown network/);
  });

  it("should successfully parse URLs for custom client generation", () => {
    const custom = createCustomClients({
      algodUrl: "https://custom-node.com:4430",
      indexerUrl: "http://custom-idx.com",
      algodToken: "token_123",
      explorerBase: "https://myexplorer.com"
    });

    expect(custom.algod).toBeDefined();
    expect(custom.indexer).toBeDefined();
    expect(custom.config.explorerBase).toBe("https://myexplorer.com");
  });
});