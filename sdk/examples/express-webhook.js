/**
 * @algopayoracle/oracle-sdk — Production Express Server Example
 *
 * This is the reference implementation for integrating the SDK into a
 * production Express backend. Copy and adapt to your project.
 *
 * TWO SERVERS:
 *   Public (PORT, 0.0.0.0)         — webhooks, payment verify, proof lookup
 *   Admin  (ADMIN_PORT, 127.0.0.1) — oracle rotation, stats
 *
 * Run:
 *   node examples/express-webhook.js
 */

"use strict";
require("dotenv").config();

const express   = require("express");
const cors      = require("cors");
const rateLimit = require("express-rate-limit");
const crypto    = require("crypto");

const {
  AlgoPayClient,
  RazorpayAdapter,
  createLogger,
  createOrderStore,
} = require("../src");

// ─── Environment validation ───────────────────────────────────────────────────

const IS_PRODUCTION = process.env.NODE_ENV === "production";
const DEMO_MODE     = process.env.DEMO_MODE === "true" && !IS_PRODUCTION;

const log = createLogger("server");

function requireEnv(name) {
  const val = process.env[name];
  if (!val) { log.error(`${name} is required but not set`); process.exit(1); }
  return val;
}

requireEnv("ORACLE_MNEMONIC");
if (IS_PRODUCTION) {
  requireEnv("ADMIN_API_KEY");
  requireEnv("ALLOWED_ORIGINS");
} else {
  if (!process.env.ADMIN_API_KEY) log.warn("ADMIN_API_KEY not set — admin server unprotected");
  if (!process.env.ALGO_APP_ID)   log.warn("ALGO_APP_ID not set — running in anchor mode");
}

// ─── Oracle client ────────────────────────────────────────────────────────────

const client = new AlgoPayClient({
  mnemonic: process.env.ORACLE_MNEMONIC,
  network:  process.env.ALGO_NETWORK || "testnet",
  appId:    process.env.ALGO_APP_ID ? Number(process.env.ALGO_APP_ID) : null,
});

log.info("Oracle initialised", {
  address: client.getAddress(),
  network: process.env.ALGO_NETWORK || "testnet",
  app_id:  client.appId ?? "anchor mode",
});

// ─── Order store ──────────────────────────────────────────────────────────────
// In-memory by default. Set REDIS_URL to use Redis (see store.js for interface).

const orderStore = createOrderStore();

// ─── Razorpay adapter (optional) ──────────────────────────────────────────────

const razorpay = (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET)
  ? new RazorpayAdapter({
      keyId:      process.env.RAZORPAY_KEY_ID,
      keySecret:  process.env.RAZORPAY_KEY_SECRET,
      orderStore,   // shared so createOrder amounts are enforced in parseClientPayment
    })
  : null;

// ─── Shared middleware ─────────────────────────────────────────────────────────

const MAX_BODY = 512 * 1024;

function rawBody(req, res, next) {
  const chunks = [];
  let size = 0;
  req.on("data", chunk => {
    size += chunk.length;
    if (size > MAX_BODY) { req.destroy(); return res.status(413).json({ error: "body too large" }); }
    chunks.push(chunk);
  });
  req.on("end", () => {
    req.rawBody = Buffer.concat(chunks);
    try { req.body = JSON.parse(req.rawBody.toString()); } catch { req.body = {}; }
    next();
  });
}

function requestLogger(req, res, next) {
  req.requestId = crypto.randomUUID();
  req.log       = log.child({ requestId: req.requestId });
  const start   = Date.now();
  res.on("finish", () => {
    const level = res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info";
    req.log[level](`${req.method} ${req.path}`, { status: res.statusCode, ms: Date.now() - start });
  });
  next();
}

function requireAdminKey(req, res, next) {
  const key = process.env.ADMIN_API_KEY;
  if (!key) return res.status(503).json({ error: "ADMIN_API_KEY not configured" });
  if (req.headers["x-admin-key"] !== key) return res.status(401).json({ error: "unauthorized" });
  next();
}

function sendError(res, status, message, err, reqLog) {
  const logger = reqLog || log;
  if (err) logger.error(message, { error: err.message });
  res.status(status).json({ error: IS_PRODUCTION ? message : (err?.message || message) });
}

// ─── Rate limiters ────────────────────────────────────────────────────────────

const limiterDefault = rateLimit({
  windowMs: 60 * 1000, max: 60,
  standardHeaders: true, legacyHeaders: false,
  message: { error: "too many requests" },
});

const limiterPayment = rateLimit({
  windowMs: 60 * 1000, max: 10,   // each verify-payment triggers an on-chain tx
  standardHeaders: true, legacyHeaders: false,
  message: { error: "too many payment requests" },
});

