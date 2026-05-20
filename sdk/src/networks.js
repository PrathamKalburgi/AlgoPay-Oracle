/**
 * AlgoPay Oracle SDK — Network Configurations
 */

const algosdk = require("algosdk");

const NETWORKS = {
  localnet: {
    algodToken:    "a".repeat(64),
    algodServer:   "http://localhost",
    algodPort:     4001,
    indexerToken:  "a".repeat(64),
    indexerServer: "http://localhost",
    indexerPort:   8980,
    explorerBase:  "https://lora.algokit.io/localnet",
  },
  testnet: {
    algodToken:    "",
    algodServer:   "https://testnet-api.algonode.cloud",
    algodPort:     443,
    indexerToken:  "",
    indexerServer: "https://testnet-idx.algonode.cloud",
    indexerPort:   443,
    explorerBase:  "https://lora.algokit.io/testnet",
  },
  mainnet: {
    algodToken:    "",
    algodServer:   "https://mainnet-api.algonode.cloud",
    algodPort:     443,
    indexerToken:  "",
    indexerServer: "https://mainnet-idx.algonode.cloud",
    indexerPort:   443,
    explorerBase:  "https://lora.algokit.io/mainnet",
  },
};

/**
 * Create algod + indexer clients for a named network.
 * @param {"localnet"|"testnet"|"mainnet"} network
 * @returns {{ algod: Algodv2, indexer: Indexer, config: object }}
 */
function createClients(network) {
  const cfg = NETWORKS[network];
  if (!cfg) throw new Error(`Unknown network: ${network}. Use localnet, testnet, or mainnet.`);
  return {
    algod:   new algosdk.Algodv2(cfg.algodToken, cfg.algodServer, cfg.algodPort),
    indexer: new algosdk.Indexer(cfg.indexerToken, cfg.indexerServer, cfg.indexerPort),
    config:  cfg,
  };
}

/**
 * Create clients from custom algod/indexer URLs (e.g. nodely, purestake).
 * @param {{ algodUrl, algodToken, indexerUrl, indexerToken, explorerBase }} opts
 */
function createCustomClients({ algodUrl, algodToken = "", indexerUrl, indexerToken = "", explorerBase = "" }) {
  const algodUri   = new URL(algodUrl);
  const indexerUri = new URL(indexerUrl);
  return {
    algod:   new algosdk.Algodv2(algodToken,   algodUri.origin,   algodUri.port || 443),
    indexer: new algosdk.Indexer(indexerToken, indexerUri.origin, indexerUri.port || 443),
    config:  { explorerBase },
  };
}

module.exports = { NETWORKS, createClients, createCustomClients };
