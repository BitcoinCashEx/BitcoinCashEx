import { basisPointsDenominator, type SwapQuote } from "./constantProduct.js";

const assertBps = (name: string, value: number): void => {
  if (!Number.isInteger(value) || value < 0 || value >= Number(basisPointsDenominator)) {
    throw new Error(`${name} must be an integer from 0 to 9999.`);
  }
};

export const minimumAmountAfterSlippage = (amount: bigint, maxSlippageBps: number): bigint => {
  if (amount <= 0n) throw new Error("amount must be positive.");
  assertBps("maxSlippageBps", maxSlippageBps);

  return (amount * (basisPointsDenominator - BigInt(maxSlippageBps))) / basisPointsDenominator;
};

export const assertSwapMeetsMinimumOutput = (quote: SwapQuote, minimumOutput: bigint): void => {
  if (minimumOutput <= 0n) throw new Error("minimumOutput must be positive.");
  if (quote.outputAmount < minimumOutput) {
    throw new Error(`Swap output ${quote.outputAmount} is below minimum ${minimumOutput}.`);
  }
};

