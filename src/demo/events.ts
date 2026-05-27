import { createCashTokenAsset } from "../defi/assets.js";
import type { BondingCurveBuyQuote, BondingCurveSellQuote, BondingCurveState } from "../defi/bondingCurve.js";
import {
  buyLaunchTokens,
  createTokenLaunch,
  graduateTokenLaunch,
  remainingLaunchTokenSupply,
  sellLaunchTokens,
  type TokenLaunchGraduation,
  type TokenLaunchState
} from "../defi/launchpad.js";

export type DemoEventInput =
  | {
      readonly decimals: number;
      readonly feeBps: number;
      readonly graduationThresholdBchSats: bigint;
      readonly kind: "CREATE";
      readonly maxSupply: bigint;
      readonly symbol: string;
      readonly virtualBchReserveSats: bigint;
      readonly virtualTokenReserve: bigint;
    }
  | { readonly bchAmountInSats: bigint; readonly kind: "BUY" }
  | { readonly kind: "SELL"; readonly tokenAmountIn: bigint }
  | { readonly category: string; readonly kind: "TOKEN"; readonly tokenGenesisTxid: string }
  | { readonly kind: "GRADUATE" };

export interface DemoChainEvent {
  readonly height: number;
  readonly input: DemoEventInput;
  readonly time: number;
  readonly txid: string;
}

export interface DemoHistoryEntry {
  readonly event: DemoChainEvent;
  readonly graduation?: TokenLaunchGraduation;
  readonly quote?: BondingCurveBuyQuote | BondingCurveSellQuote;
  readonly statusAfter?: string;
}

export interface DemoReplayState {
  readonly graduation?: TokenLaunchGraduation;
  readonly history: readonly DemoHistoryEntry[];
  readonly launch?: TokenLaunchState;
}

const eventPrefix = "BCHEX1";

const assertEventPart = (name: string, value: string): void => {
  if (value.length === 0 || value.includes("|")) {
    throw new Error(`${name} cannot be empty or contain pipe delimiters.`);
  }
};

const assertEventSymbol = (symbol: string): void => {
  assertEventPart("symbol", symbol);
  if (!/^[A-Z0-9]{2,16}$/.test(symbol)) {
    throw new Error("symbol must use 2 to 16 uppercase letters or numbers.");
  }
};

const parseBigint = (name: string, value: string | undefined): bigint => {
  if (value === undefined || !/^[0-9]+$/.test(value)) {
    throw new Error(`${name} must be a non-negative integer string.`);
  }
  return BigInt(value);
};

const parsePositiveBigint = (name: string, value: string | undefined): bigint => {
  const parsed = parseBigint(name, value);
  if (parsed <= 0n) {
    throw new Error(`${name} must be positive.`);
  }
  return parsed;
};

const parseNumber = (name: string, value: string | undefined, max: number): number => {
  if (value === undefined || !/^[0-9]+$/.test(value)) {
    throw new Error(`${name} must be a non-negative integer string.`);
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed) || parsed > max) {
    throw new Error(`${name} must be an integer from 0 to ${max}.`);
  }
  return parsed;
};

const txidPattern = /^[0-9a-f]{64}$/i;

const parseTxid = (name: string, value: string | undefined): string => {
  if (value === undefined || !txidPattern.test(value)) {
    throw new Error(`${name} must be a 32-byte transaction id.`);
  }
  return value.toLowerCase();
};

const requirePartCount = (kind: string, parts: readonly string[], expected: number): void => {
  if (parts.length !== expected) {
    throw new Error(`${kind} event must contain exactly ${expected} fields.`);
  }
};

export const encodeDemoEventText = (event: DemoEventInput): string => {
  if (event.kind === "CREATE") {
    assertEventSymbol(event.symbol);
    return [
      eventPrefix,
      event.kind,
      event.symbol,
      event.decimals.toString(),
      event.maxSupply.toString(),
      event.virtualBchReserveSats.toString(),
      event.virtualTokenReserve.toString(),
      event.feeBps.toString(),
      event.graduationThresholdBchSats.toString()
    ].join("|");
  }

  if (event.kind === "BUY") {
    return [eventPrefix, event.kind, event.bchAmountInSats.toString()].join("|");
  }

  if (event.kind === "SELL") {
    return [eventPrefix, event.kind, event.tokenAmountIn.toString()].join("|");
  }

  if (event.kind === "TOKEN") {
    return [eventPrefix, event.kind, parseTxid("category", event.category), parseTxid("tokenGenesisTxid", event.tokenGenesisTxid)].join("|");
  }

  return [eventPrefix, event.kind].join("|");
};

