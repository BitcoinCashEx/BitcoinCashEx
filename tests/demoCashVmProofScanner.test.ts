import { describe, expect, it } from "vitest";
import { encodeCashVmProofText } from "../src/demo/cashVmProof.js";
import { extractDemoCashVmProofsFromTx, type DemoCashVmProofTx } from "../src/demo/cashVmProofScanner.js";
import { deriveDemoP2shContract } from "../src/demo/operatorContract.js";

const opReturnMarkerScript = (text: string): string => {
  const payload = Buffer.from(text, "utf8");
  if (payload.length <= 0x4b) {
    return Buffer.concat([Buffer.from([0x6a, payload.length]), payload]).toString("hex");
  }
  return Buffer.concat([Buffer.from([0x6a, 0x4c, payload.length]), payload]).toString("hex");
};

describe("demo CashVM proof scanner", () => {
  const contractTxid = "ab".repeat(32);
  const spendTxid = "cd".repeat(32);
  const proofScript = opReturnMarkerScript(encodeCashVmProofText(contractTxid));

  const proofTx = (scriptSigHex?: string): DemoCashVmProofTx => ({
    txid: spendTxid,
    vin: [
      {
        ...(scriptSigHex === undefined ? {} : { scriptSig: { hex: scriptSigHex } }),
        txid: contractTxid,
        vout: 0
      }
    ],
    vout: [{ scriptPubKey: { hex: proofScript } }]
  });

  it("extracts CashVM proof records from spends that reveal a redeem script", () => {
    const redeemScript = "51";

    expect(extractDemoCashVmProofsFromTx(proofTx("0151"), 7)).toEqual([
      {
        contractScriptPubKey: deriveDemoP2shContract(redeemScript).scriptPubKey,
        contractTxid,
        height: 7,
        redeemScript,
        spendTxid
      }
    ]);
  });

  it("does not fabricate proof records when the contract spend input is absent", () => {
    expect(
      extractDemoCashVmProofsFromTx(
        {
          txid: spendTxid,
          vin: [{ scriptSig: { hex: "0151" }, txid: "ef".repeat(32), vout: 0 }],
          vout: [{ scriptPubKey: { hex: proofScript } }]
        },
        7
      )
    ).toEqual([]);
  });

  it("does not bind proof records to a different contract output index", () => {
    expect(
      extractDemoCashVmProofsFromTx(
        {
          txid: spendTxid,
          vin: [{ scriptSig: { hex: "0151" }, txid: contractTxid, vout: 1 }],
          vout: [{ scriptPubKey: { hex: proofScript } }]
        },
        7
      )
    ).toEqual([]);
  });

  it("does not fall back to the demo operator script when scriptSig parsing fails", () => {
    expect(extractDemoCashVmProofsFromTx(proofTx(undefined), 7)).toEqual([]);
    expect(extractDemoCashVmProofsFromTx(proofTx("zz"), 7)).toEqual([]);
    expect(extractDemoCashVmProofsFromTx(proofTx("015151"), 7)).toEqual([]);
  });
});
