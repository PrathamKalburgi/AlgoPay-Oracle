# @algopayoracle/oracle-sdk

**Programmable payment oracle for Algorand.**  
Bridge any fiat payment to an on-chain action — verified by Ed25519 signature, enforced by smart contract.

```bash
npm install @algopayoracle/oracle-sdk
```

---

## What it does

When a user pays via UPI, Razorpay, Stripe, or any other gateway, your backend receives a payment event. This SDK signs that event with an oracle key, submits it to an Algorand smart contract, and the contract independently verifies the signature before executing any action.

**The contract does not trust your backend. It only trusts the cryptographic proof.**

```
Payment Gateway → Webhook → Oracle Signs → Algorand Contract → Action Executed
```

---

## Quickstart

### 30-Second Path — See a live APC-1 proof on TestNet

No integration needed. This generates a real oracle identity, signs an APC-1 credential, verifies it off-chain, anchors it on Algorand TestNet, and returns a live explorer link.

**Linux / macOS**
```bash
npm install @algopayoracle/oracle-sdk
export ORACLE_MNEMONIC="your 25 words"
npx algopay quickstart
```

**Windows (PowerShell)**
```powershell
npm install @algopayoracle/oracle-sdk
$env:ORACLE_MNEMONIC="your 25 words"
npx algopay quickstart
```

What it does, in order:
1. Derives your oracle address and Ed25519 public key from the mnemonic
2. Signs a test payment as an APC-1 credential
3. Verifies the proof off-chain (no network required)
4. Anchors the proof on Algorand TestNet
5. Returns the confirmed transaction ID and a live Lora explorer link

---

## Quick Integration

```js
const { AlgoPayClient } = require("@algopayoracle/oracle-sdk");

const client = new AlgoPayClient({
  mnemonic: process.env.ORACLE_MNEMONIC,
  network:  "testnet",
  appId:    Number(process.env.ALGO_APP_ID),
});

// Call this from any payment webhook — gateway-agnostic
const result = await client.verifyAndCommit({
  payment_id: "your_gateway_payment_id",
  amount:     100,
  currency:   "INR",
  action:     "unlock",
  provider:   "razorpay",   // optional — enables namespaced replay protection
});

console.log(result.txId);        // confirmed Algorand transaction ID
console.log(result.explorerUrl); // Lora explorer link
console.log(result.apc1);        // APC-1 standardized credential
```

---

## Core concepts

### Payment-gateway agnostic

The oracle pipeline speaks `PaymentEvent`, not Razorpay or Stripe:

```js
// This shape works from any gateway
const event = {
  payment_id: "your_gateway_id",
  amount:     100,          // integer, base currency unit
  currency:   "INR",        // ISO 4217
  action:     "unlock",     // what to trigger on-chain
  provider:   "razorpay",   // optional label
};

const result = await client.verifyAndCommit(event);
```

Adapters handle gateway-specific signature verification and normalization.
The oracle and contract have zero gateway-specific code.

### APC-1 — standardized payment credential

Every verified payment produces an APC-1 credential:

```json
{
  "apc": "1",
  "payment_id": "pay_XXXXXXX",
  "canonical_id": "razorpay:pay_XXXXXXX",
  "amount": XXX,
  "currency": "INR",
  "action": "unlock",
  "timestamp": 1714500000,
  "oracle_address": "ABCDEF...",
  "signature": "base64...",
  "chain": "algorand",
  "network": "testnet",
  "app_id": XXXXXXXXX,
  "provider": "razorpay"
}
```

APC-1 proofs are self-contained and verifiable by anyone who knows the oracle's public key.

### Trust model

- Oracle's Ed25519 public key is registered in the contract at deploy time
- The contract runs `ed25519verify_bare` on every call — no valid signature, no action
- Multiple oracles can be registered (rotation without downtime)
- `payment_id` box storage prevents replay attacks on-chain
- Proofs are time-bound — valid for 5 minutes from signing

---

## API reference

### `AlgoPayClient`

#### Constructor

```js
new AlgoPayClient({
  mnemonic,          // required — 25-word oracle account mnemonic
  network,           // "localnet" | "testnet" | "mainnet" (default: "testnet")
  appId,             // deployed AlgoPayOracle App ID (null = anchor mode)
  algod,             // optional — custom algosdk.Algodv2 instance
  indexer,           // optional — custom algosdk.Indexer instance
  explorerBase,      // optional — custom explorer URL
})
```

