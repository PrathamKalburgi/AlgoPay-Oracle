/**
 * AlgoPay Oracle — Backend Server
 * Admin endpoints are mounted under /admin and protected by ADMIN_API_KEY.
 */

"use strict";
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const algosdk = require("algosdk");
const crypto = require("crypto");

const {
  AlgoPayClient,
  RazorpayAdapter,
  createLogger,
  requestLogger,
  createOrderStore,
  createClients,
} = require("@algopayoracle/oracle-sdk");

const log = createLogger("server");

const IS_PRODUCTION = process.env.NODE_ENV === "production";
const DEMO_MODE = process.env.DEMO_MODE === "true" && !IS_PRODUCTION;

function requireEnv(name) {
  const val = process.env[name];
  if (!val) {
    log.error(`${name} is required but not set`);
    process.exit(1);
  }
  return val;
}

requireEnv("ORACLE_MNEMONIC");

if (IS_PRODUCTION) {
  requireEnv("ADMIN_API_KEY");
  requireEnv("ALLOWED_ORIGINS");
} else {
  if (!process.env.ADMIN_API_KEY)
    log.warn("ADMIN_API_KEY not set — admin routes are unprotected");

  if (!process.env.ALGO_APP_ID)
    log.warn("ALGO_APP_ID not set — running in anchor mode");
}

const NETWORK = process.env.ALGO_NETWORK || "testnet";

// FIX APPLIED: Correctly destructure SDK clients
const {
  algod: algodClient,
  indexer: indexerClient,
  config
} = createClients(NETWORK);

const explorerBase = config.explorerBase;

const net = {
  explorerBase,
};

const oracle = new AlgoPayClient({
  mnemonic: process.env.ORACLE_MNEMONIC,
  network: NETWORK,
  appId: process.env.ALGO_APP_ID
    ? Number(process.env.ALGO_APP_ID)
    : null,
  algod: algodClient,
  indexer: indexerClient,
  explorerBase,
});

log.info("Oracle initialised", {
  address: oracle.getAddress(), // FIX APPLIED: Using correct SDK method
  network: NETWORK,
  app_id: oracle.appId ?? "anchor mode",
});

const orderStore = createOrderStore();

// ── SSE Logging Infrastructure ────────────────────────────────────────────────
const sseClients = new Set();
const MAX_LOG_HISTORY = 300;
const logHistory = [];

function broadcastLog(entry) {
  logHistory.push(entry);
  if (logHistory.length > MAX_LOG_HISTORY) logHistory.shift();

  const data = `data: ${JSON.stringify(entry)}\n\n`;
  for (const res of sseClients) {
    try { res.write(data); } catch { sseClients.delete(res); }
  }
}

// 1. Patch the main server logger
const _origInfo  = log.info.bind(log);
const _origWarn  = log.warn.bind(log);
const _origError = log.error.bind(log);

log.info  = (msg, f) => { _origInfo(msg, f);  broadcastLog({ level: "info",  msg, ...f, ts: new Date().toISOString() }); };
log.warn  = (msg, f) => { _origWarn(msg, f);  broadcastLog({ level: "warn",  msg, ...f, ts: new Date().toISOString() }); };
log.error = (msg, f) => { _origError(msg, f); broadcastLog({ level: "error", msg, ...f, ts: new Date().toISOString() }); };

// 2. Patch the child loggers (req.log) created by the SDK
if (log.child) {
  const _origChild = log.child.bind(log);
  log.child = (bindings) => {
    const cLog = _origChild(bindings);
    const _cInfo = cLog.info.bind(cLog);
    const _cWarn = cLog.warn.bind(cLog);
    const _cError = cLog.error.bind(cLog);

    cLog.info  = (msg, f) => { _cInfo(msg, f);  broadcastLog({ level: "info",  msg, ...bindings, ...f, ts: new Date().toISOString() }); };
    cLog.warn  = (msg, f) => { _cWarn(msg, f);  broadcastLog({ level: "warn",  msg, ...bindings, ...f, ts: new Date().toISOString() }); };
    cLog.error = (msg, f) => { _cError(msg, f); broadcastLog({ level: "error", msg, ...bindings, ...f, ts: new Date().toISOString() }); };
    return cLog;
  };
}

// ── Adapters ──────────────────────────────────────────────────────────────────
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
const hasRazorpay = !!(RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET);

let razorpayAdapter = null;
if (hasRazorpay) {
  razorpayAdapter = new RazorpayAdapter({
    keyId: RAZORPAY_KEY_ID,
    keySecret: RAZORPAY_KEY_SECRET,
    orderStore, 
  });
}

