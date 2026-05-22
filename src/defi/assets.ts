import { normalizeHexBytecode } from "../cashvm/bytecode.js";

export interface BchAsset {
  readonly decimals: 8;
  readonly kind: "bch";
  readonly symbol: "BCH";
}

export interface CashTokenAsset {
  readonly category: string;
  readonly decimals: number;
  readonly kind: "cashToken";
  readonly symbol: string;
}

export type PoolAsset = BchAsset | CashTokenAsset;

export const bchAsset: BchAsset = {
  decimals: 8,
  kind: "bch",
  symbol: "BCH"
};

export const createCashTokenAsset = (input: {
  readonly category: string;
  readonly decimals: number;
  readonly symbol: string;
}): CashTokenAsset => {
  const category = normalizeHexBytecode(input.category);
  if (category.length !== 64) {
    throw new Error("CashToken category must be exactly 32 bytes.");
  }
  if (!Number.isInteger(input.decimals) || input.decimals < 0 || input.decimals > 18) {
    throw new Error("CashToken decimals must be an integer from 0 to 18.");
  }
  if (!/^[A-Z0-9]{2,16}$/.test(input.symbol)) {
    throw new Error("CashToken symbol must use 2 to 16 uppercase letters or numbers.");
  }

  return {
    category,
    decimals: input.decimals,
    kind: "cashToken",
    symbol: input.symbol
  };
};

