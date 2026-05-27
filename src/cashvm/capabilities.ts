import type { BchNetwork } from "../config.js";

export const latestStableBchnVersion = "29.0.0";

export const cashVmMay2026Upgrade = {
  chipnetActivationTime: 1_763_208_000,
  chips: [
    "CHIP-2024-12 P2S: Pay to Script",
    "CHIP-2021-05-loops: Bounded Looping Operations",
    "CHIP-2025-05 Functions: Function Definition and Invocation Operations",
    "CHIP-2025-05 Bitwise: Re-Enable Bitwise Operations"
  ],
  mainnetActivationTime: 1_778_846_400
} as const;

export const isCashVmMay2026Active = (
  network: BchNetwork,
  medianTimePast: number,
  regtestUpgrade12Active: boolean
): boolean => {
  if (network === "regtest") return regtestUpgrade12Active;
  if (network === "chip") return medianTimePast >= cashVmMay2026Upgrade.chipnetActivationTime;
  return medianTimePast >= cashVmMay2026Upgrade.mainnetActivationTime;
};

const semanticVersionPattern = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/;

export const compareSemver = (left: string, right: string): number => {
  const parse = (value: string): readonly number[] => {
    if (!semanticVersionPattern.test(value)) {
      throw new Error(`Invalid semantic version: ${value}`);
    }
    return value.split(".").map((part) => Number.parseInt(part, 10));
  };
  const leftParts = parse(left);
  const rightParts = parse(right);

  for (let index = 0; index < 3; index += 1) {
    const delta = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (delta !== 0) return delta;
  }
  return 0;
};
