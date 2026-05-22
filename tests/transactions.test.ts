import { describe, expect, it } from "vitest";
import { broadcastAcceptedRawTransaction, testRawTransactionAccept } from "../src/node/transactions.js";
import type { BchnRpcClient, BchnRpcMethod } from "../src/node/rpc.js";

describe("transaction safety helpers", () => {
  it("reads testmempoolaccept result", async () => {
    const rpc: Pick<BchnRpcClient, "call"> = {
      call: async <T>(method: BchnRpcMethod): Promise<T> => {
        expect(method).toBe("testmempoolaccept");
        return [{ allowed: true, txid: "abc" }] as T;
      }
    };

    await expect(testRawTransactionAccept(rpc, "00")).resolves.toEqual({ allowed: true, txid: "abc" });
  });

  it("broadcasts only after mempool acceptance", async () => {
    const calls: BchnRpcMethod[] = [];
    const rpc: Pick<BchnRpcClient, "call"> = {
      call: async <T>(method: BchnRpcMethod): Promise<T> => {
        calls.push(method);
        if (method === "testmempoolaccept") return [{ allowed: true }] as T;
        if (method === "sendrawtransaction") return "txid" as T;
        throw new Error(`unexpected method ${method}`);
      }
    };

    await expect(broadcastAcceptedRawTransaction(rpc, "00")).resolves.toBe("txid");
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
});
