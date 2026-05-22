import type { BchnRpcClient } from "./rpc.js";

export interface TestMempoolAcceptResult {
  readonly allowed: boolean;
  readonly fees?: {
    readonly base: number;
  };
  readonly "reject-reason"?: string;
  readonly txid?: string;
  readonly vsize?: number;
}

export const testRawTransactionAccept = async (
  rpc: Pick<BchnRpcClient, "call">,
  rawTransactionHex: string
): Promise<TestMempoolAcceptResult> => {
  const results = await rpc.call<readonly TestMempoolAcceptResult[]>("testmempoolaccept", [[rawTransactionHex]]);
  const result = results[0];
  if (result === undefined) {
    throw new Error("BCHN returned no testmempoolaccept result.");
  }
  return result;
};

export const broadcastAcceptedRawTransaction = async (
  rpc: Pick<BchnRpcClient, "call">,
  rawTransactionHex: string
): Promise<string> => {
  const result = await testRawTransactionAccept(rpc, rawTransactionHex);
  if (!result.allowed) {
    throw new Error(`Transaction rejected by testmempoolaccept: ${result["reject-reason"] ?? "unknown reason"}`);
  }

  return rpc.call<string>("sendrawtransaction", [rawTransactionHex]);
};

