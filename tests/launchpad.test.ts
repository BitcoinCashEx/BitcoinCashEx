import { describe, expect, it } from "vitest";
import { createCashTokenAsset } from "../src/defi/assets.js";
import type { BondingCurveState } from "../src/defi/bondingCurve.js";
import {
  buyLaunchTokens,
  createTokenLaunch,
  graduateTokenLaunch,
  isLaunchGraduationEligible,
  remainingLaunchTokenSupply,
  sellLaunchTokens
} from "../src/defi/launchpad.js";

describe("deterministic token launch lifecycle", () => {
  const launchAsset = createCashTokenAsset({
    category: "01".repeat(32),
    decimals: 0,
    symbol: "LAUNCH"
  });

  const initialCurve: BondingCurveState = {
    currentSupply: 0n,
    maxSupply: 900_000n,
    virtualBchReserveSats: 100_000n,
    virtualTokenReserve: 1_000_000n
  };

  const createLaunch = () =>
    createTokenLaunch({
      asset: launchAsset,
      curve: initialCurve,
      feeBps: 100,
      graduationThresholdBchSats: 300_000n
    });

  it("creates, trades, reaches graduation eligibility, and graduates with conserved accounting", () => {
    const launch = createLaunch();

    expect(launch.asset).toEqual(launchAsset);
    expect(launch.status).toBe("active");
    expect(launch.bchEscrowSats).toBe(0n);
    expect(remainingLaunchTokenSupply(launch)).toBe(900_000n);
    expect(isLaunchGraduationEligible(launch)).toBe(false);

    const firstBuy = buyLaunchTokens(launch, 10_000n);
    const secondBuy = buyLaunchTokens(firstBuy.nextLaunch, 25_000n);
    const sell = sellLaunchTokens(secondBuy.nextLaunch, firstBuy.quote.tokenAmountOut / 3n);
    const finalBuy = buyLaunchTokens(sell.nextLaunch, 300_000n);
    const eligibleLaunch = finalBuy.nextLaunch;

    expect(firstBuy.quote.tokenAmountOut).toBe(90_081n);
    expect(secondBuy.quote.tokenAmountOut).toBe(167_252n);
    expect(sell.quote.tokenAmountIn).toBe(30_027n);
    expect(sell.quote.bchAmountBeforeFeeSats).toBe(5_232n);
    expect(finalBuy.quote.tokenAmountOut).toBe(538_181n);

    expect(eligibleLaunch.status).toBe("graduationEligible");
    expect(isLaunchGraduationEligible(eligibleLaunch)).toBe(true);
    expect(eligibleLaunch.curve.currentSupply).toBe(765_487n);
    expect(remainingLaunchTokenSupply(eligibleLaunch)).toBe(134_513n);
    expect(eligibleLaunch.bchEscrowSats).toBe(326_418n);
    expect(eligibleLaunch.feesCollectedBchSats).toBe(3_402n);

    const boughtTokens =
      firstBuy.quote.tokenAmountOut + secondBuy.quote.tokenAmountOut + finalBuy.quote.tokenAmountOut;
    expect(eligibleLaunch.curve.currentSupply).toBe(boughtTokens - sell.quote.tokenAmountIn);
    expect(eligibleLaunch.curve.currentSupply + remainingLaunchTokenSupply(eligibleLaunch)).toBe(
      eligibleLaunch.curve.maxSupply
    );

    const netEscrow =
      firstBuy.quote.bchAmountAfterFeeSats +
      secondBuy.quote.bchAmountAfterFeeSats +
      finalBuy.quote.bchAmountAfterFeeSats -
      sell.quote.bchAmountBeforeFeeSats;
    const grossBchIn =
      firstBuy.quote.bchAmountInSats + secondBuy.quote.bchAmountInSats + finalBuy.quote.bchAmountInSats;
    expect(eligibleLaunch.bchEscrowSats).toBe(netEscrow);
    expect(eligibleLaunch.bchEscrowSats + eligibleLaunch.feesCollectedBchSats + sell.quote.bchAmountOutSats).toBe(
      grossBchIn
    );
    expect(eligibleLaunch.curve.virtualBchReserveSats - initialCurve.virtualBchReserveSats).toBe(
      eligibleLaunch.bchEscrowSats
    );
    expect(initialCurve.virtualTokenReserve - eligibleLaunch.curve.virtualTokenReserve).toBe(
      eligibleLaunch.curve.currentSupply
    );

    const initialInvariant = initialCurve.virtualBchReserveSats * initialCurve.virtualTokenReserve;
    const finalInvariant =
      eligibleLaunch.curve.virtualBchReserveSats * eligibleLaunch.curve.virtualTokenReserve;
    expect(finalInvariant).toBeGreaterThanOrEqual(initialInvariant);

    const graduation = graduateTokenLaunch(eligibleLaunch);
    expect(graduation.graduation).toEqual({
      asset: launchAsset,
      bchAmountSats: 326_418n,
      feesCollectedBchSats: 3_402n,
      finalCurve: eligibleLaunch.curve,
      tokenAmount: 134_513n
    });
    expect(graduation.nextLaunch.status).toBe("graduated");
    expect(graduation.nextLaunch.bchEscrowSats).toBe(0n);
    expect(isLaunchGraduationEligible(graduation.nextLaunch)).toBe(false);
  });

  it("rejects invalid launch transitions", () => {
    const launch = createLaunch();

    expect(() => graduateTokenLaunch(launch)).toThrow("graduation threshold");
    expect(() => sellLaunchTokens(launch, 1n)).toThrow("Sell amount cannot exceed currentSupply");
    expect(() =>
      createTokenLaunch({
        asset: launchAsset,
        curve: { ...initialCurve, currentSupply: 1n },
        feeBps: 100,
        graduationThresholdBchSats: 300_000n
      })
    ).toThrow("zero currentSupply");

    const eligibleLaunch = buyLaunchTokens(launch, 500_000n).nextLaunch;
    expect(eligibleLaunch.status).toBe("graduationEligible");
    expect(() => buyLaunchTokens(eligibleLaunch, 1n)).toThrow("active");
    expect(() => sellLaunchTokens(eligibleLaunch, 1n)).toThrow("active");

    const graduatedLaunch = graduateTokenLaunch(eligibleLaunch).nextLaunch;
    expect(() => graduateTokenLaunch(graduatedLaunch)).toThrow("already graduated");
    expect(() => buyLaunchTokens(graduatedLaunch, 1n)).toThrow("active");
  });
});
