import { quoteConstantProductSwap } from "../defi/constantProduct.js";
import type { DemoTokenData } from "./tokenProof.js";

export const demoAmmPoolMarkerPrefix = "BCHEXAMM1";
export const demoAmmTradeMarkerType = "TRADE";
export const demoAmmTradeSides = ["BCH_TO_TOKEN", "TOKEN_TO_BCH"] as const;

export type DemoAmmTradeSide = (typeof demoAmmTradeSides)[number];

export interface DemoAmmTradeMarker {
  readonly category: string;
  readonly inputAmount: string;
  readonly outputAmount: string;
  readonly side: DemoAmmTradeSide;
  readonly type: typeof demoAmmTradeMarkerType;
}

export interface DemoAmmTradeProofInput {
  readonly category: string;
  readonly inputAmount: string;
  readonly outputAmount: string;
  readonly side: DemoAmmTradeSide;
  readonly txid: string;
}

export interface DemoAmmPoolUtxo {
  readonly active: boolean;
  readonly height: number;
  readonly scriptPubKey: string;
  readonly tokenData: DemoTokenData;
  readonly txid: string;
  readonly valueSats: string;
  readonly vout: number;
}

export interface DemoAmmPoolSummary {
  readonly bchReserveSats: string;
  readonly tokenCategory: string;
  readonly tokenReserve: string;
  readonly txid: string;
}

export interface DemoAmmTransitionAudit {
  readonly actualBchReserveSats: string;
  readonly actualTokenReserve: string;
  readonly category: string;
  readonly cashVmSpend?: {
    readonly derivedScriptPubKey?: string;
    readonly expectedScriptPubKey: string;
    readonly problems: readonly string[];
    readonly redeemScript?: string;
    readonly status: "failed" | "verified";
  };
  readonly constantProductAfter: string;
  readonly constantProductBefore: string;
  readonly expectedBchReserveSats: string;
  readonly expectedTokenReserve: string;
  readonly inputAmount: string;
  readonly nextPoolTxid: string;
  readonly outputAmount: string;
  readonly poolSpendConfirmed: boolean;
  readonly previousPoolTxid: string;
  readonly problems: readonly string[];
  readonly side: DemoAmmTradeSide;
  readonly status: "failed" | "verified";
  readonly txid: string;
}

export interface DemoAmmProofPackAuditInput {
  readonly category: string;
  readonly height: number;
  readonly previousPoolTxid: string;
  readonly problems: readonly string[];
  readonly side: DemoAmmTradeSide;
  readonly status: "failed" | "verified";
  readonly txid: string;
}

export interface DemoAmmProofPackReceipt {
  readonly auditTxids: readonly string[];
  readonly bchToTokenTxid?: string;
  readonly category?: string;
  readonly endHeight?: number;
  readonly problems: readonly string[];
  readonly startHeight?: number;
  readonly status: "failed" | "missing" | "verified";
  readonly tokenToBchTxid?: string;
}

export const demoAmmSwapFeeSats = 2_000n;
export const demoAmmTokenOutputDustSats = 1_000n;
export const demoAmmWalletChangeDustSats = 546n;

const integerAmountPattern = /^[0-9]+$/;
const tokenCategoryPattern = /^[0-9a-f]{64}$/i;

const normalizeDemoAmmPoolMarkerCategory = (category: string): string => {
  if (!tokenCategoryPattern.test(category)) {
    throw new Error("AMM pool marker category must be a 32-byte transaction id.");
  }
  return category.toLowerCase();
};

const normalizeDemoAmmTradeAmount = (amount: bigint | string, label: string): string => {
  const text = typeof amount === "bigint" ? amount.toString() : amount;
  if (!integerAmountPattern.test(text)) {
    throw new Error(`AMM trade marker ${label} amount must be an integer string.`);
  }
  return text;
};

