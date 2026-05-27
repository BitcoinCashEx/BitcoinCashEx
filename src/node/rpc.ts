import type { AppConfig } from "../config.js";

export type BchnRpcMethod =
  | "createrawtransaction"
  | "generatetoaddress"
  | "getblock"
  | "getblockchaininfo"
  | "getblockcount"
  | "getblockhash"
  | "getindexinfo"
  | "getmempoolinfo"
  | "getnetworkinfo"
  | "getrawmempool"
  | "getrawtransaction"
  | "gettxout"
  | "getzmqnotifications"
  | "sendrawtransaction"
  | "signrawtransactionwithkey"
  | "testmempoolaccept";

export interface JsonRpcResponse<T> {
  readonly error: { readonly code: number; readonly message: string } | null;
  readonly id: string;
  readonly result: T;
}

export class BchnRpcError extends Error {
  constructor(
    message: string,
    readonly code?: number
  ) {
    super(message);
    this.name = "BchnRpcError";
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const hasOwn = (value: Record<string, unknown>, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(value, key);

export class BchnRpcClient {
  constructor(
    private readonly config: AppConfig,
    private readonly fetchImpl: typeof fetch = fetch
  ) {}

  async call<T>(method: BchnRpcMethod, params: readonly unknown[] = []): Promise<T> {
    this.assertMethodAllowed(method);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.rpc.timeoutMs);

    try {
      const response = await this.fetchImpl(this.config.rpc.url, {
        body: JSON.stringify({
          id: "bitcoincashex",
          jsonrpc: "1.0",
          method,
          params
        }),
        headers: {
          authorization: `Basic ${Buffer.from(`${this.config.rpc.user}:${this.config.rpc.password}`).toString(
            "base64"
          )}`,
          "content-type": "application/json"
        },
        method: "POST",
        signal: controller.signal
      });

      if (!response.ok) {
        throw new BchnRpcError(`BCHN RPC HTTP ${response.status}: ${response.statusText}: ${await response.text()}`);
      }

      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        throw new BchnRpcError("BCHN RPC returned invalid JSON.");
      }

      return this.parseJsonRpcResponse<T>(payload);
    } finally {
      clearTimeout(timeout);
    }
  }

  private assertMethodAllowed(method: BchnRpcMethod): void {
    if (
      method === "sendrawtransaction" &&
      this.config.network === "main" &&
      !this.config.allowMainnetBroadcast
    ) {
      throw new BchnRpcError(
        "Mainnet broadcast is disabled. Set BCH_ALLOW_MAINNET_BROADCAST=true only after review."
      );
    }
  }

  private parseJsonRpcResponse<T>(payload: unknown): T {
    if (!isRecord(payload)) {
      throw new BchnRpcError("BCHN RPC returned a malformed JSON-RPC response.");
    }

    const error = payload.error;
    if (error !== null) {
      if (!isRecord(error) || typeof error.message !== "string" || typeof error.code !== "number") {
        throw new BchnRpcError("BCHN RPC returned a malformed JSON-RPC error response.");
      }
      throw new BchnRpcError(error.message, error.code);
    }

    if (!hasOwn(payload, "result")) {
      throw new BchnRpcError("BCHN RPC returned a JSON-RPC response without a result.");
    }

    return payload.result as T;
  }
}
