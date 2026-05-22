import { describe, expect, it } from "vitest";
import {
  decodeDemoEventText,
  encodeDemoEventText,
  parseOpReturnEvent,
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
  });

  it("parses OP_RETURN script bytecode", () => {
    const payload = Buffer.from("BCHEX1|BUY|100000", "utf8");
    const script = Buffer.concat([Buffer.from([0x6a, payload.length]), payload]).toString("hex");

    expect(parseOpReturnEvent(script)).toEqual({
      bchAmountInSats: 100_000n,
      kind: "BUY"
    });
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
      { height: 2, input: { bchAmountInSats: 10_000n, kind: "BUY" }, time: 2, txid: "03".repeat(32) },
      { height: 3, input: { bchAmountInSats: 25_000n, kind: "BUY" }, time: 3, txid: "04".repeat(32) },
      { height: 4, input: { kind: "SELL", tokenAmountIn: 20_000n }, time: 4, txid: "05".repeat(32) },
      { height: 5, input: { bchAmountInSats: 300_000n, kind: "BUY" }, time: 5, txid: "06".repeat(32) },
      { height: 6, input: { kind: "GRADUATE" }, time: 6, txid: "07".repeat(32) }
    ];

    const replay = replayDemoEvents(events);

    expect(replay.launch?.status).toBe("graduated");
    expect(replay.graduation?.bchAmountSats).toBeGreaterThan(300_000n);
    expect(replay.graduation?.tokenAmount).toBeGreaterThan(0n);
    expect(replay.history).toHaveLength(6);
  });
});
