export interface PoolReserves {
  readonly assetReserve: bigint;
  readonly bchReserveSats: bigint;
}

export interface SwapQuote {
  readonly feePaid: bigint;
  readonly inputAfterFee: bigint;
  readonly outputAmount: bigint;
  readonly priceImpactBps: bigint;
}

export type SwapSide = "bchToAsset" | "assetToBch";

const feeDenominator = 10_000n;
export const basisPointsDenominator = feeDenominator;

const assertPositive = (name: string, value: bigint): void => {
  if (value <= 0n) throw new Error(`${name} must be positive.`);
};

const assertFeeBps = (feeBps: number): void => {
  if (!Number.isInteger(feeBps) || feeBps < 0 || feeBps >= Number(feeDenominator)) {
    throw new Error("feeBps must be an integer from 0 to 9999.");
  }
};

export const quoteConstantProductSwap = (
  inputAmount: bigint,
  inputReserve: bigint,
  outputReserve: bigint,
  feeBps: number
): SwapQuote => {
  assertPositive("inputAmount", inputAmount);
  assertPositive("inputReserve", inputReserve);
  assertPositive("outputReserve", outputReserve);
  assertFeeBps(feeBps);

  const feePaid = (inputAmount * BigInt(feeBps)) / feeDenominator;
  const inputAfterFee = inputAmount - feePaid;
  assertPositive("inputAfterFee", inputAfterFee);

  const outputAmount = (inputAfterFee * outputReserve) / (inputReserve + inputAfterFee);
  if (outputAmount <= 0n || outputAmount >= outputReserve) {
    throw new Error("Swap output is outside valid reserve bounds.");
  }

  const spotOutput = (inputAmount * outputReserve) / inputReserve;
  const priceImpactBps =
    spotOutput === 0n ? 0n : ((spotOutput - outputAmount) * feeDenominator) / spotOutput;

  return {
    feePaid,
    inputAfterFee,
    outputAmount,
    priceImpactBps
  };
};

export const applyConstantProductSwap = (
  reserves: PoolReserves,
  side: SwapSide,
  inputAmount: bigint,
  feeBps: number
): { readonly nextReserves: PoolReserves; readonly quote: SwapQuote } => {
  const inputReserve = side === "bchToAsset" ? reserves.bchReserveSats : reserves.assetReserve;
  const outputReserve = side === "bchToAsset" ? reserves.assetReserve : reserves.bchReserveSats;
  const quote = quoteConstantProductSwap(inputAmount, inputReserve, outputReserve, feeBps);

  const nextReserves =
    side === "bchToAsset"
      ? {
          assetReserve: reserves.assetReserve - quote.outputAmount,
          bchReserveSats: reserves.bchReserveSats + inputAmount
        }
      : {
          assetReserve: reserves.assetReserve + inputAmount,
          bchReserveSats: reserves.bchReserveSats - quote.outputAmount
        };

  const beforeInvariant = reserves.assetReserve * reserves.bchReserveSats;
  const afterInvariant = nextReserves.assetReserve * nextReserves.bchReserveSats;
  if (afterInvariant < beforeInvariant) {
    throw new Error("Swap would reduce the pool invariant.");
  }

  return { nextReserves, quote };
};