// ── Express Setup ─────────────────────────────────────────────────────────────
const MAX_BODY = 512 * 1024;

function rawBody(req, res, next) {
  const chunks = [];
  let size = 0;
  req.on("data", (chunk) => {
    size += chunk.length;
    if (size > MAX_BODY) {
      req.destroy();
      return res.status(413).json({ error: "body too large" });
    }
    chunks.push(chunk);
  });
  req.on("end", () => {
    req.rawBody = Buffer.concat(chunks);
    try { req.body = JSON.parse(req.rawBody.toString()); } catch { req.body = {}; }
    next();
  });
}

function requireAdminKey(req, res, next) {
  const key = process.env.ADMIN_API_KEY;
  if (!key) return res.status(503).json({ error: "ADMIN_API_KEY not configured" });

  const HMAC_KEY = "algopay-admin-compare";
  const expected = crypto.createHmac("sha256", HMAC_KEY).update(key).digest();
  const provided = crypto.createHmac("sha256", HMAC_KEY).update(req.headers["x-admin-key"] || "").digest();

  if (!crypto.timingSafeEqual(expected, provided)) {
    return res.status(401).json({ error: "unauthorized" });
  }
  next();
}

function sendError(res, status, message, err, reqLog) {
  const logger = reqLog || log;
  if (err) logger.error(message, { error: err.message });
  res.status(status).json({
    error: IS_PRODUCTION ? message : err?.message || message,
  });
}

const limiterDefault = rateLimit({ windowMs: 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false, message: { error: "too many requests" } });
const limiterPayment = rateLimit({ windowMs: 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false, message: { error: "too many payment requests" } });
const limiterWebhook = rateLimit({ windowMs: 60 * 1000, max: 120, standardHeaders: true, legacyHeaders: false, message: { error: "too many requests" } });

const publicApp = express();

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((s) => s.trim())
  : ["http://localhost:5173", "http://localhost:3000"];

publicApp.use(cors({ origin: allowedOrigins, methods: ["GET", "POST"] }));
publicApp.use(requestLogger);
publicApp.use((req, res, next) => {
  if (log.child) {
    req.log = log.child({ requestId: crypto.randomUUID() });
  }
  next();
});

publicApp.use(rawBody);

// ── Public Routes ─────────────────────────────────────────────────────────────

publicApp.get("/health", limiterDefault, async (req, res) => {
  try {
    const status = await algodClient.status().do();
    res.json({ ok: true, network: NETWORK, round: Number(status["last-round"]), demo_mode: DEMO_MODE });
  } catch (e) {
    res.status(503).json({ ok: false, error: IS_PRODUCTION ? "algod unreachable" : e.message });
  }
});

publicApp.get("/oracle/info", limiterDefault, (_req, res) => {
  res.json({
    address: oracle.getAddress(),
    pubkey_base64: oracle.getPublicKeyBase64(),
    network: NETWORK,
    app_id: oracle.appId,
  });
});

