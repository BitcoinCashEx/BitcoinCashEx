import { describe, expect, it } from "vitest";
import {
  decodeDemoEventText,
  encodeDemoEventText,
  parseOpReturnEvent,
  parseOpReturnText,
  replayDemoEvents,
  type DemoChainEvent
} from "../src/demo/events.js";

describe("demo on-chain event replay", () => {
  it("encodes launch actions into compact OP_RETURN payloads", () => {
    const text = encodeDemoEventText({
      decimals: 0,
      feeBps: 100,
      graduationThresholdBchSats: 300_000n,
      kind: "CREATE",
      maxSupply: 900_000n,
      symbol: "PUMP",
      virtualBchReserveSats: 100_000n,
      virtualTokenReserve: 1_000_000n
    });

    expect(text).toBe("BCHEX1|CREATE|PUMP|0|900000|100000|1000000|100|300000");
    expect(decodeDemoEventText(text)).toMatchObject({ kind: "CREATE", symbol: "PUMP" });

    const tokenText = encodeDemoEventText({
      category: "AA".repeat(32),
      kind: "TOKEN",
      tokenGenesisTxid: "BB".repeat(32)
    });
    expect(tokenText).toBe(`BCHEX1|TOKEN|${"aa".repeat(32)}|${"bb".repeat(32)}`);
    expect(decodeDemoEventText(tokenText)).toEqual({
      category: "aa".repeat(32),
      kind: "TOKEN",
      tokenGenesisTxid: "bb".repeat(32)
    });
  });

  it("parses OP_RETURN script bytecode", () => {
    const payload = Buffer.from("BCHEX1|BUY|100000", "utf8");
    const script = Buffer.concat([Buffer.from([0x6a, payload.length]), payload]).toString("hex");

    expect(parseOpReturnEvent(script)).toEqual({
      bchAmountInSats: 100_000n,
      kind: "BUY"
    });
  });

  it("rejects malformed OP_RETURN script bytecode", () => {
    const payload = Buffer.from("BCHEX1|BUY|100000", "utf8");
    const script = Buffer.concat([Buffer.from([0x6a, payload.length]), payload]).toString("hex");

    expect(parseOpReturnText("zz")).toBeUndefined();
    expect(parseOpReturnText(script.slice(0, -2))).toBeUndefined();
    expect(parseOpReturnText(`${script}00`)).toBeUndefined();
    expect(parseOpReturnEvent(`${script}00`)).toBeUndefined();
  });

  it("parses long PUSHDATA1 OP_RETURN launch binding text", () => {
    const text = encodeDemoEventText({
      category: "aa".repeat(32),
      kind: "TOKEN",
      tokenGenesisTxid: "bb".repeat(32)
    });
    const payload = Buffer.from(text, "utf8");
    const script = Buffer.concat([Buffer.from([0x6a, 0x4c, payload.length]), payload]).toString("hex");

    expect(parseOpReturnText(script)).toBe(text);
    expect(parseOpReturnEvent(script)).toEqual({
      category: "aa".repeat(32),
      kind: "TOKEN",
      tokenGenesisTxid: "bb".repeat(32)
    });
  });

  it("rejects unsupported OP_RETURN push opcodes for long launch event payloads", () => {
    const text = encodeDemoEventText({
      category: "aa".repeat(32),
      kind: "TOKEN",
      tokenGenesisTxid: "bb".repeat(32)
    });
    const payload = Buffer.from(text, "utf8");
    const script = Buffer.concat([Buffer.from([0x6a, payload.length]), payload]).toString("hex");

    expect(payload.length).toBeGreaterThan(0x4b);
    expect(parseOpReturnText(script)).toBeUndefined();
    expect(parseOpReturnEvent(script)).toBeUndefined();
  });

  it("rejects malformed event field counts and non-positive trade amounts", () => {
    expect(() => decodeDemoEventText("BCHEX1|CREATE|PUMP|0|900000|100000|1000000|100|300000|extra")).toThrow(
      "exactly 9 fields"
    );
    expect(() => decodeDemoEventText("BCHEX1|CREATE||0|900000|100000|1000000|100|300000")).toThrow(
      "symbol"
    );
    expect(() => decodeDemoEventText("BCHEX1|CREATE|pump|0|900000|100000|1000000|100|300000")).toThrow(
      "uppercase"
    );
    expect(() =>
      encodeDemoEventText({
        decimals: 0,
        feeBps: 100,
        graduationThresholdBchSats: 300_000n,
        kind: "CREATE",
        maxSupply: 900_000n,
        symbol: "bad-symbol",
        virtualBchReserveSats: 100_000n,
        virtualTokenReserve: 1_000_000n
      })
    ).toThrow("uppercase");
    expect(() => decodeDemoEventText("BCHEX1|BUY|0")).toThrow("positive");
    expect(() => decodeDemoEventText("BCHEX1|SELL|0")).toThrow("positive");
    expect(() => decodeDemoEventText("BCHEX1|GRADUATE|extra")).toThrow("exactly 2 fields");
    expect(() => decodeDemoEventText(`BCHEX1|TOKEN|${"aa".repeat(32)}|${"bb".repeat(32)}|extra`)).toThrow(
      "exactly 4 fields"
    );
  });

  it("ignores malformed OP_RETURN events instead of replaying them", () => {
    const payload = Buffer.from("BCHEX1|BUY|0", "utf8");
    const script = Buffer.concat([Buffer.from([0x6a, payload.length]), payload]).toString("hex");

    expect(parseOpReturnEvent(script)).toBeUndefined();
  });

  it("replays a full local launch lifecycle from transaction events", () => {
    const events: DemoChainEvent[] = [
      {
        height: 1,
        input: {
          decimals: 0,
          feeBps: 100,
          graduationThresholdBchSats: 300_000n,
          kind: "CREATE",
          maxSupply: 900_000n,
          symbol: "PUMP",
          virtualBchReserveSats: 100_000n,
          virtualTokenReserve: 1_000_000n
        },
        time: 1,
        txid: "02".repeat(32)
      },
      {
        height: 2,
        input: { category: "aa".repeat(32), kind: "TOKEN", tokenGenesisTxid: "08".repeat(32) },
        time: 2,
        txid: "09".repeat(32)
      },
      { height: 3, input: { bchAmountInSats: 10_000n, kind: "BUY" }, time: 3, txid: "03".repeat(32) },
      { height: 4, input: { bchAmountInSats: 25_000n, kind: "BUY" }, time: 4, txid: "04".repeat(32) },
      { height: 5, input: { kind: "SELL", tokenAmountIn: 20_000n }, time: 5, txid: "05".repeat(32) },
      { height: 6, input: { bchAmountInSats: 300_000n, kind: "BUY" }, time: 6, txid: "06".repeat(32) },
      { height: 7, input: { kind: "GRADUATE" }, time: 7, txid: "07".repeat(32) }
    ];

    const replay = replayDemoEvents(events);

    expect(replay.launch?.status).toBe("graduated");
    expect(replay.launch?.asset.category).toBe("aa".repeat(32));
    expect(replay.graduation?.asset.category).toBe("aa".repeat(32));
    expect(replay.graduation?.bchAmountSats).toBeGreaterThan(300_000n);
    expect(replay.graduation?.tokenAmount).toBeGreaterThan(0n);
    expect(replay.history).toHaveLength(7);
  });
});
