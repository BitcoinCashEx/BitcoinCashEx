import { describe, expect, it } from "vitest";
import {
  encodeDemoAmmPoolMarkerText,
  parseDemoAmmPoolMarkerScript,
  quoteDemoAmmBuy,
  requireDemoAmmPoolTokenData,
  selectDemoAmmSwapFundingUtxo,
  summarizeDemoAmmPool,
  type DemoAmmPoolUtxo
} from "../src/demo/ammProof.js";

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

  it("uses an AMM marker to bind pool discovery to a token category", () => {
    const category = "AA".repeat(32);
    const markerText = encodeDemoAmmPoolMarkerText(category);
    const markerScript = `6a${Buffer.byteLength(markerText, "utf8").toString(16).padStart(2, "0")}${Buffer.from(markerText, "utf8").toString("hex")}`;

    expect(parseDemoAmmPoolMarkerScript(markerScript)).toBe(category.toLowerCase());
    expect(() => requireDemoAmmPoolTokenData(pool.tokenData, "bb".repeat(32))).toThrow("category");
  });
});
