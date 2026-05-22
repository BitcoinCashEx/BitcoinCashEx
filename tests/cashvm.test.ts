import { describe, expect, it } from "vitest";
import { isCashVmMay2026Active } from "../src/cashvm/capabilities.js";
import { normalizeHexBytecode } from "../src/cashvm/bytecode.js";

describe("CashVM helpers", () => {
  it("normalizes hex bytecode through libauth", () => {
    expect(normalizeHexBytecode("  51AA  ")).toBe("51aa");
  });

  it("rejects malformed bytecode", () => {
    expect(() => normalizeHexBytecode("abc")).toThrow("even-length hexadecimal");
    expect(() => normalizeHexBytecode("zz")).toThrow("even-length hexadecimal");
  });

  it("tracks the May 2026 upgrade activation by network", () => {
    expect(isCashVmMay2026Active("main", 1_778_846_399, false)).toBe(false);
    expect(isCashVmMay2026Active("main", 1_778_846_400, false)).toBe(true);
    expect(isCashVmMay2026Active("chip", 1_763_208_000, false)).toBe(true);
    expect(isCashVmMay2026Active("regtest", 0, true)).toBe(true);
  });
});

