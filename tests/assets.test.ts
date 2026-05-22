import { describe, expect, it } from "vitest";
import { bchAsset, createCashTokenAsset } from "../src/defi/assets.js";

describe("DeFi assets", () => {
  it("defines BCH with satoshi precision", () => {
    expect(bchAsset).toEqual({
      decimals: 8,
      kind: "bch",
      symbol: "BCH"
    });
  });

  it("normalizes and validates CashToken assets", () => {
    const token = createCashTokenAsset({
      category: "AA".repeat(32),
      decimals: 8,
      symbol: "TOKEN"
    });

    expect(token.category).toBe("aa".repeat(32));
    expect(token.kind).toBe("cashToken");
  });

  it("rejects malformed CashToken metadata", () => {
    expect(() => createCashTokenAsset({ category: "aa", decimals: 8, symbol: "TOKEN" })).toThrow(
      "exactly 32 bytes"
    );
    expect(() => createCashTokenAsset({ category: "AA".repeat(32), decimals: 19, symbol: "TOKEN" })).toThrow(
      "decimals"
    );
    expect(() => createCashTokenAsset({ category: "AA".repeat(32), decimals: 8, symbol: "token" })).toThrow(
      "symbol"
    );
  });
});