#### `verifyAndCommit(payment)` → `Promise<Result>`

Sign and commit a payment proof to Algorand.

```js
const result = await client.verifyAndCommit({
  payment_id: "pay_XXXXXXX",
  amount:     100,
  currency:   "INR",
  action:     "unlock",
  provider:   "razorpay",
});
// result: { txId, proof, apc1, explorerUrl, verifyUrl, access_seconds }
```

#### `verifyProof(txId)` → `Promise<VerifyResult>`

Verify a proof via the Algorand indexer.

```js
const { valid, proof } = await client.verifyProof("TXID...");
```

#### `verifyProofOffchain(proof)` → `VerifyResult`

Verify a proof's Ed25519 signature without any network call.

```js
const { valid } = client.verifyProofOffchain(result.proof);
```

#### Oracle rotation

```js
await client.addOracle("ALGORAND_ADDRESS_OR_BASE64_PUBKEY");  // creator only
await client.removeOracle("...");                              // cannot remove last oracle
const registered = await client.isOracleRegistered("...");

const total = await client.getTotalVerified();
const count = await client.getOracleCount();
```

---

### `OracleSigner`

Pure Ed25519 signing — no network calls. Useful for offline signing and testing.

```js
const { OracleSigner } = require("@algopayoracle/oracle-sdk");

const signer = new OracleSigner(mnemonic);

console.log(signer.getAddress());          // Algorand address
console.log(signer.getPublicKeyBase64());  // paste into contract deploy

const proof = signer.sign({ payment_id, amount, action, currency, provider });
const valid = OracleSigner.verifyOffchain(proof);  // static, no network
```

---

### `ProofVerifier`

```js
const { ProofVerifier, createClients } = require("@algopayoracle/oracle-sdk");

const { indexer } = createClients("testnet");
const verifier    = new ProofVerifier({ indexer, network: "testnet" });

// Single txId
const result = await verifier.verifyTxn("TXID...", {
  expectedOracleAddress: "ABCDEF...",  // optional — restrict to specific oracle
  expectedAction:        "unlock",     // optional — restrict to specific action
  maxAgeSecs:            300,          // optional — default 300
});

// Batch
const results = await verifier.verifyBatch(["TXID1", "TXID2", "TXID3"]);
```

---

### Payment adapters

Adapters are optional. You can normalize any gateway's webhook payload manually.

#### Razorpay

```js
const { RazorpayAdapter } = require("@algopayoracle/oracle-sdk");

// Share orderStore with the client to enforce server-side amounts
const orderStore = new Map();
const adapter = new RazorpayAdapter({
  keyId:      process.env.RAZORPAY_KEY_ID,
  keySecret:  process.env.RAZORPAY_KEY_SECRET,
  orderStore,                                    // prevents client from spoofing amounts
});

// Server-side webhook
app.post("/webhook/razorpay", (req, res) => {
  const event = adapter.parseWebhook(req.rawBody, req.headers["x-razorpay-signature"]);
  if (!event) return res.status(401).end();
  const result = await client.verifyAndCommit(event);
  res.json({ txId: result.txId });
});

// Create order (stores amount server-side)
const order = await adapter.createOrder({ amount: 100, currency: "INR" });

// Client-side verification (amount taken from orderStore, not request body)
app.post("/verify-payment", (req, res) => {
  const event = adapter.parseClientPayment({
    razorpay_order_id:   req.body.razorpay_order_id,
    razorpay_payment_id: req.body.razorpay_payment_id,
    razorpay_signature:  req.body.razorpay_signature,
    action:              "unlock",
  });
  const result = await client.verifyAndCommit(event);
  res.json({ txId: result.txId });
});
```

#### Stripe

```js
const { StripeAdapter } = require("@algopayoracle/oracle-sdk");
// npm install stripe

const adapter = new StripeAdapter({
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  secretKey:     process.env.STRIPE_SECRET_KEY,
});

app.post("/webhook/stripe", (req, res) => {
  const event = adapter.parseWebhook(req.rawBody, req.headers["stripe-signature"]);
  if (!event) return res.status(401).end();
  const result = await client.verifyAndCommit(event);
  res.json({ txId: result.txId });
});
```

#### Custom gateway (any provider)

