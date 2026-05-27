import { describe, expect, it } from "vitest";
import { broadcastAcceptedRawTransaction, testRawTransactionAccept } from "../src/node/transactions.js";
import type { BchnRpcClient, BchnRpcMethod } from "../src/node/rpc.js";

describe("transaction safety helpers", () => {
  it("reads testmempoolaccept result", async () => {
    const rpc: Pick<BchnRpcClient, "call"> = {
      call: async <T>(method: BchnRpcMethod): Promise<T> => {
        expect(method).toBe("testmempoolaccept");
        return [{ allowed: true, txid: "AA".repeat(32) }] as T;
      }
    };

    await expect(testRawTransactionAccept(rpc, "00")).resolves.toEqual({ allowed: true, txid: "aa".repeat(32) });
  });

  it("broadcasts only after mempool acceptance", async () => {
    const calls: BchnRpcMethod[] = [];
    const rpc: Pick<BchnRpcClient, "call"> = {
      call: async <T>(method: BchnRpcMethod): Promise<T> => {
        calls.push(method);
        if (method === "testmempoolaccept") return [{ allowed: true }] as T;
        if (method === "sendrawtransaction") return "BB".repeat(32) as T;
        throw new Error(`unexpected method ${method}`);
      }
    };

    await expect(broadcastAcceptedRawTransaction(rpc, "00")).resolves.toBe("bb".repeat(32));
    expect(calls).toEqual(["testmempoolaccept", "sendrawtransaction"]);
  });

  it("does not broadcast rejected transactions", async () => {
    const calls: BchnRpcMethod[] = [];
    const rpc: Pick<BchnRpcClient, "call"> = {
      call: async <T>(method: BchnRpcMethod): Promise<T> => {
        calls.push(method);
        return [{ allowed: false, "reject-reason": "mandatory-script-verify-flag-failed" }] as T;
      }
    };

    await expect(broadcastAcceptedRawTransaction(rpc, "00")).rejects.toThrow("mandatory-script");
    expect(calls).toEqual(["testmempoolaccept"]);
  });

  it("rejects malformed raw transaction hex before RPC calls", async () => {
    const calls: BchnRpcMethod[] = [];
    const rpc: Pick<BchnRpcClient, "call"> = {
      call: async <T>(method: BchnRpcMethod): Promise<T> => {
        calls.push(method);
        return [] as T;
      }
    };

    await expect(testRawTransactionAccept(rpc, "")).rejects.toThrow("non-empty even-length hex");
    await expect(testRawTransactionAccept(rpc, "0")).rejects.toThrow("non-empty even-length hex");
    await expect(testRawTransactionAccept(rpc, "zz")).rejects.toThrow("non-empty even-length hex");
    expect(calls).toEqual([]);
  });

  it("rejects malformed testmempoolaccept responses", async () => {
    const rpcWithExtraResult: Pick<BchnRpcClient, "call"> = {
      call: async <T>(): Promise<T> => [{ allowed: true }, { allowed: true }] as T
    };
    await expect(testRawTransactionAccept(rpcWithExtraResult, "00")).rejects.toThrow("result count");

    const rpcWithBadResult: Pick<BchnRpcClient, "call"> = {
      call: async <T>(): Promise<T> => [{ allowed: "yes" }] as T
    };
    await expect(testRawTransactionAccept(rpcWithBadResult, "00")).rejects.toThrow("malformed testmempoolaccept");

    const rpcWithBadTxid: Pick<BchnRpcClient, "call"> = {
      call: async <T>(): Promise<T> => [{ allowed: true, txid: "not-a-txid" }] as T
    };
    await expect(testRawTransactionAccept(rpcWithBadTxid, "00")).rejects.toThrow("transaction id");
  });

  it("rejects malformed testmempoolaccept fee and vsize fields", async () => {
    const rpcWithNegativeFee: Pick<BchnRpcClient, "call"> = {
      call: async <T>(): Promise<T> => [{ allowed: true, fees: { base: -0.00001 } }] as T
    };
    await expect(testRawTransactionAccept(rpcWithNegativeFee, "00")).rejects.toThrow("fees");

    const rpcWithFractionalVsize: Pick<BchnRpcClient, "call"> = {
      call: async <T>(): Promise<T> => [{ allowed: true, vsize: 12.5 }] as T
    };
    await expect(testRawTransactionAccept(rpcWithFractionalVsize, "00")).rejects.toThrow("vsize");

    const rpcWithZeroVsize: Pick<BchnRpcClient, "call"> = {
      call: async <T>(): Promise<T> => [{ allowed: true, vsize: 0 }] as T
    };
    await expect(testRawTransactionAccept(rpcWithZeroVsize, "00")).rejects.toThrow("vsize");
  });

  it("rejects malformed sendrawtransaction txids", async () => {
    const rpc: Pick<BchnRpcClient, "call"> = {
      call: async <T>(method: BchnRpcMethod): Promise<T> => {
        if (method === "testmempoolaccept") return [{ allowed: true }] as T;
        if (method === "sendrawtransaction") return "not-a-txid" as T;
        throw new Error(`unexpected method ${method}`);
      }
    };

    await expect(broadcastAcceptedRawTransaction(rpc, "00")).rejects.toThrow("malformed transaction id");
  });

  it("requires broadcast txids to match mempool-accepted txids when BCHN provides both", async () => {
    const rpc: Pick<BchnRpcClient, "call"> = {
      call: async <T>(method: BchnRpcMethod): Promise<T> => {
        if (method === "testmempoolaccept") return [{ allowed: true, txid: "aa".repeat(32) }] as T;
        if (method === "sendrawtransaction") return "bb".repeat(32) as T;
        throw new Error(`unexpected method ${method}`);
      }
    };

    await expect(broadcastAcceptedRawTransaction(rpc, "00")).rejects.toThrow("did not match testmempoolaccept");
  });
});
