import { describe, expect, it } from "vitest";
import { quoteConstantProductSwap } from "../src/defi/constantProduct.js";
import { assertSwapMeetsMinimumOutput, minimumAmountAfterSlippage } from "../src/defi/slippage.js";

describe("slippage guards", () => {
  it("calculates minimum output using basis points", () => {
    expect(minimumAmountAfterSlippage(10_000n, 50)).toBe(9_950n);
  });

  it("accepts quotes above the minimum and rejects quotes below it", () => {
    const quote = quoteConstantProductSwap(100_000n, 10_000_000n, 5_000_000n, 30);

    expect(() => assertSwapMeetsMinimumOutput(quote, quote.outputAmount)).not.toThrow();
    expect(() => assertSwapMeetsMinimumOutput(quote, quote.outputAmount + 1n)).toThrow(
      "below minimum"
    );
  });
});

