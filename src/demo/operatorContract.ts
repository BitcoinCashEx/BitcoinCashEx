import {
  encodeLockingBytecodeP2sh20,
  hash160,
  lockingBytecodeToCashAddress,
  privateKeyToP2pkhLockingBytecode
} from "@bitauth/libauth";

export interface DemoOperatorP2shContract {
  readonly address: string;
  readonly redeemScript: string;
  readonly scriptPubKey: string;
}

const toHex = (value: Uint8Array): string => Buffer.from(value).toString("hex");

export const deriveDemoP2shContract = (
  redeemScript: string,
  prefix: "bchreg" | "bitcoincash" | "bchtest" = "bchreg"
): DemoOperatorP2shContract => {
  const redeemBytecode = Buffer.from(redeemScript, "hex");
  const scriptPubKey = encodeLockingBytecodeP2sh20(hash160(redeemBytecode));
  const addressResult = lockingBytecodeToCashAddress({ bytecode: scriptPubKey, prefix });
  if (typeof addressResult === "string") {
    throw new Error(addressResult);
  }

  return {
    address: addressResult.address,
    redeemScript,
    scriptPubKey: toHex(scriptPubKey)
  };
};

export const createDemoOperatorP2shContract = (
  privateKey: Uint8Array,
  prefix: "bchreg" | "bitcoincash" | "bchtest" = "bchreg"
): DemoOperatorP2shContract => {
  const redeemBytecode = privateKeyToP2pkhLockingBytecode({ privateKey });
  if (typeof redeemBytecode === "string") {
    throw new Error(redeemBytecode);
  }

  return deriveDemoP2shContract(toHex(redeemBytecode), prefix);
};
