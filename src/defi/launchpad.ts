import type { CashTokenAsset } from "./assets.js";
import {
  quoteBondingCurveBuy,
  quoteBondingCurveSell,
  remainingBondingCurveSupply,
  type BondingCurveBuyQuote,
  type BondingCurveSellQuote,
  type BondingCurveState
} from "./bondingCurve.js";

export type LaunchStatus = "active" | "graduationEligible" | "graduated";

export interface CreateTokenLaunchInput {
  readonly asset: CashTokenAsset;
  readonly curve: BondingCurveState;
  readonly feeBps: number;
  readonly graduationThresholdBchSats: bigint;
}

export interface TokenLaunchState {
  readonly asset: CashTokenAsset;
  readonly bchEscrowSats: bigint;
  readonly curve: BondingCurveState;
  readonly feeBps: number;
  readonly feesCollectedBchSats: bigint;
  readonly graduationThresholdBchSats: bigint;
  readonly initialCurve: BondingCurveState;
  readonly status: LaunchStatus;
}

export interface TokenLaunchBuyResult {
  readonly nextLaunch: TokenLaunchState;
  readonly quote: BondingCurveBuyQuote;
}

export interface TokenLaunchSellResult {
  readonly nextLaunch: TokenLaunchState;
  readonly quote: BondingCurveSellQuote;
}

export interface TokenLaunchGraduation {
  readonly asset: CashTokenAsset;
  readonly bchAmountSats: bigint;
  readonly feesCollectedBchSats: bigint;
  readonly finalCurve: BondingCurveState;
  readonly tokenAmount: bigint;
}

export interface TokenLaunchGraduationResult {
  readonly graduation: TokenLaunchGraduation;
  readonly nextLaunch: TokenLaunchState;
}

const basisPointsDenominator = 10_000;

const assertNonNegative = (name: string, value: bigint): void => {
  if (value < 0n) throw new Error(`${name} cannot be negative.`);
};

const assertPositive = (name: string, value: bigint): void => {
  if (value <= 0n) throw new Error(`${name} must be positive.`);
};

const assertBasisPoints = (name: string, value: number): void => {
  if (!Number.isInteger(value) || value < 0 || value >= basisPointsDenominator) {
    throw new Error(`${name} must be an integer from 0 to 9999.`);
  }
};

const assertCashTokenAsset = (asset: CashTokenAsset): void => {
  if (asset.kind !== "cashToken") {
    throw new Error("Launch asset must be a CashToken.");
  }
};

const assertLaunchState = (launch: TokenLaunchState): void => {
  assertCashTokenAsset(launch.asset);
  remainingBondingCurveSupply(launch.initialCurve);
  remainingBondingCurveSupply(launch.curve);
  assertNonNegative("bchEscrowSats", launch.bchEscrowSats);
  assertNonNegative("feesCollectedBchSats", launch.feesCollectedBchSats);
  assertPositive("graduationThresholdBchSats", launch.graduationThresholdBchSats);
  assertBasisPoints("feeBps", launch.feeBps);

  if (launch.initialCurve.currentSupply !== 0n) {
    throw new Error("Launch initial curve must start with zero currentSupply.");
  }
  if (launch.curve.maxSupply !== launch.initialCurve.maxSupply) {
    throw new Error("Launch curve maxSupply cannot change.");
  }
  if (
    launch.status !== "active" &&
    launch.status !== "graduationEligible" &&
    launch.status !== "graduated"
  ) {
    throw new Error("Launch status is invalid.");
  }
  if (
    launch.status === "graduationEligible" &&
    launch.bchEscrowSats < launch.graduationThresholdBchSats
  ) {
    throw new Error("Graduation-eligible launches must meet the graduation threshold.");
  }
};

const statusForEscrow = (
  bchEscrowSats: bigint,
  graduationThresholdBchSats: bigint
): LaunchStatus => (bchEscrowSats >= graduationThresholdBchSats ? "graduationEligible" : "active");

