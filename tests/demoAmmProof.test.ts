import { describe, expect, it } from "vitest";
import {
  auditDemoAmmTradeTransition,
  buildDemoAmmProofPackReceipt,
  buildDemoLaunchAmmProofPackReceipt,
  demoAmmPoolMarkerPrefix,
  encodeDemoAmmPoolMarkerText,
  encodeDemoAmmTradeMarkerText,
  findDemoAmmTransitionAuditByTxid,
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
    inputOutpoints: [],
    scriptPubKey: "a914cd7b44d0b03f2d026d1e586d7ae18903b0d385f687",
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

  it("audits BCH-to-token reserve transitions from trade markers and pool UTXOs", () => {
    const previousPool = { ...pool, valueSats: "10000", tokenData: { ...pool.tokenData, amount: "1000" } };
    const nextPool = {
      ...pool,
      height: 11,
      txid: "cc".repeat(32),
      valueSats: "11000",
      tokenData: { ...pool.tokenData, amount: "910" }
    };

    expect(
      auditDemoAmmTradeTransition({
        nextPool,
        poolSpendConfirmed: true,
        previousPool,
        trade: {
          category: pool.tokenData.category,
          inputAmount: "1000",
          outputAmount: "90",
          side: "BCH_TO_TOKEN",
          txid: nextPool.txid
        }
      })
    ).toMatchObject({
      actualBchReserveSats: "11000",
      actualTokenReserve: "910",
      expectedBchReserveSats: "11000",
      expectedTokenReserve: "910",
      poolSpendConfirmed: true,
      status: "verified"
    });
  });

  it("audits token-to-BCH reserve transitions with the pool-side fee delta", () => {
    const previousPool = { ...pool, valueSats: "11000", tokenData: { ...pool.tokenData, amount: "910" } };
    const nextPool = {
      ...pool,
      height: 11,
      txid: "cc".repeat(32),
      valueSats: "10900",
      tokenData: { ...pool.tokenData, amount: "920" }
    };

    expect(
      auditDemoAmmTradeTransition({
        nextPool,
        poolSpendConfirmed: true,
        previousPool,
        tokenToBchPoolFeeSats: 2n,
        trade: {
          category: pool.tokenData.category,
          inputAmount: "10",
          outputAmount: "98",
          side: "TOKEN_TO_BCH",
          txid: nextPool.txid
        }
      })
    ).toMatchObject({
      actualBchReserveSats: "10900",
      actualTokenReserve: "920",
      expectedBchReserveSats: "10900",
      expectedTokenReserve: "920",
      status: "verified"
    });
  });

  it("flags AMM reserve audits when the previous pool spend or reserves do not match", () => {
    const previousPool = { ...pool, valueSats: "10000", tokenData: { ...pool.tokenData, amount: "1000" } };
    const nextPool = {
      ...pool,
      height: 11,
      txid: "cc".repeat(32),
      valueSats: "10999",
      tokenData: { ...pool.tokenData, amount: "910" }
    };
    const audit = auditDemoAmmTradeTransition({
      nextPool,
      poolSpendConfirmed: false,
      previousPool,
      trade: {
        category: pool.tokenData.category,
        inputAmount: "1000",
        outputAmount: "90",
        side: "BCH_TO_TOKEN",
        txid: nextPool.txid
      }
    });

    expect(audit.status).toBe("failed");
    expect(audit.problems).toEqual([
      "Swap transaction does not spend the previous pool UTXO.",
      "Next BCH reserve does not match the trade marker delta."
    ]);
  });

  it("builds a verified proof-pack receipt from a consecutive buy and sell audit pair", () => {
    const category = "aa".repeat(32);

    expect(
      buildDemoAmmProofPackReceipt([
        {
          category,
          height: 20,
          previousPoolTxid: "00".repeat(32),
          problems: [],
          side: "BCH_TO_TOKEN",
          status: "verified",
          txid: "11".repeat(32)
        },
        {
          category,
          height: 21,
          previousPoolTxid: "11".repeat(32),
          problems: [],
          side: "TOKEN_TO_BCH",
          status: "verified",
          txid: "22".repeat(32)
        }
      ])
    ).toEqual({
      auditTxids: ["11".repeat(32), "22".repeat(32)],
      bchToTokenTxid: "11".repeat(32),
      category,
      endHeight: 21,
      problems: [],
      startHeight: 20,
      status: "verified",
      tokenToBchTxid: "22".repeat(32)
    });
  });

  it("reports failed proof-pack receipts when either audit in the pair failed", () => {
    const category = "aa".repeat(32);

    expect(
      buildDemoAmmProofPackReceipt([
        {
          category,
          height: 20,
          previousPoolTxid: "00".repeat(32),
          problems: [],
          side: "BCH_TO_TOKEN",
          status: "verified",
          txid: "11".repeat(32)
        },
        {
          category,
          height: 21,
          previousPoolTxid: "11".repeat(32),
          problems: ["Next BCH reserve does not match the trade marker delta."],
          side: "TOKEN_TO_BCH",
          status: "failed",
          txid: "22".repeat(32)
        }
      ])
    ).toMatchObject({
      auditTxids: ["11".repeat(32), "22".repeat(32)],
      problems: ["Next BCH reserve does not match the trade marker delta."],
      status: "failed"
    });
  });

  it("reports a missing proof-pack receipt without a complete swap pair", () => {
    expect(buildDemoAmmProofPackReceipt([])).toEqual({
      auditTxids: [],
      problems: ["No complete BCH-to-token then token-to-BCH AMM proof pair was found."],
      status: "missing"
    });
  });

  it("builds a verified launch-to-AMM proof-pack receipt from bound token and swap audits", () => {
    const category = "aa".repeat(32);

    expect(
      buildDemoLaunchAmmProofPackReceipt({
        history: [
          { height: 10, kind: "CREATE", statusAfter: "active", txid: "01".repeat(32) },
          {
            graduationBchAmountSats: "5000000000",
            graduationTokenAmount: "900000",
            height: 11,
            kind: "GRADUATE",
            statusAfter: "graduated",
            txid: "04".repeat(32)
          },
          {
            category,
            height: 12,
            kind: "TOKEN",
            statusAfter: "active",
            tokenGenesisTxid: "02".repeat(32),
            txid: "03".repeat(32)
          }
        ],
        pools: [
          {
            ...pool,
            height: 13,
            inputOutpoints: [`${"02".repeat(32)}:0`],
            tokenData: { ...pool.tokenData, category },
            txid: "05".repeat(32)
          }
        ],
        tokenProofs: [
          {
            height: 10,
            inputOutpoints: [`${category}:0`],
            tokenData: { amount: "900000", category },
            txid: "02".repeat(32)
          }
        ],
        transitionAudits: [
          {
            category,
            height: 14,
            previousPoolTxid: "05".repeat(32),
            problems: [],
            side: "BCH_TO_TOKEN",
            status: "verified",
            txid: "06".repeat(32)
          },
          {
            category,
            height: 15,
            previousPoolTxid: "06".repeat(32),
            problems: [],
            side: "TOKEN_TO_BCH",
            status: "verified",
            txid: "07".repeat(32)
          }
        ]
      })
    ).toMatchObject({
      ammProofPack: {
        auditTxids: ["06".repeat(32), "07".repeat(32)],
        category,
        status: "verified"
      },
      poolTxid: "05".repeat(32),
      poolFundingConfirmed: true,
      poolFundingOutpoint: `${"02".repeat(32)}:0`,
      problems: [],
      status: "verified",
      tokenBindingTxid: "03".repeat(32),
      tokenCategory: category,
      tokenGenesisHeight: 10,
      tokenGenesisMinedBeforeBinding: true,
      tokenGenesisSourceConfirmed: true,
      tokenGenesisSourceOutpoint: `${category}:0`,
      tokenGenesisTxid: "02".repeat(32)
    });
  });

  it("fails launch-to-AMM proof packs when category binding does not reach a verified AMM pair", () => {
    const category = "aa".repeat(32);

    expect(
      buildDemoLaunchAmmProofPackReceipt({
        history: [
          { height: 10, kind: "CREATE", statusAfter: "active", txid: "01".repeat(32) },
          {
            graduationBchAmountSats: "5000000000",
            graduationTokenAmount: "900000",
            height: 11,
            kind: "GRADUATE",
            statusAfter: "graduated",
            txid: "04".repeat(32)
          },
          {
            category,
            height: 12,
            kind: "TOKEN",
            statusAfter: "active",
            tokenGenesisTxid: "02".repeat(32),
            txid: "03".repeat(32)
          }
        ],
        pools: [{ ...pool, height: 10, tokenData: { ...pool.tokenData, category }, txid: "05".repeat(32) }],
        tokenProofs: [],
        transitionAudits: []
      })
    ).toMatchObject({
      problems: [
        "Bound CashToken genesis output was not found on chain.",
        "Launch AMM pool was not created after the CashToken binding event.",
        "Launch AMM pool did not spend the bound CashToken genesis output.",
        "AMM proof pack: No complete BCH-to-token then token-to-BCH AMM proof pair was found."
      ],
      status: "failed"
    });
  });

  it("fails launch-to-AMM proof packs when the AMM pool was seeded from a different token output", () => {
    const category = "aa".repeat(32);

    expect(
      buildDemoLaunchAmmProofPackReceipt({
        history: [
          { height: 10, kind: "CREATE", statusAfter: "active", txid: "01".repeat(32) },
          {
            graduationBchAmountSats: "5000000000",
            graduationTokenAmount: "900000",
            height: 11,
            kind: "GRADUATE",
            statusAfter: "graduated",
            txid: "04".repeat(32)
          },
          {
            category,
            height: 12,
            kind: "TOKEN",
            statusAfter: "active",
            tokenGenesisTxid: "02".repeat(32),
            txid: "03".repeat(32)
          }
        ],
        pools: [
          {
            ...pool,
            height: 13,
            inputOutpoints: [`${"ff".repeat(32)}:0`],
            tokenData: { ...pool.tokenData, category },
            txid: "05".repeat(32)
          }
        ],
        tokenProofs: [
          {
            height: 10,
            inputOutpoints: [`${category}:0`],
            tokenData: { amount: "900000", category },
            txid: "02".repeat(32)
          }
        ],
        transitionAudits: [
          {
            category,
            height: 14,
            previousPoolTxid: "05".repeat(32),
            problems: [],
            side: "BCH_TO_TOKEN",
            status: "verified",
            txid: "06".repeat(32)
          },
          {
            category,
            height: 15,
            previousPoolTxid: "06".repeat(32),
            problems: [],
            side: "TOKEN_TO_BCH",
            status: "verified",
            txid: "07".repeat(32)
          }
        ]
      })
    ).toMatchObject({
      expectedPoolFundingOutpoint: `${"02".repeat(32)}:0`,
      poolFundingConfirmed: false,
      problems: ["Launch AMM pool did not spend the bound CashToken genesis output."],
      status: "failed"
    });
  });

  it("fails launch-to-AMM proof packs when the token genesis does not spend the category pre-genesis output", () => {
    const category = "aa".repeat(32);

    expect(
      buildDemoLaunchAmmProofPackReceipt({
        history: [
          { height: 10, kind: "CREATE", statusAfter: "active", txid: "01".repeat(32) },
          {
            graduationBchAmountSats: "5000000000",
            graduationTokenAmount: "900000",
            height: 11,
            kind: "GRADUATE",
            statusAfter: "graduated",
            txid: "04".repeat(32)
          },
          {
            category,
            height: 12,
            kind: "TOKEN",
            statusAfter: "active",
            tokenGenesisTxid: "02".repeat(32),
            txid: "03".repeat(32)
          }
        ],
        pools: [
          {
            ...pool,
            height: 13,
            inputOutpoints: [`${"02".repeat(32)}:0`],
            tokenData: { ...pool.tokenData, category },
            txid: "05".repeat(32)
          }
        ],
        tokenProofs: [
          {
            height: 10,
            inputOutpoints: [`${"ff".repeat(32)}:0`],
            tokenData: { amount: "900000", category },
            txid: "02".repeat(32)
          }
        ],
        transitionAudits: [
          {
            category,
            height: 14,
            previousPoolTxid: "05".repeat(32),
            problems: [],
            side: "BCH_TO_TOKEN",
            status: "verified",
            txid: "06".repeat(32)
          },
          {
            category,
            height: 15,
            previousPoolTxid: "06".repeat(32),
            problems: [],
            side: "TOKEN_TO_BCH",
            status: "verified",
            txid: "07".repeat(32)
          }
        ]
      })
    ).toMatchObject({
      expectedTokenGenesisOutpoint: `${category}:0`,
      problems: ["Bound CashToken genesis transaction did not spend the declared token category pre-genesis output."],
      status: "failed",
      tokenGenesisSourceConfirmed: false
    });
  });

  it("fails launch-to-AMM proof packs when the token binding is mined before token genesis", () => {
    const category = "aa".repeat(32);

    expect(
      buildDemoLaunchAmmProofPackReceipt({
        history: [
          { height: 10, kind: "CREATE", statusAfter: "active", txid: "01".repeat(32) },
          {
            graduationBchAmountSats: "5000000000",
            graduationTokenAmount: "900000",
            height: 11,
            kind: "GRADUATE",
            statusAfter: "graduated",
            txid: "04".repeat(32)
          },
          {
            category,
            height: 12,
            kind: "TOKEN",
            statusAfter: "active",
            tokenGenesisTxid: "02".repeat(32),
            txid: "03".repeat(32)
          }
        ],
        pools: [
          {
            ...pool,
            height: 13,
            inputOutpoints: [`${"02".repeat(32)}:0`],
            tokenData: { ...pool.tokenData, category },
            txid: "05".repeat(32)
          }
        ],
        tokenProofs: [
          {
            height: 12,
            inputOutpoints: [`${category}:0`],
            tokenData: { amount: "900000", category },
            txid: "02".repeat(32)
          }
        ],
        transitionAudits: [
          {
            category,
            height: 14,
            previousPoolTxid: "05".repeat(32),
            problems: [],
            side: "BCH_TO_TOKEN",
            status: "verified",
            txid: "06".repeat(32)
          },
          {
            category,
            height: 15,
            previousPoolTxid: "06".repeat(32),
            problems: [],
            side: "TOKEN_TO_BCH",
            status: "verified",
            txid: "07".repeat(32)
          }
        ]
      })
    ).toMatchObject({
      problems: ["Launch CashToken binding was not mined after the bound CashToken genesis output."],
      status: "failed",
      tokenGenesisHeight: 12,
      tokenGenesisMinedBeforeBinding: false
    });
  });

  it("finds a transition audit for a local explorer transaction link", () => {
    const audit = { status: "verified", txid: "aa".repeat(32) };

    expect(findDemoAmmTransitionAuditByTxid([audit], "AA".repeat(32))).toBe(audit);
    expect(findDemoAmmTransitionAuditByTxid([audit], "bb".repeat(32))).toBeUndefined();
  });
});
