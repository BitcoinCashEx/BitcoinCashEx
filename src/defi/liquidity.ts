import type { PoolReserves } from "./constantProduct.js";

export interface LiquidityPoolState extends PoolReserves {
  readonly totalLiquidity: bigint;
}

export interface InitialLiquidityQuote {
  readonly lockedLiquidity: bigint;
  readonly liquidityMinted: bigint;
  readonly nextPool: LiquidityPoolState;
}

export interface AddLiquidityQuote {
  readonly assetAmount: bigint;
  readonly bchAmountSats: bigint;
  readonly liquidityMinted: bigint;
  readonly refundAssetAmount: bigint;
  readonly refundBchSats: bigint;
}

export interface RemoveLiquidityQuote {
  readonly assetAmount: bigint;
  readonly bchAmountSats: bigint;
}

const assertPositive = (name: string, value: bigint): void => {
  if (value <= 0n) throw new Error(`${name} must be positive.`);
};

export const integerSqrt = (value: bigint): bigint => {
  if (value < 0n) throw new Error("Cannot calculate square root of a negative bigint.");
  if (value < 2n) return value;

  let left = 1n;
  let right = value;
  let result = 1n;

  while (left <= right) {
    const midpoint = (left + right) / 2n;
    const square = midpoint * midpoint;
    if (square === value) return midpoint;
    if (square < value) {
      result = midpoint;
      left = midpoint + 1n;
    } else {
      right = midpoint - 1n;
    }
  }

  return result;
};

export const quoteInitialLiquidity = (
  assetAmount: bigint,
  bchAmountSats: bigint,
  minimumLockedLiquidity = 1_000n
): InitialLiquidityQuote => {
  assertPositive("assetAmount", assetAmount);
  assertPositive("bchAmountSats", bchAmountSats);

  if (minimumLockedLiquidity < 0n) {
    throw new Error("minimumLockedLiquidity cannot be negative.");
  }

  const rawLiquidity = integerSqrt(assetAmount * bchAmountSats);
  if (rawLiquidity <= minimumLockedLiquidity) {
    throw new Error("Initial liquidity is too small after locked liquidity.");
  }

  return {
    liquidityMinted: rawLiquidity - minimumLockedLiquidity,
    lockedLiquidity: minimumLockedLiquidity,
    nextPool: {
      assetReserve: assetAmount,
      bchReserveSats: bchAmountSats,
      totalLiquidity: rawLiquidity
    }
  };
};

export const quoteAddLiquidity = (
  pool: LiquidityPoolState,
  desiredAssetAmount: bigint,
  desiredBchSats: bigint
): AddLiquidityQuote => {
  assertPositive("assetReserve", pool.assetReserve);
  assertPositive("bchReserveSats", pool.bchReserveSats);
  assertPositive("totalLiquidity", pool.totalLiquidity);
  assertPositive("desiredAssetAmount", desiredAssetAmount);
  assertPositive("desiredBchSats", desiredBchSats);

  const assetFromDesiredBch = (desiredBchSats * pool.assetReserve) / pool.bchReserveSats;
  const useBchAsLimit = assetFromDesiredBch <= desiredAssetAmount;

  const assetAmount = useBchAsLimit ? assetFromDesiredBch : desiredAssetAmount;
  const bchAmountSats = useBchAsLimit
    ? desiredBchSats
    : (desiredAssetAmount * pool.bchReserveSats) / pool.assetReserve;

  assertPositive("assetAmount", assetAmount);
  assertPositive("bchAmountSats", bchAmountSats);

  const liquidityFromAsset = (assetAmount * pool.totalLiquidity) / pool.assetReserve;
  const liquidityFromBch = (bchAmountSats * pool.totalLiquidity) / pool.bchReserveSats;
  const liquidityMinted = liquidityFromAsset < liquidityFromBch ? liquidityFromAsset : liquidityFromBch;
  assertPositive("liquidityMinted", liquidityMinted);

  return {
    assetAmount,
    bchAmountSats,
    liquidityMinted,
    refundAssetAmount: desiredAssetAmount - assetAmount,
    refundBchSats: desiredBchSats - bchAmountSats
  };
};

export const quoteRemoveLiquidity = (
  pool: LiquidityPoolState,
  liquidityAmount: bigint
): RemoveLiquidityQuote => {
  assertPositive("assetReserve", pool.assetReserve);
  assertPositive("bchReserveSats", pool.bchReserveSats);
  assertPositive("totalLiquidity", pool.totalLiquidity);
  assertPositive("liquidityAmount", liquidityAmount);

  if (liquidityAmount >= pool.totalLiquidity) {
    throw new Error("Cannot remove all locked pool liquidity.");
  }

  const assetAmount = (liquidityAmount * pool.assetReserve) / pool.totalLiquidity;
  const bchAmountSats = (liquidityAmount * pool.bchReserveSats) / pool.totalLiquidity;

  assertPositive("assetAmount", assetAmount);
  assertPositive("bchAmountSats", bchAmountSats);

  return {
    assetAmount,
    bchAmountSats
  };
};

