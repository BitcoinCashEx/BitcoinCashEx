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
    rpc.call<BchnNetworkInfo>("getnetworkinfo"),
    rpc.call<BchnBlockchainInfo>("getblockchaininfo"),
    rpc.call<Record<string, { readonly synced: boolean }>>("getindexinfo")
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