const extractDemoAmmMarkerScriptText = (scriptHex: string): string | undefined => {
  if (!/^(?:[0-9a-f]{2})*$/i.test(scriptHex)) return undefined;
  const script = scriptHex.toLowerCase();
  if (!script.startsWith("6a")) return undefined;

  let cursor = 2;
  const opcodeHex = script.slice(cursor, cursor + 2);
  if (opcodeHex.length !== 2) return undefined;
  const opcode = Number.parseInt(opcodeHex, 16);
  cursor += 2;

  let pushLength: number;
  if (opcode <= 0x4b) {
    pushLength = opcode;
  } else if (opcode === 0x4c) {
    const lengthHex = script.slice(cursor, cursor + 2);
    if (lengthHex.length !== 2) return undefined;
    pushLength = Number.parseInt(lengthHex, 16);
    cursor += 2;
  } else {
    return undefined;
  }

  const payloadHex = script.slice(cursor, cursor + pushLength * 2);
  if (payloadHex.length !== pushLength * 2) return undefined;
  return Buffer.from(payloadHex, "hex").toString("utf8");
};

export const isDemoAmmTradeSide = (side: string): side is DemoAmmTradeSide =>
  (demoAmmTradeSides as readonly string[]).includes(side);

export const encodeDemoAmmPoolMarkerText = (category: string): string => {
  return `${demoAmmPoolMarkerPrefix}|${normalizeDemoAmmPoolMarkerCategory(category)}`;
};

export const encodeDemoAmmTradeMarkerText = (
  side: DemoAmmTradeSide,
  category: string,
  inputAmount: bigint | string,
  outputAmount: bigint | string
): string => {
  if (!isDemoAmmTradeSide(side)) {
    throw new Error("AMM trade marker side must be BCH_TO_TOKEN or TOKEN_TO_BCH.");
  }

  return [
    demoAmmPoolMarkerPrefix,
    demoAmmTradeMarkerType,
    side,
    normalizeDemoAmmPoolMarkerCategory(category),
    normalizeDemoAmmTradeAmount(inputAmount, "input"),
    normalizeDemoAmmTradeAmount(outputAmount, "output")
  ].join("|");
};

export const parseDemoAmmTradeMarkerText = (text: string): DemoAmmTradeMarker | undefined => {
  const [prefix, type, side, category, inputAmount, outputAmount, extra] = text.split("|");
  if (
    prefix !== demoAmmPoolMarkerPrefix ||
    type !== demoAmmTradeMarkerType ||
    extra !== undefined ||
    side === undefined ||
    category === undefined ||
    inputAmount === undefined ||
    outputAmount === undefined
  ) {
    return undefined;
  }
  if (!isDemoAmmTradeSide(side)) return undefined;
  if (!tokenCategoryPattern.test(category)) return undefined;
  if (!integerAmountPattern.test(inputAmount) || !integerAmountPattern.test(outputAmount)) return undefined;

  return {
    category: category.toLowerCase(),
    inputAmount,
    outputAmount,
    side,
    type
  };
};

export const parseDemoAmmTradeMarkerScript = (scriptHex: string): DemoAmmTradeMarker | undefined => {
  const text = extractDemoAmmMarkerScriptText(scriptHex);
  return text === undefined ? undefined : parseDemoAmmTradeMarkerText(text);
};

export const parseDemoAmmPoolMarkerText = (text: string): string | undefined => {
  const [prefix, category, extra] = text.split("|");
  if (prefix !== demoAmmPoolMarkerPrefix || category === undefined) return undefined;
  if (category === demoAmmTradeMarkerType) return parseDemoAmmTradeMarkerText(text)?.category;
  if (extra !== undefined) return undefined;
  if (!tokenCategoryPattern.test(category)) return undefined;
  return category.toLowerCase();
};

export const parseDemoAmmPoolMarkerScript = (scriptHex: string): string | undefined => {
  const text = extractDemoAmmMarkerScriptText(scriptHex);
  return text === undefined ? undefined : parseDemoAmmPoolMarkerText(text);
};