const assertActiveLaunch = (launch: TokenLaunchState): void => {
  assertLaunchState(launch);
  if (launch.status !== "active") {
    throw new Error("Launch must be active for bonding curve trades.");
  }
  if (launch.bchEscrowSats >= launch.graduationThresholdBchSats) {
    throw new Error("Launch has reached the graduation threshold.");
  }
};

export const createTokenLaunch = (input: CreateTokenLaunchInput): TokenLaunchState => {
  assertCashTokenAsset(input.asset);
  remainingBondingCurveSupply(input.curve);
  assertPositive("graduationThresholdBchSats", input.graduationThresholdBchSats);
  assertBasisPoints("feeBps", input.feeBps);

  if (input.curve.currentSupply !== 0n) {
    throw new Error("Launch curve must start with zero currentSupply.");
  }

  return {
    asset: input.asset,
    bchEscrowSats: 0n,
    curve: input.curve,
    feeBps: input.feeBps,
    feesCollectedBchSats: 0n,
    graduationThresholdBchSats: input.graduationThresholdBchSats,
    initialCurve: input.curve,
    status: "active"
  };
};

export const isLaunchGraduationEligible = (launch: TokenLaunchState): boolean => {
  assertLaunchState(launch);
  if (launch.status === "graduated") return false;

  return launch.bchEscrowSats >= launch.graduationThresholdBchSats;
};

export const remainingLaunchTokenSupply = (launch: TokenLaunchState): bigint => {
  assertLaunchState(launch);

  return remainingBondingCurveSupply(launch.curve);
};

export const buyLaunchTokens = (
  launch: TokenLaunchState,
  bchAmountInSats: bigint
): TokenLaunchBuyResult => {
  assertActiveLaunch(launch);

  const quote = quoteBondingCurveBuy(launch.curve, bchAmountInSats, launch.feeBps);
  const bchEscrowSats = launch.bchEscrowSats + quote.bchAmountAfterFeeSats;

  return {
    nextLaunch: {
      ...launch,
      bchEscrowSats,
      curve: quote.nextState,
      feesCollectedBchSats: launch.feesCollectedBchSats + quote.feePaidBchSats,
      status: statusForEscrow(bchEscrowSats, launch.graduationThresholdBchSats)
    },
    quote
  };
};

export const sellLaunchTokens = (
  launch: TokenLaunchState,
  tokenAmountIn: bigint
): TokenLaunchSellResult => {
  assertActiveLaunch(launch);

  const quote = quoteBondingCurveSell(launch.curve, tokenAmountIn, launch.feeBps);
  if (quote.bchAmountBeforeFeeSats > launch.bchEscrowSats) {
    throw new Error("Launch BCH escrow cannot cover sell output.");
  }

  const bchEscrowSats = launch.bchEscrowSats - quote.bchAmountBeforeFeeSats;

  return {
    nextLaunch: {
      ...launch,
      bchEscrowSats,
      curve: quote.nextState,
      feesCollectedBchSats: launch.feesCollectedBchSats + quote.feePaidBchSats,
      status: statusForEscrow(bchEscrowSats, launch.graduationThresholdBchSats)
    },
    quote
  };
};

export const graduateTokenLaunch = (
  launch: TokenLaunchState
): TokenLaunchGraduationResult => {
  assertLaunchState(launch);
  if (launch.status === "graduated") {
    throw new Error("Launch has already graduated.");
  }
  if (!isLaunchGraduationEligible(launch)) {
    throw new Error("Launch has not reached the graduation threshold.");
  }

  const tokenAmount = remainingBondingCurveSupply(launch.curve);
  assertPositive("tokenAmount", tokenAmount);

  return {
    graduation: {
      asset: launch.asset,
      bchAmountSats: launch.bchEscrowSats,
      feesCollectedBchSats: launch.feesCollectedBchSats,
      finalCurve: launch.curve,
      tokenAmount
    },
    nextLaunch: {
      ...launch,
      bchEscrowSats: 0n,
      status: "graduated"
    }
  };
};