const limiterWebhook = rateLimit({
  windowMs: 60 * 1000, max: 120,  // higher — legitimate burst from provider is possible
  standardHeaders: true, legacyHeaders: false,
  message: { error: "too many requests" },
});

// ════════════════════════════════════════════════════════════════════════════
//  PUBLIC SERVER
// ════════════════════════════════════════════════════════════════════════════

const publicApp = express();

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map(s => s.trim())
  : ["http://localhost:5173", "http://localhost:3000"];

publicApp.use(cors({ origin: allowedOrigins, methods: ["GET", "POST"] }));
publicApp.use(requestLogger);
publicApp.use(rawBody);

publicApp.get("/health", limiterDefault, async (_req, res) => {
  try {
    const status = await client.algod.status().do();
    res.json({ ok: true, network: client.network, round: Number(status["last-round"]), demo_mode: DEMO_MODE });
  } catch (e) {
    res.status(503).json({ ok: false, error: IS_PRODUCTION ? "algod unreachable" : e.message });
  }
});

publicApp.get("/oracle/info", limiterDefault, (_req, res) => {
  res.json({ address: client.getAddress(), pubkey_base64: client.getPublicKeyBase64(), network: client.network, app_id: client.appId });
});

// POST /create-order
// Step 1 of payment flow — get an order ID before opening checkout UI.
// Amount is stored server-side here and enforced in /verify-payment.
publicApp.post("/create-order", limiterPayment, async (req, res) => {
  const amount   = Math.round(Number(req.body.amount || 100));
  const currency = (req.body.currency || "INR").toUpperCase();

  if (!Number.isInteger(amount) || amount <= 0) {
    return res.status(400).json({ error: "amount must be a positive integer" });
  }

  if (razorpay) {
    try {
      // createOrder writes to orderStore internally via the shared reference
      const order = await razorpay.createOrder({ amount, currency });
      req.log.info("order created", { order_id: order.order_id, amount, provider: "razorpay" });
      return res.json({ provider: "razorpay", ...order });
    } catch (e) {
      return sendError(res, 502, "order creation failed", e, req.log);
    }
  }

  if (DEMO_MODE) {
    const order_id = `demo_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
    await orderStore.set(order_id, { amount, currency });
    req.log.info("demo order created", { order_id, amount });
    return res.json({ provider: "demo", order_id, amount, currency, key_id: null });
  }

  res.status(503).json({
    error: "no payment provider configured",
    hint:  IS_PRODUCTION ? "configure RAZORPAY_KEY_ID/SECRET" : "set DEMO_MODE=true for local dev",
  });
});

// POST /webhook/razorpay — server-to-server from Razorpay on payment.captured
publicApp.post("/webhook/razorpay", limiterWebhook, async (req, res) => {
  if (!razorpay) return res.status(503).json({ error: "Razorpay not configured" });

  const event = razorpay.parseWebhook(req.rawBody, req.headers["x-razorpay-signature"]);
  if (!event) {
    req.log.warn("webhook rejected — invalid signature");
    return res.status(401).json({ error: "invalid signature" });
  }

  req.log.info("webhook received", { payment_id: event.payment_id, amount: event.amount });

  try {
    const result = await client.verifyAndCommit(event);
    req.log.info("webhook committed", { payment_id: event.payment_id, txId: result.txId });
    res.json({ received: true, txId: result.txId });
  } catch (e) {
    sendError(res, 500, "oracle submission failed", e, req.log);
  }
});

// POST /verify-payment — frontend calls this after checkout success
// Amount is ALWAYS resolved from orderStore — never from request body.
publicApp.post("/verify-payment", limiterPayment, async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, order_id, action = "unlock" } = req.body;
  const isRazorpay = razorpay_payment_id && razorpay_signature;
  let event;

  if (isRazorpay) {
    if (!razorpay) return res.status(503).json({ success: false, error: "Razorpay not configured" });
    try {
      // parseClientPayment: verifies HMAC, resolves amount from orderStore (never client body)
      event = await razorpay.parseClientPayment({ razorpay_order_id, razorpay_payment_id, razorpay_signature, action });
    } catch (e) {
      req.log.warn("client payment rejected", { error: e.message });
      return res.status(401).json({ success: false, error: e.message });
    }
    req.log.info("Razorpay payment verified", { payment_id: event.payment_id, amount: event.amount });

  } else {
    if (!DEMO_MODE) {
      return res.status(503).json({
        success: false,
        error: IS_PRODUCTION ? "demo mode disabled in production" : "set DEMO_MODE=true",
      });
    }
    const effectiveId = razorpay_order_id || order_id;
    const record = await orderStore.consume(effectiveId);
    if (!record) return res.status(400).json({ success: false, error: "order not found or expired — call /create-order first" });

    await new Promise(r => setTimeout(r, 600));
    event = { payment_id: `demo_${Date.now()}`, amount: record.amount, currency: record.currency, action, provider: "demo" };
    req.log.info("demo payment", { amount: event.amount, action });
  }

  try {
    const result = await client.verifyAndCommit(event);
    req.log.info("payment committed on-chain", { payment_id: event.payment_id, txId: result.txId });
    res.json({ success: true, ...result });
  } catch (e) {
    sendError(res, 500, "oracle submission failed", e, req.log);
  }
});

// GET /verify-proof/:txId — frontend polls this to confirm on-chain proof
publicApp.get("/verify-proof/:txId", limiterDefault, async (req, res) => {
  try {
    const result = await client.verifyProof(req.params.txId);
    res.json(result);
  } catch (e) {
    sendError(res, 500, "verification failed", e, req.log);
  }
});

// ─── Generic gateway (any provider pattern — documented, not wired) ───────────
//
//   publicApp.post("/webhook/payu", limiterWebhook, async (req, res) => {
//     if (!verifyPayUChecksum(req.rawBody, req.headers["x-payu-checksum"])) {
//       return res.status(401).end();
//     }
//     const result = await client.verifyAndCommit({
//       payment_id: req.body.mihpayid,
//       amount:     Math.round(Number(req.body.amount)),
//       currency:   "INR",
//       action:     "unlock",
//       provider:   "payu",
//     });
//     res.json({ received: true, txId: result.txId });
//   });

// ════════════════════════════════════════════════════════════════════════════
//  ADMIN SERVER  (127.0.0.1 only)
// ════════════════════════════════════════════════════════════════════════════

const adminApp  = express();
const adminLog  = log.child({ server: "admin" });

adminApp.use(rawBody);
adminApp.use(requireAdminKey);

adminApp.get("/status", async (_req, res) => {
  const info = {
    address:     client.getAddress(),
    network:     client.network,
    app_id:      client.appId,
    demo_mode:   DEMO_MODE,
    node_env:    process.env.NODE_ENV || "development",
    order_store: { type: "in-memory", size: orderStore.size?.() ?? "unknown" },
  };
  if (client.appId) {
    try {
      info.total_verified = await client.getTotalVerified();
      info.oracle_count   = await client.getOracleCount();
    } catch (e) {
      info.contract_error = IS_PRODUCTION ? "unreachable" : e.message;
    }
  }
  res.json(info);
});

adminApp.post("/oracle/add", async (req, res) => {
  const { address } = req.body;
  if (!address) return res.status(400).json({ error: "address required" });
  try {
    const txId = await client.addOracle(address);
    adminLog.info("oracle added", { address, txId });
    res.json({ success: true, txId, added: address });
  } catch (e) {
    adminLog.error("addOracle failed", { address, error: e.message });
    res.status(500).json({ success: false, error: e.message });
  }
});

adminApp.post("/oracle/remove", async (req, res) => {
  const { address } = req.body;
  if (!address) return res.status(400).json({ error: "address required" });
  try {
    const txId = await client.removeOracle(address);
    adminLog.info("oracle removed", { address, txId });
    res.json({ success: true, txId, removed: address });
  } catch (e) {
    adminLog.error("removeOracle failed", { address, error: e.message });
    res.status(500).json({ success: false, error: e.message });
  }
});

adminApp.get("/oracle/check", async (req, res) => {
  const { address } = req.query;
  if (!address) return res.status(400).json({ error: "address query param required" });
  try {
    const registered = await client.isOracleRegistered(address);
    res.json({ address, registered });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Shutdown ─────────────────────────────────────────────────────────────────

function shutdown(signal) {
  log.info(`${signal} — shutting down`);
  orderStore.destroy?.();
  process.exit(0);
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));

// ─── Start ────────────────────────────────────────────────────────────────────

const PUBLIC_PORT = Number(process.env.PORT       || 5000);
const ADMIN_PORT  = Number(process.env.ADMIN_PORT || 5001);

publicApp.listen(PUBLIC_PORT, () => {
  log.info("Public server started", { port: PUBLIC_PORT, bind: "0.0.0.0" });
  log.info(`Razorpay: ${razorpay ? "configured" : "not configured"}`);
  log.info(`Demo mode: ${DEMO_MODE}`);
});

adminApp.listen(ADMIN_PORT, "127.0.0.1", () => {
  log.info("Admin server started", { port: ADMIN_PORT, bind: "127.0.0.1" });
  if (IS_PRODUCTION && !process.env.ADMIN_API_KEY) {
    log.error("ADMIN_API_KEY required in production");
    process.exit(1);
  }
});
