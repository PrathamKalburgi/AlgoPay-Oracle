/**
 * AlgoPay Oracle — Structured Logger
 *
 * Outputs JSON in production (machine-parseable, ingestible by Datadog/Loki/CloudWatch).
 * Outputs pretty-printed lines in development.
 *
 * Every log entry carries a requestId so a full payment flow can be traced
 * across multiple log lines: create-order → verify-payment → oracle sign → txId.
 *
 * Usage:
 *   const { createLogger, requestLogger } = require("./logger");
 *   const log = createLogger("payment");
 *   log.info("Payment received", { payment_id, amount });
 *   log.error("Oracle failed", { payment_id, error: e.message });
 *
 * Express middleware:
 *   app.use(requestLogger);   // attaches req.log and req.requestId
 *   // then in routes:
 *   req.log.info("order created", { order_id, amount });
 */

"use strict";

const crypto  = require("crypto");
const IS_PROD = process.env.NODE_ENV === "production";

// ─── Core log function ────────────────────────────────────────────────────────

function write(level, component, message, fields = {}) {
  const entry = {
    ts:        new Date().toISOString(),
    level,
    component,
    message,
    ...fields,
  };

  if (IS_PROD) {
    // JSON — one line per entry, ready for log aggregators
    process.stdout.write(JSON.stringify(entry) + "\n");
  } else {
    // Human-readable dev format
    const color = { info: "\x1b[32m", warn: "\x1b[33m", error: "\x1b[31m", debug: "\x1b[90m" };
    const reset = "\x1b[0m";
    const c     = color[level] || "";
    const meta  = Object.keys(fields).length
      ? "  " + Object.entries(fields).map(([k, v]) => `${k}=${v}`).join("  ")
      : "";
    console.log(`${c}[${entry.ts}] ${level.toUpperCase().padEnd(5)} [${component}] ${message}${meta}${reset}`);
  }
}

// ─── Logger factory ───────────────────────────────────────────────────────────

function createLogger(component) {
  return {
    info:  (msg, fields) => write("info",  component, msg, fields),
    warn:  (msg, fields) => write("warn",  component, msg, fields),
    error: (msg, fields) => write("error", component, msg, fields),
    debug: (msg, fields) => {
      if (!IS_PROD) write("debug", component, msg, fields);
    },
    // Returns a child logger with fixed fields merged into every entry
    child: (fixedFields) => ({
      info:  (msg, fields) => write("info",  component, msg, { ...fixedFields, ...fields }),
      warn:  (msg, fields) => write("warn",  component, msg, { ...fixedFields, ...fields }),
      error: (msg, fields) => write("error", component, msg, { ...fixedFields, ...fields }),
      debug: (msg, fields) => {
        if (!IS_PROD) write("debug", component, msg, { ...fixedFields, ...fields });
      },
    }),
  };
}

// ─── Express request logger middleware ────────────────────────────────────────

const httpLog = createLogger("http");

function requestLogger(req, res, next) {
  req.requestId = crypto.randomUUID();
  req.log       = httpLog.child({ requestId: req.requestId });

  const start = Date.now();

  res.on("finish", () => {
    const ms = Date.now() - start;
    const level = res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info";
    write(level, "http", `${req.method} ${req.path}`, {
      requestId:  req.requestId,
      status:     res.statusCode,
      ms,
    });
  });

  next();
}

module.exports = { createLogger, requestLogger };
