import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";

describe("configuration validation", () => {
  it("loads safe defaults for local BCHN regtest development", () => {
    expect(loadConfig({})).toMatchObject({
      allowMainnetBroadcast: false,
      network: "regtest",
      regtestUpgrade12Active: true,
      rpc: {
        timeoutMs: 10_000,
        url: "http://127.0.0.1:18443"
      }
    });
  });

  it("accepts explicit false values for boolean safety switches", () => {
    expect(
      loadConfig({
        BCH_ALLOW_MAINNET_BROADCAST: "off",
        BCH_REGTEST_UPGRADE12_ACTIVE: "0"
      })
    ).toMatchObject({
      allowMainnetBroadcast: false,
      regtestUpgrade12Active: false
    });
  });

  it("rejects ambiguous boolean safety switches", () => {
    expect(() => loadConfig({ BCH_ALLOW_MAINNET_BROADCAST: "maybe" })).toThrow(
      "Invalid boolean environment value"
    );
  });

  it("rejects unsafe or credential-bearing BCHN RPC URLs", () => {
    expect(() => loadConfig({ BCH_RPC_URL: "file:///tmp/node" })).toThrow("http or https");
    expect(() => loadConfig({ BCH_RPC_URL: "http://user:pass@127.0.0.1:18443" })).toThrow(
      "must not include credentials"
    );
    expect(() => loadConfig({ BCH_RPC_URL: "not a url" })).toThrow("valid URL");
  });

  it("rejects invalid BCHN RPC timeout and credential values", () => {
    expect(() => loadConfig({ BCH_RPC_TIMEOUT_MS: "0" })).toThrow("between 1 and 120000");
    expect(() => loadConfig({ BCH_RPC_TIMEOUT_MS: "120001" })).toThrow("between 1 and 120000");
    expect(() => loadConfig({ BCH_RPC_TIMEOUT_MS: "10.5" })).toThrow("positive integer");
    expect(() => loadConfig({ BCH_RPC_USER: "" })).toThrow("BCH_RPC_USER");
    expect(() => loadConfig({ BCH_RPC_PASSWORD: "" })).toThrow("BCH_RPC_PASSWORD");
  });

  it("rejects malformed BCHN minimum version policy", () => {
    expect(loadConfig({ BCH_MIN_BCHN_VERSION: "30.1.0" }).minBchnVersion).toBe("30.1.0");
    expect(() => loadConfig({ BCH_MIN_BCHN_VERSION: "29" })).toThrow("semantic version");
    expect(() => loadConfig({ BCH_MIN_BCHN_VERSION: "29.x.0" })).toThrow("semantic version");
    expect(() => loadConfig({ BCH_MIN_BCHN_VERSION: "-1.0.0" })).toThrow("semantic version");
  });
});
