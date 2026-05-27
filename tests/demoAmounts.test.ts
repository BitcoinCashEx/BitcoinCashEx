import { describe, expect, it } from "vitest";
import { bchToSats, maxBchSupplySats, satsToBch } from "../src/demo/amounts.js";

describe("demo BCH amount conversion", () => {
  it("formats sats as BCH decimal strings for BCHN raw transactions", () => {
    expect(satsToBch(0n)).toBe("0.00000000");
    expect(satsToBch(1n)).toBe("0.00000001");
    expect(satsToBch(123_456_789n)).toBe("1.23456789");
  });

  it("converts BCHN BCH values to whole satoshis", () => {
    expect(bchToSats(0)).toBe(0n);
    expect(bchToSats(0.00000001)).toBe(1n);
    expect(bchToSats(1.23456789)).toBe(123_456_789n);
  });

  it("rejects malformed BCHN BCH values before integer satoshi math", () => {
    expect(() => bchToSats(Number.NaN)).toThrow("finite");
    expect(() => bchToSats(Number.POSITIVE_INFINITY)).toThrow("finite");
    expect(() => bchToSats(-0.00000001)).toThrow("non-negative");
    expect(() => bchToSats(0.000000009)).toThrow("whole satoshis");
  });

  it("rejects values outside the valid BCH monetary range", () => {
    expect(() => satsToBch(-1n)).toThrow("valid monetary range");
    expect(() => satsToBch(maxBchSupplySats + 1n)).toThrow("valid monetary range");
    expect(() => bchToSats(21_000_000.00000001)).toThrow("valid monetary range");
  });
});