export function requireDemoAmmPoolTokenData(
  tokenData: DemoTokenData,
  expectedCategory?: string
): asserts tokenData is DemoTokenData & { readonly amount: string; readonly nft?: undefined } {
  if (tokenData.amount === undefined || !integerAmountPattern.test(tokenData.amount)) {
    throw new Error("AMM pool token amount must be present.");
  }
  if (tokenData.nft !== undefined) {
    throw new Error("AMM pool reserves must be fungible-only and cannot carry an NFT authority.");
  }
  if (expectedCategory !== undefined && tokenData.category.toLowerCase() !== expectedCategory.toLowerCase()) {
    throw new Error("AMM pool token category does not match the pool marker.");
  }
}

export const summarizeDemoAmmPool = (pool: DemoAmmPoolUtxo): DemoAmmPoolSummary => {
  if (!pool.active) {
    throw new Error("Cannot summarize an inactive AMM pool UTXO.");
  }
  requireDemoAmmPoolTokenData(pool.tokenData);
  if (!/^[0-9]+$/.test(pool.valueSats)) {
    throw new Error("AMM pool BCH reserve must be an integer string.");
  }

  return {
    bchReserveSats: pool.valueSats,
    tokenCategory: pool.tokenData.category,
    tokenReserve: pool.tokenData.amount,
    txid: pool.txid
  };
};

export const quoteDemoAmmBuy = (
  pool: DemoAmmPoolUtxo,
  bchAmountInSats: bigint,
  feeBps: number
) => {
  requireDemoAmmPoolTokenData(pool.tokenData);

  return quoteConstantProductSwap(
    bchAmountInSats,
    BigInt(pool.valueSats),
    BigInt(pool.tokenData.amount),
    feeBps
  );
};

export const quoteDemoAmmSell = (
  pool: DemoAmmPoolUtxo,
  tokenAmountIn: bigint,
  feeBps: number
) => {
  requireDemoAmmPoolTokenData(pool.tokenData);

  return quoteConstantProductSwap(
    tokenAmountIn,
    BigInt(pool.tokenData.amount),
    BigInt(pool.valueSats),
    feeBps
  );
};

export const auditDemoAmmTradeTransition = ({
  nextPool,
  poolSpendConfirmed,
  previousPool,
  tokenToBchPoolFeeSats = demoAmmSwapFeeSats,
  trade
}: {
  readonly nextPool: DemoAmmPoolUtxo;
  readonly poolSpendConfirmed: boolean;
  readonly previousPool: DemoAmmPoolUtxo;
  readonly tokenToBchPoolFeeSats?: bigint;
  readonly trade: DemoAmmTradeProofInput;
}): DemoAmmTransitionAudit => {
  requireDemoAmmPoolTokenData(previousPool.tokenData);
  requireDemoAmmPoolTokenData(nextPool.tokenData);

  const previousBchReserve = BigInt(previousPool.valueSats);
  const previousTokenReserve = BigInt(previousPool.tokenData.amount);
  const nextBchReserve = BigInt(nextPool.valueSats);
  const nextTokenReserve = BigInt(nextPool.tokenData.amount);
  const inputAmount = BigInt(trade.inputAmount);
  const outputAmount = BigInt(trade.outputAmount);
  const problems: string[] = [];

  if (previousPool.tokenData.category.toLowerCase() !== trade.category.toLowerCase()) {
    problems.push("Previous pool category does not match the trade marker.");
  }
  if (nextPool.tokenData.category.toLowerCase() !== trade.category.toLowerCase()) {
    problems.push("Next pool category does not match the trade marker.");
  }
  if (!poolSpendConfirmed) {
    problems.push("Swap transaction does not spend the previous pool UTXO.");
  }

  const expectedBchReserve =
    trade.side === "BCH_TO_TOKEN"
      ? previousBchReserve + inputAmount
      : previousBchReserve - outputAmount - tokenToBchPoolFeeSats;
  const expectedTokenReserve =
    trade.side === "BCH_TO_TOKEN" ? previousTokenReserve - outputAmount : previousTokenReserve + inputAmount;

  if (expectedBchReserve !== nextBchReserve) {
    problems.push("Next BCH reserve does not match the trade marker delta.");
  }
  if (expectedTokenReserve !== nextTokenReserve) {
    problems.push("Next token reserve does not match the trade marker delta.");
  }

  const constantProductBefore = previousBchReserve * previousTokenReserve;
  const constantProductAfter = nextBchReserve * nextTokenReserve;
  if (constantProductAfter < constantProductBefore) {
    problems.push("Constant-product invariant decreased after the trade.");
  }

  return {
    actualBchReserveSats: nextBchReserve.toString(),
    actualTokenReserve: nextTokenReserve.toString(),
    category: trade.category.toLowerCase(),
    constantProductAfter: constantProductAfter.toString(),
    constantProductBefore: constantProductBefore.toString(),
    expectedBchReserveSats: expectedBchReserve.toString(),
    expectedTokenReserve: expectedTokenReserve.toString(),
    inputAmount: trade.inputAmount,
    nextPoolTxid: nextPool.txid,
    outputAmount: trade.outputAmount,
    poolSpendConfirmed,
    previousPoolTxid: previousPool.txid,
    problems,
    side: trade.side,
    status: problems.length === 0 ? "verified" : "failed",
    txid: trade.txid
  };
};

