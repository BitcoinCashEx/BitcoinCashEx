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
  const normalized = value.toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  throw new Error(`Invalid boolean environment value: ${value}`);
};

const semanticVersionPattern = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/;

const semanticVersionFromEnv = (name: string, value: string | undefined, fallback: string): string => {
  const text = value ?? fallback;
  if (!semanticVersionPattern.test(text)) {
    throw new Error(`${name} must be a semantic version like 29.0.0.`);
  }
  return text;
};

const networkFromEnv = (value: string | undefined): BchNetwork => {
  const network = value ?? "regtest";
  const allowed: readonly BchNetwork[] = ["main", "test", "test4", "scale", "chip", "regtest"];
  if (!allowed.includes(network as BchNetwork)) {
    throw new Error(`Unsupported BCH_NETWORK: ${network}`);
  }
  return network as BchNetwork;
};

const positiveIntegerFromEnv = (
  name: string,
  value: string | undefined,
  fallback: number,
  max: number
): number => {
  const text = value ?? fallback.toString();
  if (!/^[0-9]+$/.test(text)) {
    throw new Error(`${name} must be a positive integer.`);
  }
  const parsed = Number.parseInt(text, 10);
  if (parsed <= 0 || parsed > max) {
    throw new Error(`${name} must be between 1 and ${max}.`);
  }
  return parsed;
};

const rpcUrlFromEnv = (value: string | undefined): string => {
  const text = value ?? "http://127.0.0.1:18443";
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    throw new Error("BCH_RPC_URL must be a valid URL.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("BCH_RPC_URL must use http or https.");
  }
  if (url.username !== "" || url.password !== "") {
    throw new Error("BCH_RPC_URL must not include credentials; use BCH_RPC_USER and BCH_RPC_PASSWORD.");
  }
  return text;
};

const requiredStringFromEnv = (name: string, value: string | undefined, fallback: string): string => {
  const text = value ?? fallback;
  if (text.trim() === "") {
    throw new Error(`${name} must not be empty.`);
  }
  return text;
};

export const loadConfig = (env: NodeJS.ProcessEnv = process.env): AppConfig => ({
  allowMainnetBroadcast: booleanFromEnv(env.BCH_ALLOW_MAINNET_BROADCAST, false),
  minBchnVersion: semanticVersionFromEnv("BCH_MIN_BCHN_VERSION", env.BCH_MIN_BCHN_VERSION, "29.0.0"),
  network: networkFromEnv(env.BCH_NETWORK),
  regtestUpgrade12Active: booleanFromEnv(env.BCH_REGTEST_UPGRADE12_ACTIVE, true),
  rpc: {
    password: requiredStringFromEnv("BCH_RPC_PASSWORD", env.BCH_RPC_PASSWORD, "bchex-dev-only-change-me"),
    timeoutMs: positiveIntegerFromEnv("BCH_RPC_TIMEOUT_MS", env.BCH_RPC_TIMEOUT_MS, 10_000, 120_000),
    url: rpcUrlFromEnv(env.BCH_RPC_URL),
    user: requiredStringFromEnv("BCH_RPC_USER", env.BCH_RPC_USER, "bchex")
  }
});
