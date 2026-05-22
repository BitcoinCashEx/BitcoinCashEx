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
        throw new BchnRpcError(`BCHN RPC HTTP ${response.status}: ${response.statusText}`);
      }

      const payload = (await response.json()) as JsonRpcResponse<T>;
      if (payload.error !== null) {
        throw new BchnRpcError(payload.error.message, payload.error.code);
      }
      return payload.result;
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
}
