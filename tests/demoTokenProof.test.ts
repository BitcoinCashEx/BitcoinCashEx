import { describe, expect, it } from "vitest";
import { summarizeDemoTokenData } from "../src/demo/tokenProof.js";

describe("demo CashToken proof summaries", () => {
  it("summarizes a minted CashToken output from BCHN tokenData", () => {
    expect(
      summarizeDemoTokenData({
        amount: "900000",
        category: "AA".repeat(32),
        nft: {
          capability: "minting",
          commitment: "00"
        }
      })
    ).toEqual({
      amount: "900000",
      category: "aa".repeat(32),
      hasMintingNft: true
    });
  });

  it("rejects malformed token proof data", () => {
    expect(() => summarizeDemoTokenData({ category: "aa" })).toThrow("32-byte");
    expect(() => summarizeDemoTokenData({ amount: "1.5", category: "AA".repeat(32) })).toThrow(
      "integer string"
    );
  });

  it("rejects malformed token NFT capabilities before summarizing proofs", () => {
    expect(() =>
      summarizeDemoTokenData({
        category: "AA".repeat(32),
        nft: { capability: "forged", commitment: "00" }
      })
    ).toThrow("NFT capability");
  });

  it("rejects malformed token NFT commitments before summarizing proofs", () => {
    expect(() =>
      summarizeDemoTokenData({
        category: "AA".repeat(32),
        nft: { capability: "minting", commitment: "0" }
      })
    ).toThrow("NFT commitment");
    expect(() =>
      summarizeDemoTokenData({
        category: "AA".repeat(32),
        nft: { capability: "minting", commitment: "zz" }
      })
    ).toThrow("NFT commitment");
  });
});
