import { hexToBin } from "@bitauth/libauth";
import { describe, expect, it } from "vitest";
import { auditDemoP2shSpend, createDemoOperatorP2shContract, deriveDemoP2shContract } from "../src/demo/operatorContract.js";

describe("demo operator CashVM contract", () => {
  const privateKey = hexToBin("0000000000000000000000000000000000000000000000000000000000000001");

  it("wraps the backend P2PKH signature check in a P2SH CashVM contract", () => {
    const contract = createDemoOperatorP2shContract(privateKey);

    expect(contract.redeemScript).toBe("76a914751e76e8199196d454941c45d1b3a323f1433bd688ac");
    expect(contract.scriptPubKey).toBe("a914cd7b44d0b03f2d026d1e586d7ae18903b0d385f687");
    expect(contract.address).toBe("bchreg:prxhk3xskqlj6qndrevx67hp3ypmp5u97cd2hc3x9z");
  });

  it("does not use the previous anyone-can-spend OP_TRUE proof script", () => {
    expect(createDemoOperatorP2shContract(privateKey).redeemScript).not.toBe("51");
  });

  it("derives historical P2SH contracts from their redeem scripts", () => {
    expect(deriveDemoP2shContract("51")).toEqual({
      address: "bchreg:prdpw30fk4ym6zl6rftfjuw806arpn26fveknc0qmt",
      redeemScript: "51",
      scriptPubKey: "a914da1745e9b549bd0bfa1a569971c77eba30cd5a4b87"
    });
  });

  it("audits that a P2SH spend reveals the expected CashVM redeem script", () => {
    const contract = createDemoOperatorP2shContract(privateKey);
    const scriptSigWithFinalRedeemScript = `01aa4c${(contract.redeemScript.length / 2).toString(16).padStart(2, "0")}${contract.redeemScript}`;

    expect(
      auditDemoP2shSpend({
        expectedScriptPubKey: contract.scriptPubKey,
        scriptSigHex: scriptSigWithFinalRedeemScript
      })
    ).toEqual({
      derivedScriptPubKey: contract.scriptPubKey,
      expectedScriptPubKey: contract.scriptPubKey,
      problems: [],
      redeemScript: contract.redeemScript,
      status: "verified"
    });
  });

  it("flags P2SH spends that do not match the expected CashVM pool script", () => {
    expect(
      auditDemoP2shSpend({
        expectedScriptPubKey: createDemoOperatorP2shContract(privateKey).scriptPubKey,
        scriptSigHex: "0151"
      })
    ).toMatchObject({
      problems: ["Redeem script hash does not match the spent CashVM P2SH pool script."],
      redeemScript: "51",
      status: "failed"
    });
  });
});
