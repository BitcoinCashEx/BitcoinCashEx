import { describe, expect, it } from "vitest";
import { applyConstantProductSwap, quoteConstantProductSwap } from "../src/defi/constantProduct.js";

describe("constant product AMM math", () => {
  it("quotes swaps with integer-only fee accounting", () => {
    const quote = quoteConstantProductSwap(100_000n, 10_000_000n, 5_000_000n, 30);

    expect(quote.feePaid).toBe(300n);
    expect(quote.inputAfterFee).toBe(99_700n);
    expect(quote.outputAmount).toBeGreaterThan(0n);
    expect(quote.priceImpactBps).toBeGreaterThan(0n);
  });

  it("preserves or increases the pool invariant after a swap", () => {
    const reserves = {
      assetReserve: 5_000_000n,
      bchReserveSats: 10_000_000n
    };
    const beforeInvariant = reserves.assetReserve * reserves.bchReserveSats;
    const { nextReserves, quote } = applyConstantProductSwap(reserves, "bchToAsset", 100_000n, 30);
    const afterInvariant = nextReserves.assetReserve * nextReserves.bchReserveSats;

    expect(quote.outputAmount).toBeGreaterThan(0n);
    expect(afterInvariant).toBeGreaterThanOrEqual(beforeInvariant);
  });

  it("rejects invalid reserves, inputs, and fees", () => {
    expect(() => quoteConstantProductSwap(0n, 1n, 1n, 30)).toThrow("inputAmount must be positive");
    expect(() => quoteConstantProductSwap(1n, 0n, 1n, 30)).toThrow("inputReserve must be positive");
    expect(() => quoteConstantProductSwap(1n, 1n, 1n, 10_000)).toThrow("feeBps");
  });
});

