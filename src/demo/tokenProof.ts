export interface DemoTokenData {
  readonly amount?: string;
  readonly category: string;
  readonly nft?: {
    readonly capability?: "minting" | "mutable" | "none";
    readonly commitment?: string;
  };
}

export interface DemoTokenProofSummary {
  readonly amount: string;
  readonly category: string;
  readonly hasMintingNft: boolean;
}

export const summarizeDemoTokenData = (tokenData: DemoTokenData): DemoTokenProofSummary => {
  if (!/^[0-9a-f]{64}$/i.test(tokenData.category)) {
    throw new Error("CashToken category must be a 32-byte transaction id.");
  }
  if (tokenData.amount !== undefined && !/^[0-9]+$/.test(tokenData.amount)) {
    throw new Error("CashToken amount must be an integer string.");
  }

  return {
    amount: tokenData.amount ?? "0",
    category: tokenData.category.toLowerCase(),
    hasMintingNft: tokenData.nft?.capability === "minting"
  };
};