```js
// No adapter needed — normalize manually and call verifyAndCommit
app.post("/webhook/payu", async (req, res) => {
  // Verify PayU's signature with their method
  if (!verifyPayUSignature(req.rawBody, req.headers["x-payu-checksum"])) {
    return res.status(401).end();
  }
  const result = await client.verifyAndCommit({
    payment_id: req.body.mihpayid,
    amount:     Math.round(Number(req.body.amount)),
    currency:   "INR",
    action:     "unlock",
    provider:   "payu",
  });
  res.json({ txId: result.txId });
});
```

---

## Contract deployment

### 1. Get your oracle public key

```bash
node -e "
  const { OracleSigner } = require('@algopayoracle/oracle-sdk');
  const s = new OracleSigner(process.env.ORACLE_MNEMONIC);
  console.log('Address:', s.getAddress());
  console.log('Pubkey :', s.getPublicKeyBase64());
"
```

### 2. Compile the contract

```bash
cd contracts
algokit compile python AlgoPayOracle.py
```

### 3. Deploy via Lora

Open https://lora.algokit.io/testnet → App Lab → Create → upload the compiled ARC-32 JSON.

When prompted for `create()` args, pass the oracle's 32-byte pubkey (base64-decoded).

### 4. Fund the contract for box storage

Each payment creates a box (~33 bytes) costing ~0.01109 ALGO.
Send at least 0.1 ALGO to the contract address after deploy.

### 5. Configure environment

```env
ORACLE_MNEMONIC=your twenty five words here
ALGO_NETWORK=testnet
ALGO_APP_ID=XXXXXXXXX
ADMIN_API_KEY=your_secret_admin_key
ALLOWED_ORIGINS=https://yourdomain.com
RAZORPAY_KEY_ID=rzp_test_xxx         # optional
RAZORPAY_KEY_SECRET=your_secret      # optional
```

---

## Network configuration

### Built-in networks (AlgoNode, no API key required)

| Network   | Algod                                  | Indexer                                 |
|-----------|----------------------------------------|-----------------------------------------|
| localnet  | http://localhost:4001                  | http://localhost:8980                   |
| testnet   | https://testnet-api.algonode.cloud     | https://testnet-idx.algonode.cloud      |
| mainnet   | https://mainnet-api.algonode.cloud     | https://mainnet-idx.algonode.cloud      |

### Custom node (Nodely, PureStake, self-hosted)

```js
const { createCustomClients } = require("@algopayoracle/oracle-sdk");

const { algod, indexer } = createCustomClients({
  algodUrl:    "https://mainnet-api.nodely.dev",
  algodToken:  process.env.NODELY_TOKEN,
  indexerUrl:  "https://mainnet-idx.nodely.dev",
  indexerToken: process.env.NODELY_TOKEN,
  explorerBase: "https://lora.algokit.io/mainnet",
});

const client = new AlgoPayClient({ mnemonic, appId, algod, indexer });
```

---

## Security notes

- **Admin endpoints** — `addOracle` / `removeOracle` call on-chain contract functions. In production, these routes must be protected (API key at minimum) and should not be on the public internet. See the express-webhook example for the `requireAdmin` middleware pattern.
- **Amount trust** — Never trust `amount` from the client in the payment verify path. The `RazorpayAdapter` orderStore pattern enforces this. If you write a custom adapter, always source the amount from your server-side order record or the provider's webhook body.
- **Oracle key custody** — The oracle key is the trust anchor. Treat it like a private key: never commit to git, rotate via `addOracle` + `removeOracle` if compromised, consider multisig for mainnet.
- **Webhook body size** — Always apply a body size limit to webhook handlers. The express-webhook example enforces 512 KB.
- **CORS** — Lock `ALLOWED_ORIGINS` to your actual frontend domain before production deployment.

---

## Error handling

```js
const {
  AlgoPayError,
  InsufficientAmountError,
  ProofExpiredError,
  OracleNotRegisteredError,
  ReplayError,
  ProviderAuthError,
} = require("@algopayoracle/oracle-sdk");

try {
  await client.verifyAndCommit(event);
} catch (e) {
  if (e instanceof InsufficientAmountError) { /* amount < minimum */ }
  if (e instanceof ProviderAuthError)       { /* gateway sig check failed */ }
  if (e instanceof AlgoPayError)            { /* any SDK error */ }
}
```

---

## License

MIT
