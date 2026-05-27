import type { AppConfig, BchNetwork } from "../config.js";
import { compareSemver, isCashVmMay2026Active } from "../cashvm/capabilities.js";
import type { BchnRpcClient } from "./rpc.js";

export interface BchnNetworkInfo {
  readonly subversion: string;
  readonly version: number;
}

export interface BchnBlockchainInfo {
  readonly chain: BchNetwork | string;
  readonly headers: number;
  readonly blocks: number;
  readonly mediantime: number;
}

export interface NodeReadinessReport {
  readonly cashVmMay2026Active: boolean;
  readonly chain: string;
  readonly indexes: readonly string[];
  readonly minVersion: string;
  readonly problems: readonly string[];
  readonly ready: boolean;
  readonly subversion: string;
}

const parseBchnSubversion = (subversion: string): string | undefined => {
  const match = /Bitcoin Cash Node:(\d+\.\d+\.\d+)/.exec(subversion);
  return match?.[1];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNonNegativeSafeInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

const normalizeNetworkInfo = (value: unknown): BchnNetworkInfo => {
  if (!isRecord(value) || typeof value.subversion !== "string" || !isNonNegativeSafeInteger(value.version)) {
    throw new Error("BCHN getnetworkinfo returned a malformed response.");
  }
  return { subversion: value.subversion, version: value.version };
};

const normalizeBlockchainInfo = (value: unknown): BchnBlockchainInfo => {
  if (
    !isRecord(value) ||
    typeof value.chain !== "string" ||
    !isNonNegativeSafeInteger(value.headers) ||
    !isNonNegativeSafeInteger(value.blocks) ||
    !isNonNegativeSafeInteger(value.mediantime)
  ) {
    throw new Error("BCHN getblockchaininfo returned a malformed response.");
  }
  return {
    blocks: value.blocks,
    chain: value.chain,
    headers: value.headers,
    mediantime: value.mediantime
  };
};

const normalizeIndexInfo = (value: unknown): Record<string, { readonly synced: boolean }> => {
  if (!isRecord(value)) {
    throw new Error("BCHN getindexinfo returned a malformed response.");
  }

  const entries = Object.entries(value).map(([name, index]) => {
    if (!isRecord(index) || typeof index.synced !== "boolean") {
      throw new Error("BCHN getindexinfo returned a malformed response.");
    }
    return [name, { synced: index.synced }] as const;
  });
  return Object.fromEntries(entries);
};

const normalizeChain = (chain: string): BchNetwork => {
  if (chain === "chip") return "chip";
  if (chain === "regtest") return "regtest";
  if (chain === "main") return "main";
  if (chain === "test") return "test";
  if (chain === "test4") return "test4";
  if (chain === "scale") return "scale";
  throw new Error(`Unsupported BCHN chain returned by node: ${chain}`);
};

export const getNodeReadiness = async (
  config: AppConfig,
  rpc: Pick<BchnRpcClient, "call">
): Promise<NodeReadinessReport> => {
  const [networkInfo, blockchainInfo, indexInfo] = await Promise.all([
    rpc.call<unknown>("getnetworkinfo").then(normalizeNetworkInfo),
    rpc.call<unknown>("getblockchaininfo").then(normalizeBlockchainInfo),
    rpc.call<unknown>("getindexinfo").then(normalizeIndexInfo)
  ]);

  const nodeVersion = parseBchnSubversion(networkInfo.subversion);
  const chain = normalizeChain(blockchainInfo.chain);
  const indexes = Object.entries(indexInfo)
    .filter(([, index]) => index.synced)
    .map(([name]) => name)
    .sort();

  const problems: string[] = [];
  if (nodeVersion === undefined) {
    problems.push(`Node subversion is not recognized as BCHN: ${networkInfo.subversion}`);
  } else if (compareSemver(nodeVersion, config.minBchnVersion) < 0) {
    problems.push(`BCHN ${nodeVersion} is older than required ${config.minBchnVersion}`);
  }

  if (chain !== config.network) {
    problems.push(`Configured network ${config.network} does not match BCHN chain ${chain}`);
  }

  if (!indexes.includes("txindex")) {
    problems.push("BCHN txindex is not synced; contract UTXO lookups will be incomplete.");
  }

  const cashVmMay2026Active = isCashVmMay2026Active(
    chain,
    blockchainInfo.mediantime,
    config.regtestUpgrade12Active
  );
  if (!cashVmMay2026Active) {
    problems.push("May 2026 CashVM rules are not active for this node view.");
  }

  return {
    cashVmMay2026Active,
    chain,
    indexes,
    minVersion: config.minBchnVersion,
    problems,
    ready: problems.length === 0,
    subversion: networkInfo.subversion
  };
};
