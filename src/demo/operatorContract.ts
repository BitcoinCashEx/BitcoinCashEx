import {
  encodeLockingBytecodeP2sh20,
  hash160,
  lockingBytecodeToCashAddress,
  privateKeyToP2pkhLockingBytecode
} from "@bitauth/libauth";
import { extractFinalPushDataHex } from "./cashVmProof.js";

export interface DemoOperatorP2shContract {
  readonly address: string;
  readonly redeemScript: string;
  readonly scriptPubKey: string;
}

export interface DemoP2shSpendAudit {
  readonly derivedScriptPubKey?: string;
  readonly expectedScriptPubKey: string;
  readonly problems: readonly string[];
  readonly redeemScript?: string;
  readonly status: "failed" | "verified";
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

export const auditDemoP2shSpend = ({
  expectedScriptPubKey,
  scriptSigHex
}: {
  readonly expectedScriptPubKey: string;
  readonly scriptSigHex: string;
}): DemoP2shSpendAudit => {
  const expected = expectedScriptPubKey.toLowerCase();
  const problems: string[] = [];
  const redeemScript = extractFinalPushDataHex(scriptSigHex);

  if (redeemScript === undefined) {
    problems.push("P2SH spend did not reveal a final redeem script push.");
    return {
      expectedScriptPubKey: expected,
      problems,
      status: "failed"
    };
  }

  const derivedScriptPubKey = deriveDemoP2shContract(redeemScript).scriptPubKey.toLowerCase();
  if (derivedScriptPubKey !== expected) {
    problems.push("Redeem script hash does not match the spent CashVM P2SH pool script.");
  }

  return {
    derivedScriptPubKey,
    expectedScriptPubKey: expected,
    problems,
    redeemScript,
    status: problems.length === 0 ? "verified" : "failed"
  };
};
