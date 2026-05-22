import { describe, expect, it } from "vitest";
import {
  decodeCashVmProofText,
  encodeCashVmProofText,
  extractFinalPushDataHex,
  parseCashVmProofScript
} from "../src/demo/cashVmProof.js";
import { parseOpReturnEvent } from "../src/demo/events.js";

describe("demo CashVM proof events", () => {
  const txid = "ab".repeat(32);

  it("encodes and decodes CashVM proof markers", () => {
    const text = encodeCashVmProofText(txid);

    expect(text).toBe(`BCHEX1|CASHVM|${txid}`);
    expect(decodeCashVmProofText(text)).toEqual({ contractTxid: txid });
  });

  it("parses CashVM proof OP_RETURN bytecode separately from launch events", () => {
    const payload = Buffer.from(encodeCashVmProofText(txid), "utf8");
    const script = Buffer.concat([Buffer.from([0x6a, payload.length]), payload]).toString("hex");

    expect(parseCashVmProofScript(script)).toEqual({ contractTxid: txid });
    expect(parseOpReturnEvent(script)).toBeUndefined();
  });

  it("rejects malformed contract txids", () => {
    expect(() => encodeCashVmProofText("aa")).toThrow("32-byte");
    expect(() => decodeCashVmProofText("BCHEX1|CASHVM|aa")).toThrow("32-byte");
  });

  it("extracts the redeem script from a P2SH scriptSig", () => {
    const redeemScript = "76a914751e76e8199196d454941c45d1b3a323f1433bd688ac";
    const scriptSig = `0151${(redeemScript.length / 2).toString(16).padStart(2, "0")}${redeemScript}`;

    expect(extractFinalPushDataHex("0151")).toBe("51");
    expect(extractFinalPushDataHex(scriptSig)).toBe(redeemScript);
  });
});
