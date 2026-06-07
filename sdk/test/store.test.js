/**
 * SDK Unit Tests — InMemoryOrderStore
 * Achieves 100% branch coverage including manual deletion and factory fallbacks.
 */

const { InMemoryOrderStore, createOrderStore } = require("../src");

describe("SDK - InMemoryOrderStore", () => {
  let store;

  beforeEach(() => {
    jest.useFakeTimers();
    store = new InMemoryOrderStore(5 * 60 * 1000); 
  });

  afterEach(() => {
    store.destroy();
    jest.useRealTimers();
  });

  it("should set and get an order successfully within the TTL", async () => {
    await store.set("order_123", { amount: 500, currency: "INR" });
    const record = await store.get("order_123");
    
    expect(record).toEqual({ amount: 500, currency: "INR" });
    expect(store.size()).toBe(1);
  });

  it("should safely return null for non-existent orders", async () => {
    const record = await store.get("ghost_order");
    expect(record).toBeNull();
  });

  it("should prevent double-spends by deleting the record upon consume()", async () => {
    await store.set("order_double", { amount: 1000, currency: "USD" });
    const firstAttempt = await store.consume("order_double");
    expect(firstAttempt).toEqual({ amount: 1000, currency: "USD" });
    
    const secondAttempt = await store.consume("order_double");
    expect(secondAttempt).toBeNull();
  });

  it("should lazily expire orders if get() is called after TTL", async () => {
    await store.set("order_expire", { amount: 200, currency: "INR" });
    jest.advanceTimersByTime(6 * 60 * 1000);
    expect(await store.get("order_expire")).toBeNull(); 
  });

  it("should actively sweep and garbage collect expired orders in the background", async () => {
    await store.set("order_sweep_1", { amount: 100, currency: "INR" });
    jest.advanceTimersByTime(11 * 60 * 1000);
    expect(store.size()).toBe(0);
  });

  it("should allow explicit manual deletion of an order", async () => {
    await store.set("order_manual_delete", { amount: 100, currency: "INR" });
    await store.delete("order_manual_delete");
    expect(store.size()).toBe(0);
    expect(await store.get("order_manual_delete")).toBeNull();
  });

  describe("Factory Function - createOrderStore", () => {
    it("should warn if REDIS_URL is detected but fallback to InMemoryOrderStore", () => {
      const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
      process.env.REDIS_URL = "redis://localhost:6379";
      
      const newStore = createOrderStore();
      
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("REDIS_URL detected"));
      expect(newStore.constructor.name).toBe("InMemoryOrderStore");
      
      delete process.env.REDIS_URL;
      warnSpy.mockRestore();
      newStore.destroy();
    });
  });
});