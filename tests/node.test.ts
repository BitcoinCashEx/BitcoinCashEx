import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";
import { getNodeReadiness } from "../src/node/health.js";
import { BchnRpcClient, type BchnRpcMethod } from "../src/node/rpc.js";

describe("BCHN RPC safety", () => {
  const regtestConfig = () =>
    loadConfig({
      BCH_NETWORK: "regtest",
      BCH_RPC_PASSWORD: "password",
      BCH_RPC_URL: "http://127.0.0.1:18443",
      BCH_RPC_USER: "user"
    });

  it("blocks mainnet broadcasts unless explicitly enabled", async () => {
    const config = loadConfig({
      BCH_ALLOW_MAINNET_BROADCAST: "false",
      BCH_NETWORK: "main",
      BCH_RPC_PASSWORD: "password",
      BCH_RPC_URL: "http://127.0.0.1:8332",
      BCH_RPC_USER: "user"
    });
    const rpc = new BchnRpcClient(config, async () => {
      throw new Error("fetch should not be reached");
    });

    await expect(rpc.call("sendrawtransaction", ["00"])).rejects.toThrow("Mainnet broadcast is disabled");
  });

  it("returns JSON-RPC results and preserves BCHN error codes", async () => {
    const okRpc = new BchnRpcClient(
      regtestConfig(),
      async () => new Response(JSON.stringify({ error: null, id: "bitcoincashex", result: 123 }))
    );
    await expect(okRpc.call("getblockcount")).resolves.toBe(123);

    const errorRpc = new BchnRpcClient(
      regtestConfig(),
      async () =>
        new Response(JSON.stringify({ error: { code: -5, message: "No such mempool transaction" }, id: "x", result: null }))
    );
    await expect(errorRpc.call("getrawtransaction", ["00"])).rejects.toMatchObject({
      code: -5,
      message: "No such mempool transaction"
    });
  });

  it("rejects malformed BCHN JSON-RPC responses", async () => {
    const missingResultRpc = new BchnRpcClient(
      regtestConfig(),
      async () => new Response(JSON.stringify({ error: null, id: "bitcoincashex" }))
    );
    await expect(missingResultRpc.call("getblockcount")).rejects.toThrow("without a result");

    const malformedErrorRpc = new BchnRpcClient(
      regtestConfig(),
      async () => new Response(JSON.stringify({ error: { message: "bad" }, id: "bitcoincashex", result: null }))
    );
    await expect(malformedErrorRpc.call("getblockcount")).rejects.toThrow("malformed JSON-RPC error");
  });

  it("rejects non-json BCHN RPC responses", async () => {
    const rpc = new BchnRpcClient(regtestConfig(), async () => new Response("not-json"));

    await expect(rpc.call("getblockcount")).rejects.toThrow("invalid JSON");
  });

  it("reports readiness from BCHN RPC responses", async () => {
    const config = loadConfig({
      BCH_NETWORK: "regtest",
      BCH_REGTEST_UPGRADE12_ACTIVE: "true",
      BCH_RPC_PASSWORD: "password",
      BCH_RPC_URL: "http://127.0.0.1:18443",
      BCH_RPC_USER: "user"
    });
    const rpc: Pick<BchnRpcClient, "call"> = {
      call: async <T>(method: BchnRpcMethod): Promise<T> => {
        if (method === "getnetworkinfo") {
          return { subversion: "/Bitcoin Cash Node:29.0.0/", version: 290000 } as T;
        }
        if (method === "getblockchaininfo") {
          return { blocks: 1, chain: "regtest", headers: 1, mediantime: 0 } as T;
        }
        if (method === "getindexinfo") {
          return { txindex: { synced: true } } as T;
        }
        throw new Error(`unexpected method ${method}`);
      }
    };

    await expect(getNodeReadiness(config, rpc)).resolves.toMatchObject({
      cashVmMay2026Active: true,
      chain: "regtest",
      ready: true
    });
  });
});
