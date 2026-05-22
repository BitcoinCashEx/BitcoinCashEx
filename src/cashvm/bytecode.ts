import { binToHex, hexToBin, isHex } from "@bitauth/libauth";

export const normalizeHexBytecode = (hex: string): string => {
  const normalized = hex.trim().toLowerCase();
  if (normalized.length % 2 !== 0 || !isHex(normalized)) {
    throw new Error("CashVM bytecode must be even-length hexadecimal.");
  }
  return binToHex(hexToBin(normalized));
};

