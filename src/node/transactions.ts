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

const rawTransactionHexPattern = /^(?:[0-9a-f]{2})+$/i;
const txidPattern = /^[0-9a-f]{64}$/i;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const requireRawTransactionHex = (rawTransactionHex: string): void => {
  if (!rawTransactionHexPattern.test(rawTransactionHex)) {
    throw new Error("Raw transaction hex must be a non-empty even-length hex string.");
  }
};

const normalizeTestMempoolAcceptResult = (value: unknown): TestMempoolAcceptResult => {
  if (!isRecord(value) || typeof value.allowed !== "boolean") {
    throw new Error("BCHN returned a malformed testmempoolaccept result.");
  }

  if (value.txid !== undefined && (typeof value.txid !== "string" || !txidPattern.test(value.txid))) {
    throw new Error("BCHN returned a malformed testmempoolaccept transaction id.");
  }
  if (value["reject-reason"] !== undefined && typeof value["reject-reason"] !== "string") {
    throw new Error("BCHN returned a malformed testmempoolaccept reject reason.");
  }
  if (value.vsize !== undefined && (typeof value.vsize !== "number" || !Number.isFinite(value.vsize))) {
    throw new Error("BCHN returned a malformed testmempoolaccept vsize.");
  }
  if (
    value.fees !== undefined &&
    (!isRecord(value.fees) || typeof value.fees.base !== "number" || !Number.isFinite(value.fees.base))
  ) {
    throw new Error("BCHN returned malformed testmempoolaccept fees.");
  }

  const fees = value.fees as { readonly base: number } | undefined;
  const rejectReason = value["reject-reason"] as string | undefined;
  const txid = value.txid as string | undefined;
  const vsize = value.vsize as number | undefined;

  return {
    allowed: value.allowed,
    ...(fees === undefined ? {} : { fees: { base: fees.base } }),
    ...(rejectReason === undefined ? {} : { "reject-reason": rejectReason }),
    ...(txid === undefined ? {} : { txid: txid.toLowerCase() }),
    ...(vsize === undefined ? {} : { vsize })
  };
};

export const testRawTransactionAccept = async (
  rpc: Pick<BchnRpcClient, "call">,
  rawTransactionHex: string
): Promise<TestMempoolAcceptResult> => {
  requireRawTransactionHex(rawTransactionHex);

  const results = await rpc.call<unknown>("testmempoolaccept", [[rawTransactionHex]]);
  if (!Array.isArray(results) || results.length !== 1) {
    throw new Error("BCHN returned an unexpected testmempoolaccept result count.");
  }
  return normalizeTestMempoolAcceptResult(results[0]);
};

export const broadcastAcceptedRawTransaction = async (
  rpc: Pick<BchnRpcClient, "call">,
  rawTransactionHex: string
): Promise<string> => {
  const result = await testRawTransactionAccept(rpc, rawTransactionHex);
  if (!result.allowed) {
    throw new Error(`Transaction rejected by testmempoolaccept: ${result["reject-reason"] ?? "unknown reason"}`);
  }

  const txid = await rpc.call<string>("sendrawtransaction", [rawTransactionHex]);
  if (typeof txid !== "string" || !txidPattern.test(txid)) {
    throw new Error("BCHN sendrawtransaction returned a malformed transaction id.");
  }
  return txid.toLowerCase();
};
