export const satsPerBch = 100_000_000n;
export const maxBchSupplySats = 21_000_000n * satsPerBch;

const maxBchSupply = Number(maxBchSupplySats) / Number(satsPerBch);
const fractionalSatoshiTolerance = 1e-6;

export const satsToBch = (sats: bigint): string => {
  if (sats < 0n || sats > maxBchSupplySats) {
    throw new Error("BCH amount in sats must be within the valid monetary range.");
  }

  const whole = sats / satsPerBch;
  const fraction = (sats % satsPerBch).toString().padStart(8, "0");
  return `${whole}.${fraction}`;
};

export const bchToSats = (value: number): bigint => {
  if (!Number.isFinite(value) || value < 0 || value > maxBchSupply) {
    throw new Error("BCH amount must be a finite non-negative value within the valid monetary range.");
  }

  const scaled = value * Number(satsPerBch);
  const rounded = Math.round(scaled);
  if (!Number.isSafeInteger(rounded) || Math.abs(scaled - rounded) > fractionalSatoshiTolerance) {
    throw new Error("BCH amount must resolve to whole satoshis.");
  }

  const sats = BigInt(rounded);
  if (sats > maxBchSupplySats) {
    throw new Error("BCH amount must be within the valid monetary range.");
  }
  return sats;
};
