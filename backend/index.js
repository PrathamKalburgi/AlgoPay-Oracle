/**
 * AlgoPay Oracle — backend
 *
 * Provider-agnostic design:
 *   Each payment provider (Razorpay, Stripe, PayU, etc.) is an "adapter"
 *   that verifies its own webhook signature, extracts a normalized
 *   PaymentEvent, and hands it to processPayment().
 *
 *   processPayment() is provider-blind — it only sees:
 *     { payment_id, amount, currency, action }
 *
 * To add a new provider: copy the Razorpay adapter block, change the
 * HMAC/signature verification, and map the webhook body to PaymentEvent.
 *
 * Env vars (.env):
 *   ORACLE_MNEMONIC       25-word Algorand mnemonic
 *   ALGO_NETWORK          localnet | testnet | mainnet  (default: localnet)
 *   ALGO_APP_ID           Deployed AlgoPayOracle App ID 
 *   RAZORPAY_KEY_ID       Razorpay test/live key ID     (for order creation)
 *   RAZORPAY_KEY_SECRET   Razorpay key secret           (for HMAC + order API)
 */

require("dotenv").config();
const express  = require("express");
const cors     = require("cors");
const crypto   = require("crypto");
const https    = require("https");
const algosdk  = require("algosdk");
const { AlgoPayOracle } = require("./oracle");

// ─── Algorand network config ───────────────────────────────────────────────
const NETWORK = process.env.ALGO_NETWORK || "localnet";

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

const net           = NETWORKS[NETWORK];
const algodClient   = new algosdk.Algodv2(net.algodToken, net.algodServer, net.algodPort);
const indexerClient = new algosdk.Indexer(net.indexerToken, net.indexerServer, net.indexerPort);

const oracle = new AlgoPayOracle(
  process.env.ORACLE_MNEMONIC,
  algodClient,
  process.env.ALGO_APP_ID ? Number(process.env.ALGO_APP_ID) : null,
);

console.log(`\n🔑 Oracle address : ${oracle.address}`);
console.log(`🌐 Network        : ${NETWORK}`);
console.log(`📋 App ID         : ${oracle.appId ?? "none (anchor mode)"}`);
console.log(`📦 Oracle pubkey  : ${oracle.getPublicKeyBase64()}\n`);

// ─── Express ───────────────────────────────────────────────────────────────
const app = express();
app.use(cors());

// Raw body buffer — required for HMAC verification on all webhook endpoints
app.use((req, _res, next) => {
  const chunks = [];
  req.on("data", c => chunks.push(c));
  req.on("end", () => {
    req.rawBody = Buffer.concat(chunks);
    try { req.body = JSON.parse(req.rawBody.toString()); } catch { req.body = {}; }
    next();
  });
});

// ─── Core oracle logic (provider-agnostic) ─────────────────────────────────
/**
 * @typedef {{ payment_id: string, amount: number, currency: string, action: string }} PaymentEvent
 */
async function processPayment({ payment_id, amount, currency = "INR", action = "unlock" }) {
  const signedProof = oracle.signProof({ payment_id, amount, currency, action });
  const txId        = await oracle.submitProof(signedProof);
  return {
    txId,
    proof:       signedProof,
    explorerUrl: `${net.explorerBase}/transaction/${txId}`,
  };
}

