import { describe, expect, it } from "vitest";
import {
  minimumBondingCurveOutputAfterSlippage,
  quoteBondingCurveBuy,
  quoteBondingCurveSell,
  remainingBondingCurveSupply,
  type BondingCurveState
} from "../src/defi/bondingCurve.js";

describe("bonding curve launchpad math", () => {
  const initialState: BondingCurveState = {
    currentSupply: 0n,
    maxSupply: 900_000n,
    virtualBchReserveSats: 100_000n,
    virtualTokenReserve: 1_000_000n
  };

  it("quotes buys with deterministic bigint fee and virtual reserve accounting", () => {
    const quote = quoteBondingCurveBuy(initialState, 10_000n, 100);

    expect(quote.feePaidBchSats).toBe(100n);
    expect(quote.bchAmountAfterFeeSats).toBe(9_900n);
    expect(quote.tokenAmountOut).toBe(90_081n);
    expect(quote.priceImpactBps).toBe(900n);
    expect(quote.nextState).toEqual({
      currentSupply: 90_081n,
      maxSupply: 900_000n,
      virtualBchReserveSats: 109_900n,
      virtualTokenReserve: 909_919n
    });

    const beforeInvariant = initialState.virtualBchReserveSats * initialState.virtualTokenReserve;
    const afterInvariant =
      quote.nextState.virtualBchReserveSats * quote.nextState.virtualTokenReserve;
    expect(afterInvariant).toBeGreaterThanOrEqual(beforeInvariant);
  });

  it("quotes sells without allowing supply to move below zero", () => {
    const buy = quoteBondingCurveBuy(initialState, 10_000n, 100);
    const sell = quoteBondingCurveSell(buy.nextState, 50_000n, 100);

    expect(sell.bchAmountBeforeFeeSats).toBe(5_724n);
    expect(sell.feePaidBchSats).toBe(57n);
    expect(sell.bchAmountOutSats).toBe(5_667n);
    expect(sell.priceImpactBps).toBe(520n);
    expect(sell.nextState).toEqual({
      currentSupply: 40_081n,
      maxSupply: 900_000n,
      virtualBchReserveSats: 104_176n,
      virtualTokenReserve: 959_919n
    });

    const beforeInvariant = buy.nextState.virtualBchReserveSats * buy.nextState.virtualTokenReserve;
    const afterInvariant =
      sell.nextState.virtualBchReserveSats * sell.nextState.virtualTokenReserve;
    expect(afterInvariant).toBeGreaterThanOrEqual(beforeInvariant);
  });

  it("reports remaining sale supply and slippage minimums", () => {
    const quote = quoteBondingCurveBuy(initialState, 10_000n, 100);

    expect(remainingBondingCurveSupply(quote.nextState)).toBe(809_919n);
    expect(minimumBondingCurveOutputAfterSlippage(quote.tokenAmountOut, 50)).toBe(89_630n);
  });

  it("rejects invalid state, inputs, fees, and supply bound violations", () => {
    expect(() =>
      remainingBondingCurveSupply({
        ...initialState,
        currentSupply: 2n,
        maxSupply: 1n
      })
    ).toThrow("currentSupply cannot exceed maxSupply");
    expect(() => quoteBondingCurveBuy({ ...initialState, virtualBchReserveSats: 0n }, 1n, 0)).toThrow(
      "virtualBchReserveSats must be positive"
    );
    expect(() => quoteBondingCurveBuy(initialState, 0n, 0)).toThrow("bchAmountInSats must be positive");
    expect(() => quoteBondingCurveBuy(initialState, 1n, 10_000)).toThrow("feeBps");
    expect(() =>
      quoteBondingCurveBuy({ ...initialState, virtualBchReserveSats: 1_000_000n }, 1n, 0)
    ).toThrow("Buy output is too small");
    expect(() =>
      quoteBondingCurveBuy(
        {
          ...initialState,
          currentSupply: 899_999n
        },
        100_000n,
        0
      )
    ).toThrow("Buy would exceed the max supply");
    expect(() => quoteBondingCurveSell(initialState, 1n, 0)).toThrow(
      "Sell amount cannot exceed currentSupply"
    );
  });
});