export const buildDemoAmmProofPackReceipt = (
  audits: readonly DemoAmmProofPackAuditInput[]
): DemoAmmProofPackReceipt => {
  const ordered = [...audits].sort((left, right) => left.height - right.height || left.txid.localeCompare(right.txid));

  for (let index = ordered.length - 1; index >= 0; index -= 1) {
    const sellAudit = ordered[index];
    if (sellAudit === undefined || sellAudit.side !== "TOKEN_TO_BCH") continue;

    const buyAudit = ordered
      .slice(0, index)
      .reverse()
      .find(
        (audit) =>
          audit.side === "BCH_TO_TOKEN" &&
          audit.category === sellAudit.category &&
          sellAudit.previousPoolTxid === audit.txid
      );
    if (buyAudit === undefined) continue;

    const problems = [...buyAudit.problems, ...sellAudit.problems];
    return {
      auditTxids: [buyAudit.txid, sellAudit.txid],
      bchToTokenTxid: buyAudit.txid,
      category: sellAudit.category,
      endHeight: sellAudit.height,
      problems,
      startHeight: buyAudit.height,
      status: buyAudit.status === "verified" && sellAudit.status === "verified" ? "verified" : "failed",
      tokenToBchTxid: sellAudit.txid
    };
  }

  return {
    auditTxids: [],
    problems: ["No complete BCH-to-token then token-to-BCH AMM proof pair was found."],
    status: "missing"
  };
};

export const findDemoAmmTransitionAuditByTxid = <Audit extends { readonly txid: string }>(
  audits: readonly Audit[],
  txid: string
): Audit | undefined => {
  const normalizedTxid = txid.toLowerCase();
  return audits.find((audit) => audit.txid.toLowerCase() === normalizedTxid);
};

export const selectDemoAmmSwapFundingUtxo = <Utxo extends { readonly amountSats: bigint }>(
  utxos: readonly Utxo[],
  bchAmountInSats: bigint
): Utxo | undefined => {
  const requiredWalletSats =
    bchAmountInSats + demoAmmTokenOutputDustSats + demoAmmSwapFeeSats + demoAmmWalletChangeDustSats + 1n;
  return utxos.find((utxo) => utxo.amountSats >= requiredWalletSats);
};

export const selectDemoAmmSellTokenUtxo = <Utxo extends { readonly tokenData?: DemoTokenData }>(
  utxos: readonly Utxo[],
  category: string,
  tokenAmountIn: bigint
): Utxo | undefined =>
  utxos.find((utxo) => {
    if (utxo.tokenData?.amount === undefined) return false;
    if (utxo.tokenData.category.toLowerCase() !== category.toLowerCase()) return false;
    return BigInt(utxo.tokenData.amount) >= tokenAmountIn;
  });
