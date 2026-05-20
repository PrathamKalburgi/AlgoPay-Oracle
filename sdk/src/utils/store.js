/**
 * AlgoPay Oracle — Pluggable Order Store
 *
 * Stores server-authoritative payment amounts keyed by gateway order ID.
 * This is the source of truth for what amount was agreed server-side —
 * the client cannot override it in the verify-payment path.
 *
 * CURRENT IMPLEMENTATION: In-memory (Map with TTL sweep).
 *   - Fine for single-instance deployments and hackathon demos.
 *   - Loses state on restart.
 *   - Breaks in multi-instance / horizontally scaled deployments.
 *
 * ROADMAP — swap to a persistent backend by implementing the same interface:
 *
 *   class RedisOrderStore {
 *     async set(id, data, ttlMs)  { await redis.set(id, JSON.stringify(data), "PX", ttlMs); }
 *     async get(id)               { const v = await redis.get(id); return v ? JSON.parse(v) : null; }
 *     async delete(id)            { await redis.del(id); }
 *   }
 *
 *   class PostgresOrderStore {
 *     async set(id, data, ttlMs)  { await db.query("INSERT INTO orders ..."); }
 *     async get(id)               { const r = await db.query("SELECT ..."); return r.rows[0] ?? null; }
 *     async delete(id)            { await db.query("DELETE FROM orders WHERE id=$1", [id]); }
 *   }
 *
 * Usage:
 *   const { createOrderStore } = require("./store");
 *   const store = createOrderStore();
 *   await store.set("order_123", { amount: 100, currency: "INR" });
 *   const record = await store.get("order_123");
 *   await store.delete("order_123");
 */

"use strict";

const ORDER_TTL_MS = 30 * 60 * 1000;   // 30 minutes

class InMemoryOrderStore {
  constructor(ttlMs = ORDER_TTL_MS) {
    this._map   = new Map();
    this._ttlMs = ttlMs;

    // Sweep expired entries every 10 minutes
    this._sweep = setInterval(() => {
      const now = Date.now();
      for (const [id, record] of this._map) {
        if (now - record._createdAt > this._ttlMs) this._map.delete(id);
      }
    }, 10 * 60 * 1000);

    // Don't keep the process alive just for sweeping
    if (this._sweep.unref) this._sweep.unref();
  }

  /**
   * Store an order record.
   * @param {string} id     - gateway order ID
   * @param {object} data   - { amount, currency, ... }
   */
  async set(id, data) {
    this._map.set(id, { ...data, _createdAt: Date.now() });
  }

  /**
   * Retrieve an order record without consuming it.
   * Returns null if not found or expired.
   */
  async get(id) {
    const record = this._map.get(id);
    if (!record) return null;
    if (Date.now() - record._createdAt > this._ttlMs) {
      this._map.delete(id);
      return null;
    }
    const { _createdAt, ...data } = record;
    return data;
  }

  /**
   * Retrieve and delete an order record (single-use consume).
   * Returns null if not found or expired.
   */
  async consume(id) {
    const data = await this.get(id);
    if (data) this._map.delete(id);
    return data;
  }

  /**
   * Delete an order record explicitly.
   */
  async delete(id) {
    this._map.delete(id);
  }

  /** @returns {number} current number of stored orders */
  size() { return this._map.size; }

  destroy() { clearInterval(this._sweep); }
}

/**
 * Factory — returns the configured store implementation.
 *
 * Currently always returns InMemoryOrderStore.
 * Future: detect REDIS_URL or DATABASE_URL and return the appropriate adapter.
 *
 * @returns {InMemoryOrderStore}
 */
function createOrderStore(options = {}) {
  if (process.env.REDIS_URL) {
    // TODO: return new RedisOrderStore(process.env.REDIS_URL, options);
    console.warn("[store] REDIS_URL detected but RedisOrderStore is not yet implemented — using in-memory store");
  }
  return new InMemoryOrderStore(options.ttlMs);
}

module.exports = { InMemoryOrderStore, createOrderStore };
