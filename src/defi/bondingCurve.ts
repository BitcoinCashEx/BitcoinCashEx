export interface BondingCurveState {
  readonly currentSupply: bigint;
  readonly maxSupply: bigint;
  readonly virtualBchReserveSats: bigint;
  readonly virtualTokenReserve: bigint;
}

export interface BondingCurveBuyQuote {
  readonly bchAmountAfterFeeSats: bigint;
  readonly bchAmountInSats: bigint;
  readonly feePaidBchSats: bigint;
  readonly nextState: BondingCurveState;
  readonly priceImpactBps: bigint;
  readonly tokenAmountOut: bigint;
}

export interface BondingCurveSellQuote {
  readonly bchAmountBeforeFeeSats: bigint;
  readonly bchAmountOutSats: bigint;
  readonly feePaidBchSats: bigint;
  readonly nextState: BondingCurveState;
  readonly priceImpactBps: bigint;
  readonly tokenAmountIn: bigint;
}

const basisPointsDenominator = 10_000n;

const assertNonNegative = (name: string, value: bigint): void => {
  if (value < 0n) throw new Error(`${name} cannot be negative.`);
};

const assertPositive = (name: string, value: bigint): void => {
  if (value <= 0n) throw new Error(`${name} must be positive.`);
};

const assertBasisPoints = (name: string, value: number): void => {
  if (!Number.isInteger(value) || value < 0 || value >= Number(basisPointsDenominator)) {
    throw new Error(`${name} must be an integer from 0 to 9999.`);
  }
};

const assertBondingCurveState = (state: BondingCurveState): void => {
  assertNonNegative("currentSupply", state.currentSupply);
  assertPositive("maxSupply", state.maxSupply);
  assertPositive("virtualBchReserveSats", state.virtualBchReserveSats);
  assertPositive("virtualTokenReserve", state.virtualTokenReserve);

  if (state.currentSupply > state.maxSupply) {
    throw new Error("currentSupply cannot exceed maxSupply.");
  }
};

const calculatePriceImpactBps = (spotOutput: bigint, curveOutput: bigint): bigint => {
  if (spotOutput <= 0n || curveOutput >= spotOutput) return 0n;

  return ((spotOutput - curveOutput) * basisPointsDenominator) / spotOutput;
};

export const remainingBondingCurveSupply = (state: BondingCurveState): bigint => {
  assertBondingCurveState(state);

  return state.maxSupply - state.currentSupply;
};

export const quoteBondingCurveBuy = (
  state: BondingCurveState,
  bchAmountInSats: bigint,
  feeBps: number
): BondingCurveBuyQuote => {
  assertBondingCurveState(state);
  assertPositive("bchAmountInSats", bchAmountInSats);
  assertBasisPoints("feeBps", feeBps);

  const availableSupply = state.maxSupply - state.currentSupply;
  if (availableSupply <= 0n) {
    throw new Error("Bonding curve has no remaining supply.");
  }

  const feePaidBchSats = (bchAmountInSats * BigInt(feeBps)) / basisPointsDenominator;
  const bchAmountAfterFeeSats = bchAmountInSats - feePaidBchSats;
  assertPositive("bchAmountAfterFeeSats", bchAmountAfterFeeSats);

  const tokenAmountOut =
    (bchAmountAfterFeeSats * state.virtualTokenReserve) /
    (state.virtualBchReserveSats + bchAmountAfterFeeSats);

  if (tokenAmountOut <= 0n) {
    throw new Error("Buy output is too small for the current virtual reserves.");
  }
  if (tokenAmountOut > availableSupply) {
    throw new Error("Buy would exceed the max supply.");
  }
  if (tokenAmountOut >= state.virtualTokenReserve) {
    throw new Error("Buy output is outside valid virtual reserve bounds.");
  }

  const spotTokenOut =
    (bchAmountAfterFeeSats * state.virtualTokenReserve) / state.virtualBchReserveSats;
  const priceImpactBps = calculatePriceImpactBps(spotTokenOut, tokenAmountOut);

  return {
    bchAmountAfterFeeSats,
    bchAmountInSats,
    feePaidBchSats,
    nextState: {
      currentSupply: state.currentSupply + tokenAmountOut,
      maxSupply: state.maxSupply,
      virtualBchReserveSats: state.virtualBchReserveSats + bchAmountAfterFeeSats,
      virtualTokenReserve: state.virtualTokenReserve - tokenAmountOut
    },
    priceImpactBps,
    tokenAmountOut
  };
};

export const quoteBondingCurveSell = (
  state: BondingCurveState,
  tokenAmountIn: bigint,
  feeBps: number
): BondingCurveSellQuote => {
  assertBondingCurveState(state);
  assertPositive("tokenAmountIn", tokenAmountIn);
  assertBasisPoints("feeBps", feeBps);

  if (tokenAmountIn > state.currentSupply) {
    throw new Error("Sell amount cannot exceed currentSupply.");
  }

  const bchAmountBeforeFeeSats =
    (tokenAmountIn * state.virtualBchReserveSats) / (state.virtualTokenReserve + tokenAmountIn);

  if (bchAmountBeforeFeeSats <= 0n) {
    throw new Error("Sell output is too small for the current virtual reserves.");
  }
  if (bchAmountBeforeFeeSats >= state.virtualBchReserveSats) {
    throw new Error("Sell output is outside valid virtual reserve bounds.");
  }

  const feePaidBchSats = (bchAmountBeforeFeeSats * BigInt(feeBps)) / basisPointsDenominator;
  const bchAmountOutSats = bchAmountBeforeFeeSats - feePaidBchSats;
  assertPositive("bchAmountOutSats", bchAmountOutSats);

  const spotBchOutSats = (tokenAmountIn * state.virtualBchReserveSats) / state.virtualTokenReserve;
  const priceImpactBps = calculatePriceImpactBps(spotBchOutSats, bchAmountBeforeFeeSats);

  return {
    bchAmountBeforeFeeSats,
    bchAmountOutSats,
    feePaidBchSats,
    nextState: {
      currentSupply: state.currentSupply - tokenAmountIn,
      maxSupply: state.maxSupply,
      virtualBchReserveSats: state.virtualBchReserveSats - bchAmountBeforeFeeSats,
      virtualTokenReserve: state.virtualTokenReserve + tokenAmountIn
    },
    priceImpactBps,
    tokenAmountIn
  };
};

export const minimumBondingCurveOutputAfterSlippage = (
  amount: bigint,
  maxSlippageBps: number
): bigint => {
  assertPositive("amount", amount);
  assertBasisPoints("maxSlippageBps", maxSlippageBps);

  return (amount * (basisPointsDenominator - BigInt(maxSlippageBps))) / basisPointsDenominator;
};
