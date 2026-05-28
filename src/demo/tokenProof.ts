export interface DemoTokenData {
  readonly amount?: string;
  readonly category: string;
  readonly nft?: {
    readonly capability?: string;
    readonly commitment?: string;
  };
}

export interface DemoTokenProofSummary {
  readonly amount: string;
  readonly category: string;
  readonly hasMintingNft: boolean;
}

const tokenCategoryPattern = /^[0-9a-f]{64}$/i;
const tokenAmountPattern = /^[0-9]+$/;
const tokenNftCapabilityPattern = /^(?:minting|mutable|none)$/;
const hexBytecodePattern = /^(?:[0-9a-f]{2})*$/i;

const assertDemoTokenNftData = (nft: DemoTokenData["nft"]): void => {
  if (nft === undefined) return;

  if (typeof nft.capability !== "string" || !tokenNftCapabilityPattern.test(nft.capability)) {
    throw new Error("CashToken NFT capability must be minting, mutable, or none.");
  }
  if (typeof nft.commitment !== "string" || !hexBytecodePattern.test(nft.commitment)) {
    throw new Error("CashToken NFT commitment must be even-length hex bytecode.");
  }
};

export const summarizeDemoTokenData = (tokenData: DemoTokenData): DemoTokenProofSummary => {
  if (!tokenCategoryPattern.test(tokenData.category)) {
    throw new Error("CashToken category must be a 32-byte transaction id.");
  }
  if (tokenData.amount !== undefined && !tokenAmountPattern.test(tokenData.amount)) {
    throw new Error("CashToken amount must be an integer string.");
  }
  assertDemoTokenNftData(tokenData.nft);

  return {
    amount: tokenData.amount ?? "0",
    category: tokenData.category.toLowerCase(),
    hasMintingNft: tokenData.nft?.capability === "minting"
  };
};
