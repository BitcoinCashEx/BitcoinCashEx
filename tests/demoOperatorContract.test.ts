import { hexToBin } from "@bitauth/libauth";
import { describe, expect, it } from "vitest";
import { createDemoOperatorP2shContract, deriveDemoP2shContract } from "../src/demo/operatorContract.js";

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
});
