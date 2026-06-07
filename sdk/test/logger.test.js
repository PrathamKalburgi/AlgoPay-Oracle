/**
 * SDK Unit Tests — Structured Logger
 * Proves the logger outputs pretty strings in dev, strict JSON in prod,
 * and correctly propagates child context (like request IDs).
 */

describe("SDK - Logger", () => {
  let originalEnv;
  let stdoutSpy;
  let consoleSpy;

  beforeEach(() => {
    // Save the original environment and clear the module cache
    originalEnv = process.env.NODE_ENV;
    jest.resetModules(); 
    
    // Intercept standard output to assert what the logger is printing
    stdoutSpy = jest.spyOn(process.stdout, "write").mockImplementation(() => {});
    consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    jest.restoreAllMocks();
  });

  it("DEVELOPMENT MODE: outputs colorized, human-readable strings via console.log", () => {
    process.env.NODE_ENV = "development";
    const { createLogger } = require("@algopayoracle/oracle-sdk");
    
    const log = createLogger("test_dev");
    log.info("Hello dev", { amount: 100 });

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    const output = consoleSpy.mock.calls[0][0];
    
    // Should contain the component, message, and fields formatted as strings
    expect(output).toContain("[test_dev]");
    expect(output).toContain("Hello dev");
    expect(output).toContain("amount=100");
    expect(stdoutSpy).not.toHaveBeenCalled();
  });

  it("PRODUCTION MODE: outputs strict, machine-parseable JSON via stdout", () => {
    process.env.NODE_ENV = "production";
    const { createLogger } = require("../src");
    
    const log = createLogger("test_prod");
    log.error("Database offline", { code: 500 });

    expect(stdoutSpy).toHaveBeenCalledTimes(1);
    const outputString = stdoutSpy.mock.calls[0][0];
    
    // Attempt to parse the raw string output back into JSON
    const parsed = JSON.parse(outputString);
    
    expect(parsed.level).toBe("error");
    expect(parsed.component).toBe("test_prod");
    expect(parsed.message).toBe("Database offline");
    expect(parsed.code).toBe(500);
    expect(parsed.ts).toBeDefined();
    
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it("CHILD LOGGERS: correctly merge persistent context (like request IDs)", () => {
    process.env.NODE_ENV = "production";
    const { createLogger } = require("@algopayoracle/oracle-sdk");
    
    const parentLog = createLogger("api");
    const reqLog = parentLog.child({ requestId: "REQ-999" });
    
    reqLog.info("Processing order", { orderId: "123" });

    const parsed = JSON.parse(stdoutSpy.mock.calls[0][0]);
    
    // Proves the child logger successfully merged the fixed fields with the dynamic ones
    expect(parsed.requestId).toBe("REQ-999");
    expect(parsed.orderId).toBe("123");
    expect(parsed.component).toBe("api");
  });
});