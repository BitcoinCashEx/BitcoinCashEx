export type BchNetwork = "main" | "test" | "test4" | "scale" | "chip" | "regtest";

export interface AppConfig {
  readonly allowMainnetBroadcast: boolean;
  readonly minBchnVersion: string;
  readonly network: BchNetwork;
  readonly regtestUpgrade12Active: boolean;
  readonly rpc: {
    readonly password: string;
    readonly timeoutMs: number;
    readonly url: string;
    readonly user: string;
  };
}

const booleanFromEnv = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
};

const networkFromEnv = (value: string | undefined): BchNetwork => {
  const network = value ?? "regtest";
  const allowed: readonly BchNetwork[] = ["main", "test", "test4", "scale", "chip", "regtest"];
  if (!allowed.includes(network as BchNetwork)) {
    throw new Error(`Unsupported BCH_NETWORK: ${network}`);
  }
  return network as BchNetwork;
};

export const loadConfig = (env: NodeJS.ProcessEnv = process.env): AppConfig => ({
  allowMainnetBroadcast: booleanFromEnv(env.BCH_ALLOW_MAINNET_BROADCAST, false),
  minBchnVersion: env.BCH_MIN_BCHN_VERSION ?? "29.0.0",
  network: networkFromEnv(env.BCH_NETWORK),
  regtestUpgrade12Active: booleanFromEnv(env.BCH_REGTEST_UPGRADE12_ACTIVE, true),
  rpc: {
    password: env.BCH_RPC_PASSWORD ?? "bchex-dev-only-change-me",
    timeoutMs: Number.parseInt(env.BCH_RPC_TIMEOUT_MS ?? "10000", 10),
    url: env.BCH_RPC_URL ?? "http://127.0.0.1:18443",
    user: env.BCH_RPC_USER ?? "bchex"
  }
});