// ─── Razorpay helper: create a test order ─────────────────────────────────
// Returns a Razorpay order_id that the frontend passes to Razorpay Checkout.
function createRazorpayOrder(amountPaise, currency = "INR") {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ amount: amountPaise, currency, receipt: "algopay_" + Date.now() });
    const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64");

    const req = https.request({
      hostname: "api.razorpay.com",
      path:     "/v1/orders",
      method:   "POST",
      headers:  { "Content-Type": "application/json", Authorization: `Basic ${auth}` },
    }, res => {
      let data = "";
      res.on("data", c => (data += c));
      res.on("end", () => {
        try { resolve(JSON.parse(data)); } catch { reject(new Error("Razorpay order parse error")); }
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

// ══════════════════════════════════════════════════════════════════════════
//  ROUTES
// ══════════════════════════════════════════════════════════════════════════

// GET /oracle/pubkey
app.get("/oracle/pubkey", (_req, res) => {
  res.json({
    address:       oracle.address,
    pubkey_base64: oracle.getPublicKeyBase64(),
    network:       NETWORK,
    app_id:        oracle.appId,
  });
});

// GET /health
app.get("/health", async (_req, res) => {
  try {
    const status = await algodClient.status().do();
    res.json({ ok: true, network: NETWORK, round: Number(status["last-round"]) });
  } catch (err) {
    res.status(503).json({ ok: false, error: err.message });
  }
});

// ── POST /create-order ─────────────────────────────────────────────────────
// Frontend calls this to get a Razorpay order_id before opening Checkout.
// Pattern works for any provider that needs a server-side order creation step.
app.post("/create-order", async (req, res) => {
  const { amount = 100, currency = "INR" } = req.body;

  if (!process.env.RAZORPAY_KEY_ID) {
    // Demo mode — return a fake order so frontend still works without Razorpay keys
    return res.json({
      provider:  "demo",
      order_id:  "demo_order_" + Date.now(),
      amount,
      currency,
      key_id:    null,
    });
  }

  try {
    const order = await createRazorpayOrder(amount * 100, currency); // paise
    res.json({
      provider:  "razorpay",
      order_id:  order.id,
      amount,
      currency,
      key_id:    process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /webhook/razorpay ──────────────────────────────────────────────────
// PROVIDER ADAPTER: Razorpay
//
// Razorpay sends payment.captured events here. We:
//   1. Verify HMAC-SHA256 signature (X-Razorpay-Signature header)
//   2. Extract PaymentEvent from webhook body
//   3. Hand off to provider-agnostic processPayment()
//
// To add Stripe: copy this block, replace HMAC with stripe.webhooks.constructEvent()
// To add PayU: verify PayU hash, map payment entity to PaymentEvent
app.post("/webhook/razorpay", async (req, res) => {
  const secret    = process.env.RAZORPAY_KEY_SECRET;
  const signature = req.headers["x-razorpay-signature"];

  if (secret && signature) {
    const expected = crypto
      .createHmac("sha256", secret)
      .update(req.rawBody)
      .digest("hex");
    if (expected !== signature) {
      console.warn("⚠️  Razorpay: invalid HMAC");
      return res.status(401).json({ error: "invalid signature" });
    }
  }

  const event   = req.body;
  const payment = event?.payload?.payment?.entity;
  if (event?.event !== "payment.captured" || !payment) {
    return res.status(200).json({ ignored: true });
  }

  // Normalize to PaymentEvent
  const paymentEvent = {
    payment_id: payment.id,
    amount:     Math.round(payment.amount / 100),  // paise → rupees (integer)
    currency:   payment.currency || "INR",
    action:     "unlock",
  };

  console.log(`\n📥 Razorpay webhook: ${paymentEvent.payment_id}  ₹${paymentEvent.amount}`);
  try {
    const result = await processPayment(paymentEvent);
    console.log(`   ✅ txId=${result.txId}`);
    res.status(200).json({ received: true, txId: result.txId });
  } catch (err) {
    console.error("   ❌", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /verify-payment ───────────────────────────────────────────────────
// PROVIDER ADAPTER: Razorpay client-side verification
//
// After Razorpay Checkout succeeds on the frontend, it returns:
//   razorpay_order_id, razorpay_payment_id, razorpay_signature
//
// We verify the Razorpay payment signature, then call processPayment().
// In demo mode (no keys), we skip Razorpay verification entirely.
app.post("/verify-payment", async (req, res) => {
  const {
    amount         = 100,
    currency       = "INR",
    action         = "unlock",
    payment_id,
    // Razorpay client-side fields (present when coming from real Checkout)
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
  } = req.body;

  const isRazorpayPayment = razorpay_payment_id && razorpay_order_id && razorpay_signature;

  if (isRazorpayPayment && process.env.RAZORPAY_KEY_SECRET) {
    // Verify Razorpay client-side payment signature
    const expected = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (expected !== razorpay_signature) {
      console.warn("⚠️  Razorpay payment: invalid signature");
      return res.status(401).json({ success: false, message: "invalid Razorpay signature" });
    }
    console.log(`\n💳 Razorpay payment verified: ${razorpay_payment_id}`);
  } else {
    // Demo mode — simulate UPI round-trip
    console.log(`\n💰 Demo payment  ₹${amount}  action=${action}`);
    console.log("   [1/3] Verifying Payment...");
    await new Promise(r => setTimeout(r, 800));
    console.log("   [1/3] ✅ UPI verified");
    console.log("Incoming amount:", amount);
  }

  const pid = razorpay_payment_id || payment_id || "UPI_" + Date.now() + "_" + Math.floor(Math.random() * 9999);

  console.log("   [2/3] Oracle signing + submitting proof...");
  let result;
  try {
    result = await processPayment({ payment_id: pid, amount, currency, action });
    console.log(`   [2/3] ✅ txId=${result.txId}`);
  } catch (err) {
    console.error("   [2/3] ❌", err.message);
    return res.json({ success: false, message: err.message });
  }

  console.log("   [3/3] ✅ Proof returned to frontend");
  res.json({
    success:        true,
    payment_id:     pid,
    txId:           result.txId,
    proof:          result.proof,
    explorerUrl:    result.explorerUrl,
    verifyUrl:      `/verify-proof/${result.txId}`,
    access_seconds: 300,
  });
});

// ── POST /trigger-action ───────────────────────────────────────────────────
// Decouple payment verification from on-chain action dispatch.
app.post("/trigger-action", async (req, res) => {
  const { payment_id, amount, currency = "INR", action } = req.body;
  if (!payment_id || !action) {
    return res.status(400).json({ error: "payment_id and action are required" });
  }
  try {
    const result = await processPayment({ payment_id, amount, currency, action });
    res.json({ success: true, txId: result.txId, explorerUrl: result.explorerUrl });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /verify-proof/:txId ────────────────────────────────────────────────
app.get("/verify-proof/:txId", async (req, res) => {
  try {
    const result = await AlgoPayOracle.verifyProofTxn(req.params.txId, indexerClient);
    res.json(result);
  } catch (err) {
    res.status(500).json({ valid: false, reason: err.message });
  }
});

// ─── Start ─────────────────────────────────────────────────────────────────
app.listen(5000, () => {
  console.log("🚀 AlgoPay Oracle  →  http://localhost:5000");
  console.log("   GET  /oracle/pubkey");
  console.log("   GET  /health");
  console.log("   POST /create-order        ← get Razorpay order_id");
  console.log("   POST /webhook/razorpay    ← Razorpay server webhook");
  console.log("   POST /verify-payment      ← Razorpay client verify / demo");
  console.log("   POST /trigger-action");
  console.log("   GET  /verify-proof/:txId\n");
  console.log(process.env.RAZORPAY_KEY_ID
    ? "   💳 Razorpay: LIVE (test mode)"
    : "   🔧 Razorpay: not configured (demo mode)\n");
});