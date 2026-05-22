import { describe, expect, it } from "vitest";
import {
  demoAmmPoolMarkerPrefix,
  encodeDemoAmmPoolMarkerText,
  encodeDemoAmmTradeMarkerText,
  parseDemoAmmPoolMarkerText,
  parseDemoAmmPoolMarkerScript,
  parseDemoAmmTradeMarkerScript,
  parseDemoAmmTradeMarkerText,
  quoteDemoAmmBuy,
  quoteDemoAmmSell,
  requireDemoAmmPoolTokenData,
  selectDemoAmmSellTokenUtxo,
  selectDemoAmmSwapFundingUtxo,
  summarizeDemoAmmPool,
  type DemoAmmPoolUtxo
} from "../src/demo/ammProof.js";

const opReturnMarkerScript = (text: string): string => {
  const payloadHex = Buffer.from(text, "utf8").toString("hex");
  const pushLength = Buffer.byteLength(text, "utf8");
  if (pushLength <= 0x4b) {
    return `6a${pushLength.toString(16).padStart(2, "0")}${payloadHex}`;
  }
  return `6a4c${pushLength.toString(16).padStart(2, "0")}${payloadHex}`;
};

describe("demo AMM pool proof helpers", () => {
  const pool: DemoAmmPoolUtxo = {
    active: true,
    height: 10,
    tokenData: {
      amount: "900000",
      category: "aa".repeat(32)
    },
    txid: "bb".repeat(32),
    valueSats: "5000000000",
    vout: 0
  };

  it("summarizes active BCH/CashToken pool reserves", () => {
    expect(summarizeDemoAmmPool(pool)).toEqual({
      bchReserveSats: "5000000000",
      tokenCategory: "aa".repeat(32),
      tokenReserve: "900000",
      txid: "bb".repeat(32)
    });
  });

  it("quotes a pool buy using constant-product math", () => {
    const quote = quoteDemoAmmBuy(pool, 1_000_000n, 30);

    expect(quote.feePaid).toBe(3_000n);
    expect(quote.inputAfterFee).toBe(997_000n);
    expect(quote.outputAmount).toBeGreaterThan(0n);
  });

  it("quotes a pool sell using the token side as input", () => {
    const quote = quoteDemoAmmSell(pool, 50n, 30);

    expect(quote.feePaid).toBe(0n);
    expect(quote.inputAfterFee).toBe(50n);
    expect(quote.outputAmount).toBeGreaterThan(0n);
  });

  it("rejects inactive or malformed pool UTXOs", () => {
    expect(() => summarizeDemoAmmPool({ ...pool, active: false })).toThrow("inactive");
    expect(() => summarizeDemoAmmPool({ ...pool, tokenData: { category: "aa".repeat(32) } })).toThrow(
      "token amount"
    );
    expect(() =>
      summarizeDemoAmmPool({
        ...pool,
        tokenData: { ...pool.tokenData, nft: { capability: "minting", commitment: "00" } }
      })
    ).toThrow("fungible-only");
  });

  it("selects a wallet UTXO large enough to fund the AMM swap", () => {
    const utxos = [{ amountSats: 1_000n }, { amountSats: 1_003_546n }, { amountSats: 1_003_547n }];

    expect(selectDemoAmmSwapFundingUtxo(utxos, 1_000_000n)).toEqual({ amountSats: 1_003_547n });
  });

  it("selects a user token UTXO large enough for an AMM token sell", () => {
    const utxos = [
      { tokenData: { amount: "49", category: "aa".repeat(32) } },
      { tokenData: { amount: "50", category: "bb".repeat(32) } },
      { tokenData: { amount: "50", category: "aa".repeat(32) } }
    ];

    expect(selectDemoAmmSellTokenUtxo(utxos, "aa".repeat(32), 50n)).toEqual(utxos[2]);
  });

  it("keeps legacy AMM pool marker compatibility", () => {
    const category = "AA".repeat(32);
    const markerText = encodeDemoAmmPoolMarkerText(category);

    expect(markerText).toBe(`${demoAmmPoolMarkerPrefix}|${category.toLowerCase()}`);
    expect(parseDemoAmmPoolMarkerText(markerText)).toBe(category.toLowerCase());
    expect(parseDemoAmmPoolMarkerScript(opReturnMarkerScript(markerText))).toBe(category.toLowerCase());
    expect(() => requireDemoAmmPoolTokenData(pool.tokenData, "bb".repeat(32))).toThrow("category");
  });

  it.each(["BCH_TO_TOKEN", "TOKEN_TO_BCH"] as const)("decodes %s AMM trade markers", (side) => {
    const category = "AB".repeat(32);
    const markerText = encodeDemoAmmTradeMarkerText(side, category, 1_000n, "250");
    const expectedMarker = {
      category: category.toLowerCase(),
      inputAmount: "1000",
      outputAmount: "250",
      side,
      type: "TRADE"
    };

    expect(parseDemoAmmTradeMarkerText(markerText)).toEqual(expectedMarker);
    expect(parseDemoAmmTradeMarkerScript(opReturnMarkerScript(markerText))).toEqual(expectedMarker);
  });

  it("rejects invalid AMM trade markers", () => {
    const category = "aa".repeat(32);
    const invalidMarkerTexts = [
      `${demoAmmPoolMarkerPrefix}|TRADE|BCH_TO_TOKEN|${category}|100`,
      `${demoAmmPoolMarkerPrefix}|TRADE|TOKEN_TO_BCH|${category}|100|1|extra`,
      `${demoAmmPoolMarkerPrefix}|TRADE|SIDEWAYS|${category}|100|1`,
      `${demoAmmPoolMarkerPrefix}|TRADE|BCH_TO_TOKEN|bad|100|1`,
      `${demoAmmPoolMarkerPrefix}|TRADE|BCH_TO_TOKEN|${category}|1.5|1`,
      `${demoAmmPoolMarkerPrefix}|TRADE|BCH_TO_TOKEN|${category}|1|-1`
    ];

    for (const markerText of invalidMarkerTexts) {
      expect(parseDemoAmmTradeMarkerText(markerText)).toBeUndefined();
      expect(parseDemoAmmTradeMarkerScript(opReturnMarkerScript(markerText))).toBeUndefined();
      expect(parseDemoAmmPoolMarkerText(markerText)).toBeUndefined();
      expect(parseDemoAmmPoolMarkerScript(opReturnMarkerScript(markerText))).toBeUndefined();
    }
    expect(() => encodeDemoAmmTradeMarkerText("BCH_TO_TOKEN", category, "1.5", "1")).toThrow("input amount");
    expect(() => encodeDemoAmmTradeMarkerText("SIDEWAYS" as never, category, "1", "1")).toThrow("side");
  });

  it("returns trade marker categories for AMM pool discovery", () => {
    const category = "cc".repeat(32);
    const markerText = encodeDemoAmmTradeMarkerText("TOKEN_TO_BCH", category, "50", "1234");

    expect(parseDemoAmmPoolMarkerText(markerText)).toBe(category);
    expect(parseDemoAmmPoolMarkerScript(opReturnMarkerScript(markerText))).toBe(category);
  });
});