export const decodeDemoEventText = (text: string): DemoEventInput | undefined => {
  const parts = text.split("|");
  if (parts[0] !== eventPrefix) return undefined;

  const kind = parts[1];
  if (kind === "CREATE") {
    requirePartCount(kind, parts, 9);
    assertEventSymbol(parts[2] ?? "");
    return {
      decimals: parseNumber("decimals", parts[3], 18),
      feeBps: parseNumber("feeBps", parts[7], 9_999),
      graduationThresholdBchSats: parsePositiveBigint("graduationThresholdBchSats", parts[8]),
      kind,
      maxSupply: parsePositiveBigint("maxSupply", parts[4]),
      symbol: parts[2] ?? "",
      virtualBchReserveSats: parsePositiveBigint("virtualBchReserveSats", parts[5]),
      virtualTokenReserve: parsePositiveBigint("virtualTokenReserve", parts[6])
    };
  }

  if (kind === "BUY") {
    requirePartCount(kind, parts, 3);
    return {
      bchAmountInSats: parsePositiveBigint("bchAmountInSats", parts[2]),
      kind
    };
  }

  if (kind === "SELL") {
    requirePartCount(kind, parts, 3);
    return {
      kind,
      tokenAmountIn: parsePositiveBigint("tokenAmountIn", parts[2])
    };
  }

  if (kind === "TOKEN") {
    requirePartCount(kind, parts, 4);
    return {
      category: parseTxid("category", parts[2]),
      kind,
      tokenGenesisTxid: parseTxid("tokenGenesisTxid", parts[3])
    };
  }

  if (kind === "GRADUATE") {
    requirePartCount(kind, parts, 2);
    return { kind };
  }

  throw new Error(`Unknown demo event kind: ${kind ?? "missing"}`);
};

export const eventTextToHex = (text: string): string => Buffer.from(text, "utf8").toString("hex");

export const eventHexToText = (hex: string): string => Buffer.from(hex, "hex").toString("utf8");

export const parseOpReturnText = (scriptHex: string): string | undefined => {
  if (!/^(?:[0-9a-f]{2})*$/i.test(scriptHex)) return undefined;

  const bytes = Buffer.from(scriptHex, "hex");
  if (bytes[0] !== 0x6a || bytes[1] === undefined) return undefined;

  const opcode = bytes[1];
  let offset = 2;
  let length: number;
  if (opcode === 0x00 || (opcode >= 0x01 && opcode <= 0x4b)) {
    length = opcode;
  } else if (opcode === 0x4c) {
    const pushDataLength = bytes[2];
    if (pushDataLength === undefined) return undefined;
    length = pushDataLength;
    offset = 3;
  } else {
    return undefined;
  }
  if (bytes.length < offset + length) return undefined;
  if (bytes.length !== offset + length) return undefined;

  return bytes.subarray(offset, offset + length).toString("utf8");
};

export const parseOpReturnEvent = (scriptHex: string): DemoEventInput | undefined => {
  const text = parseOpReturnText(scriptHex);
  if (text === undefined) return undefined;
  try {
    return decodeDemoEventText(text);
  } catch {
    return undefined;
  }
};

export const replayDemoEvents = (events: readonly DemoChainEvent[]): DemoReplayState => {
  let launch: TokenLaunchState | undefined;
  let graduation: TokenLaunchGraduation | undefined;
  const history: DemoHistoryEntry[] = [];

  const ordered = [...events].sort((left, right) => left.height - right.height || left.txid.localeCompare(right.txid));

  for (const event of ordered) {
    if (event.input.kind === "CREATE") {
      if (launch !== undefined) throw new Error("Launch already exists.");
      const curve: BondingCurveState = {
        currentSupply: 0n,
        maxSupply: event.input.maxSupply,
        virtualBchReserveSats: event.input.virtualBchReserveSats,
        virtualTokenReserve: event.input.virtualTokenReserve
      };
      launch = createTokenLaunch({
        asset: createCashTokenAsset({
          category: event.txid,
          decimals: event.input.decimals,
          symbol: event.input.symbol
        }),
        curve,
        feeBps: event.input.feeBps,
        graduationThresholdBchSats: event.input.graduationThresholdBchSats
      });
      history.push({ event, statusAfter: launch.status });
      continue;
    }

    if (launch === undefined) throw new Error("Launch has not been created.");

    if (event.input.kind === "BUY") {
      const result = buyLaunchTokens(launch, event.input.bchAmountInSats);
      launch = result.nextLaunch;
      history.push({ event, quote: result.quote, statusAfter: launch.status });
      continue;
    }

    if (event.input.kind === "SELL") {
      const result = sellLaunchTokens(launch, event.input.tokenAmountIn);
      launch = result.nextLaunch;
      history.push({ event, quote: result.quote, statusAfter: launch.status });
      continue;
    }

    if (event.input.kind === "TOKEN") {
      launch = {
        ...launch,
        asset: {
          ...launch.asset,
          category: event.input.category
        }
      };
      graduation =
        graduation === undefined
          ? undefined
          : {
              ...graduation,
              asset: launch.asset
            };
      history.push({ event, statusAfter: launch.status });
      continue;
    }

    const result = graduateTokenLaunch(launch);
    launch = result.nextLaunch;
    graduation = result.graduation;
    history.push({ event, graduation, statusAfter: launch.status });
  }

  return {
    ...(graduation === undefined ? {} : { graduation }),
    history,
    ...(launch === undefined ? {} : { launch })
  };
};

export const summarizeLaunch = (launch: TokenLaunchState | undefined) =>
  launch === undefined
    ? undefined
    : {
        asset: launch.asset,
        bchEscrowSats: launch.bchEscrowSats.toString(),
        currentSupply: launch.curve.currentSupply.toString(),
        feeBps: launch.feeBps,
        feesCollectedBchSats: launch.feesCollectedBchSats.toString(),
        graduationThresholdBchSats: launch.graduationThresholdBchSats.toString(),
        remainingTokenSupply: remainingLaunchTokenSupply(launch).toString(),
        status: launch.status,
        virtualBchReserveSats: launch.curve.virtualBchReserveSats.toString(),
        virtualTokenReserve: launch.curve.virtualTokenReserve.toString()
      };
