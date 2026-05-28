import { describe, expect, it } from "vitest";
import { defaultDemoServerPort, parseDemoServerPort } from "../src/demo/serverConfig.js";

describe("demo server config", () => {
  it("loads a safe default demo server port", () => {
    expect(defaultDemoServerPort).toBe(3000);
    expect(parseDemoServerPort(undefined)).toBe(3000);
    expect(parseDemoServerPort("")).toBe(3000);
  });

  it("accepts explicit valid TCP ports", () => {
    expect(parseDemoServerPort("1")).toBe(1);
    expect(parseDemoServerPort("3001")).toBe(3001);
    expect(parseDemoServerPort("65535")).toBe(65535);
  });

  it("rejects malformed or out-of-range demo server ports", () => {
    expect(() => parseDemoServerPort("0")).toThrow("BCHEX_DEMO_PORT");
    expect(() => parseDemoServerPort("65536")).toThrow("BCHEX_DEMO_PORT");
    expect(() => parseDemoServerPort("3000abc")).toThrow("BCHEX_DEMO_PORT");
    expect(() => parseDemoServerPort("3.5")).toThrow("BCHEX_DEMO_PORT");
    expect(() => parseDemoServerPort("-1")).toThrow("BCHEX_DEMO_PORT");
  });
});