publicApp.post("/create-order", limiterPayment, async (req, res) => {
  const amount   = Math.round(Number(req.body.amount || 100));
  const currency = (req.body.currency || "INR").toUpperCase();

  if (!Number.isInteger(amount) || amount <= 0) return res.status(400).json({ error: "amount must be a positive integer" });

  if (hasRazorpay) {
    try {
      const order = await razorpayAdapter.createOrder({ amount, currency });
      if (!order || !order.id) return sendError(res, 502, "Razorpay order creation failed", null, req.log);
      req.log.info("order created", { order_id: order.id, amount, currency, provider: "razorpay" });
      return res.json({ provider: "razorpay", order_id: order.id, amount, currency, key_id: RAZORPAY_KEY_ID });
    } catch (e) {
      return sendError(res, 502, "order creation failed", e, req.log);
    }
  }

  if (DEMO_MODE) {
    const order_id = `demo_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
    await orderStore.set(order_id, { amount, currency });
    req.log.info("demo order created", { order_id, amount, currency });
    return res.json({ provider: "demo", order_id, amount, currency, key_id: null });
  }

  res.status(503).json({
    error: "no payment provider configured",
    hint:  IS_PRODUCTION ? "configure RAZORPAY_KEY_ID/SECRET" : "set DEMO_MODE=true for local dev",
  });
});

publicApp.post("/webhook/razorpay", limiterWebhook, async (req, res) => {
  if (!hasRazorpay) return res.status(503).json({ error: "Razorpay not configured" });

  const event = razorpayAdapter.parseWebhook(req.rawBody, req.headers["x-razorpay-signature"]);
  if (!event) {
    req.log.warn("webhook rejected — invalid signature");
    return res.status(401).json({ error: "invalid signature" });
  }

  req.log.info("webhook received", { payment_id: event.payment_id, amount: event.amount, currency: event.currency });

  try {
    const result = await oracle.verifyAndCommit(event);
    req.log.info("webhook committed", { payment_id: event.payment_id, txId: result.txId });
    res.json({ received: true, txId: result.txId });
  } catch (e) {
    sendError(res, 500, "oracle submission failed", e, req.log);
  }
});

publicApp.post("/verify-payment", limiterPayment, async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, order_id, action = "unlock" } = req.body;
  const isRazorpay = razorpay_payment_id && razorpay_signature;
  let event;

  if (isRazorpay) {
    if (!hasRazorpay) return res.status(503).json({ success: false, error: "Razorpay not configured" });
    try {
      event = await razorpayAdapter.parseClientPayment({ razorpay_order_id, razorpay_payment_id, razorpay_signature, action });
      if (!event) throw new Error("Invalid signature or order not found");
      req.log.info("Razorpay payment verified", { payment_id: event.payment_id, amount: event.amount });
    } catch (e) {
      req.log.warn("client payment rejected", { razorpay_payment_id, error: e.message });
      return res.status(401).json({ success: false, error: "invalid payment signature or order expired" });
    }
  } else {
    if (!DEMO_MODE) return res.status(503).json({ success: false, error: IS_PRODUCTION ? "demo mode disabled in production" : "set DEMO_MODE=true" });
    
    const effectiveId = razorpay_order_id || order_id;
    const record = await orderStore.consume(effectiveId);
    if (!record) return res.status(400).json({ success: false, error: "order not found or expired — call /create-order first" });

    await new Promise(r => setTimeout(r, 600));
    event = { payment_id: `demo_${Date.now()}`, amount: record.amount, currency: record.currency, action, provider: "demo" };
    req.log.info("demo payment", { amount: event.amount, action });
  }

  try {
    const result = await oracle.verifyAndCommit(event);
    req.log.info("payment committed on-chain", { payment_id: event.payment_id, txId: result.txId, action });
    res.json({ success: true, ...result });
  } catch (e) {
    sendError(res, 500, "oracle submission failed", e, req.log);
  }
});

// ── Dashboard Data Routes ─────────────────────────────────────────────────────

publicApp.post("/dashboard/verify-offchain", limiterDefault, (req, res) => {
  const { proof } = req.body;
  if (!proof || typeof proof !== "object") return res.status(400).json({ valid:false, reason:"body must contain a proof object" });
  try {
    const { valid, reason } = oracle.verifyProofOffchain(proof); // FIX APPLIED: Extracting detailed reason
    res.json(valid
      ? { valid: true,  proof, verified_apc_version: proof.apc || "1" }
      : { valid: false, reason: reason || "Ed25519 signature verification failed", proof }
    );
  } catch(e) {
    res.status(500).json({ valid: false, reason: e.message });
  }
});

publicApp.get("/verify-proof/:txId", limiterDefault, async (req, res) => {
  try {
    const result = await oracle.verifyProof(req.params.txId);
    res.json(result);
  } catch (e) {
    sendError(res, 500, "verification failed", e, req.log);
  }
});

publicApp.get("/dashboard/stats", limiterDefault, async (_req, res) => {
  const info = {
    oracle_address: oracle.getAddress(), // FIX APPLIED: Using getAddress()
    pubkey_base64:  oracle.getPublicKeyBase64(),
    network:        NETWORK,
    app_id:         oracle.appId,
    total_verified: 0,
    oracle_count:   0,
  };
  if (oracle.appId) {
    try {
      info.total_verified = await oracle.getTotalVerified();
      info.oracle_count   = await oracle.getOracleCount();
    } catch { /* contract may not be deployed */ }
  }
  res.json(info);
});

publicApp.get("/dashboard/transactions", limiterDefault, async (req, res) => {
  const limit = Math.min(Number(req.query.limit || 25), 100);
  try {
    // FIX APPLIED: Call oracle.getAddress() instead of undefined oracle.address
    const response = await indexerClient
      .lookupAccountTransactions(oracle.getAddress())
      .limit(limit)
      .do();

    const txns = (response.transactions || [])
      .filter(t => t.note)
      .map(t => {
        let proof = null;
        try { proof = JSON.parse(Buffer.from(t.note, "base64").toString("utf8")); } catch { return null; }
        if (!proof?.canonical_id && !proof?.payment_id) return null;
        return {
          txId:         t.id,
          round:        t["confirmed-round"],
          timestamp:    t["round-time"],
          payment_id:   proof.payment_id,
          canonical_id: proof.canonical_id || proof.payment_id,
          amount:       proof.amount,
          currency:     proof.currency || "INR",
          action:       proof.action,
          provider:     proof.provider || "unknown",
          oracle:       proof.oracle_address,
          apc_version:  proof.apc || "1",
          explorer_url: `${net.explorerBase}/transaction/${t.id}`,
        };
      }).filter(Boolean);

    res.json({ transactions: txns, count: txns.length });
  } catch (e) {
    res.json({ transactions: [], count: 0, error: e.message });
  }
});

publicApp.get("/dashboard/verify/:txId", limiterDefault, async (req, res) => {
  try {
    const result = await oracle.verifyProof(req.params.txId);
    res.json(result);
  } catch (e) {
    res.status(500).json({ valid: false, reason: e.message });
  }
});

publicApp.get("/events", (req, res) => {
  res.setHeader("Content-Type",  "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection",    "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  // Send all stored history immediately upon connection
  for (const entry of logHistory) {
    try { res.write(`data: ${JSON.stringify(entry)}\n\n`); } catch { /* ignore */ }
  }

  const heartbeat = setInterval(() => {
    try { res.write(": heartbeat\n\n"); } catch { clearInterval(heartbeat); }
  }, 15000);

  sseClients.add(res);
  log.info("SSE client connected", { total: sseClients.size });

  req.on("close", () => {
    clearInterval(heartbeat);
    sseClients.delete(res);
    log.info("SSE client disconnected", { total: sseClients.size });
  });
});


// ════════════════════════════════════════════════════════════════════════════
//  ADMIN ROUTER 
// ════════════════════════════════════════════════════════════════════════════

const adminRouter = express.Router();
const adminLog = createLogger("admin");

// Apply security middleware to ALL routes within /admin
adminRouter.use(requireAdminKey);

adminRouter.get("/status", async (_req, res) => {
  const info = {
    address:    oracle.getAddress(),
    network:    NETWORK,
    app_id:     oracle.appId,
    demo_mode:  DEMO_MODE,
    node_env:   process.env.NODE_ENV || "development",
    order_store: { type: "in-memory", size: orderStore.size() },
  };
  if (oracle.appId) {
    try {
      info.total_verified = await oracle.getTotalVerified();
      info.oracle_count   = await oracle.getOracleCount();
    } catch (e) {
      info.contract_error = IS_PRODUCTION ? "unreachable" : e.message;
    }
  }
  res.json(info);
});

adminRouter.post("/oracle/add", async (req, res) => {
  const { address } = req.body;
  if (!address) return res.status(400).json({ error: "address required" });
  try {
    const txId = await oracle.addOracle(address);
    adminLog.info("oracle added", { address, txId });
    res.json({ success: true, txId, added: address });
  } catch (e) {
    adminLog.error("addOracle failed", { address, error: e.message });
    res.status(500).json({ success: false, error: e.message });
  }
});

adminRouter.post("/oracle/remove", async (req, res) => {
  const { address } = req.body;
  if (!address) return res.status(400).json({ error: "address required" });
  try {
    const txId = await oracle.removeOracle(address);
    adminLog.info("oracle removed", { address, txId });
    res.json({ success: true, txId, removed: address });
  } catch (e) {
    adminLog.error("removeOracle failed", { address, error: e.message });
    res.status(500).json({ success: false, error: e.message });
  }
});

adminRouter.get("/oracle/check", async (req, res) => {
  const { address } = req.query;
  if (!address) return res.status(400).json({ error: "address query param required" });
  try {
    const registered = await oracle.isOracleRegistered(address);
    res.json({ address, registered });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Mount the router onto the public app
publicApp.use("/admin", adminRouter);


// ─── Graceful shutdown ────────────────────────────────────────────────────────
function shutdown(signal) {
  log.info(`${signal} received — shutting down`);
  orderStore.destroy?.();
  process.exit(0);
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));

// ─── Start ────────────────────────────────────────────────────────────────────
const PUBLIC_PORT = Number(process.env.PORT || 5000);

if (require.main === module) {
  publicApp.listen(PUBLIC_PORT, () => {
    log.info(`Server started`, { port: PUBLIC_PORT, bind: "0.0.0.0" });
    log.info(`Razorpay: ${hasRazorpay ? "configured" : "not configured"}`);
    log.info(`Demo mode: ${DEMO_MODE}`);
    log.info(`Admin auth: ${process.env.ADMIN_API_KEY ? "X-Admin-Key required" : "⚠️ no key set"}`);
    
    if (IS_PRODUCTION && !process.env.ADMIN_API_KEY) {
      log.error("ADMIN_API_KEY required in production");
      process.exit(1);
    }
  });
}

// Export the app for Supertest without binding to a port
module.exports = { publicApp };