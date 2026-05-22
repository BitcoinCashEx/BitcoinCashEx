import { quoteConstantProductSwap } from "../defi/constantProduct.js";
import type { DemoTokenData } from "./tokenProof.js";

export const demoAmmPoolMarkerPrefix = "BCHEXAMM1";

export interface DemoAmmPoolUtxo {
  readonly active: boolean;
  readonly height: number;
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

export const demoAmmSwapFeeSats = 2_000n;
export const demoAmmTokenOutputDustSats = 1_000n;
export const demoAmmWalletChangeDustSats = 546n;

export const encodeDemoAmmPoolMarkerText = (category: string): string => {
  if (!/^[0-9a-f]{64}$/i.test(category)) {
    throw new Error("AMM pool marker category must be a 32-byte transaction id.");
  }
  return `${demoAmmPoolMarkerPrefix}|${category.toLowerCase()}`;
};

export const parseDemoAmmPoolMarkerScript = (scriptHex: string): string | undefined => {
  if (!scriptHex.startsWith("6a") || scriptHex.length < 4) return undefined;
  const pushLength = Number.parseInt(scriptHex.slice(2, 4), 16);
  const payloadHex = scriptHex.slice(4, 4 + pushLength * 2);
  if (payloadHex.length !== pushLength * 2) return undefined;

  const text = Buffer.from(payloadHex, "hex").toString("utf8");
  const [prefix, category, extra] = text.split("|");
  if (prefix !== demoAmmPoolMarkerPrefix || extra !== undefined || category === undefined) return undefined;
  if (!/^[0-9a-f]{64}$/i.test(category)) return undefined;
  return category.toLowerCase();
};

export function requireDemoAmmPoolTokenData(
  tokenData: DemoTokenData,
  expectedCategory?: string
): asserts tokenData is DemoTokenData & { readonly amount: string; readonly nft?: undefined } {
  if (tokenData.amount === undefined || !/^[0-9]+$/.test(tokenData.amount)) {
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

export const selectDemoAmmSwapFundingUtxo = <Utxo extends { readonly amountSats: bigint }>(
  utxos: readonly Utxo[],
  bchAmountInSats: bigint
): Utxo | undefined => {
  const requiredWalletSats =
    bchAmountInSats + demoAmmTokenOutputDustSats + demoAmmSwapFeeSats + demoAmmWalletChangeDustSats + 1n;
  return utxos.find((utxo) => utxo.amountSats >= requiredWalletSats);
};
