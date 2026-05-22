import { describe, expect, it } from "vitest";
import {
  integerSqrt,
  quoteAddLiquidity,
  quoteInitialLiquidity,
  quoteRemoveLiquidity
} from "../src/defi/liquidity.js";

describe("liquidity math", () => {
  it("calculates integer square roots without floating point", () => {
    expect(integerSqrt(0n)).toBe(0n);
    expect(integerSqrt(1n)).toBe(1n);
    expect(integerSqrt(15n)).toBe(3n);
    expect(integerSqrt(16n)).toBe(4n);
    expect(integerSqrt(17n)).toBe(4n);
  });

  it("quotes initial liquidity with locked minimum liquidity", () => {
    const quote = quoteInitialLiquidity(1_000_000n, 4_000_000n, 1_000n);

    expect(quote.lockedLiquidity).toBe(1_000n);
    expect(quote.liquidityMinted).toBe(1_999_000n);
    expect(quote.nextPool.totalLiquidity).toBe(2_000_000n);
  });

  it("quotes proportional add liquidity and refunds the excess side", () => {
    const quote = quoteAddLiquidity(
      {
        assetReserve: 1_000_000n,
        bchReserveSats: 4_000_000n,
        totalLiquidity: 2_000_000n
      },
      300_000n,
      400_000n
    );

    expect(quote.assetAmount).toBe(100_000n);
    expect(quote.bchAmountSats).toBe(400_000n);
    expect(quote.liquidityMinted).toBe(200_000n);
    expect(quote.refundAssetAmount).toBe(200_000n);
    expect(quote.refundBchSats).toBe(0n);
  });

  it("quotes remove liquidity proportionally", () => {
    const quote = quoteRemoveLiquidity(
      {
        assetReserve: 1_000_000n,
        bchReserveSats: 4_000_000n,
        totalLiquidity: 2_000_000n
      },
      500_000n
    );

    expect(quote.assetAmount).toBe(250_000n);
    expect(quote.bchAmountSats).toBe(1_000_000n);
  });
});

