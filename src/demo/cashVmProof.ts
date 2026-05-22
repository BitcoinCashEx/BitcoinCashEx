export const cashVmProofPrefix = "BCHEX1|CASHVM|";

export interface DemoCashVmProofEvent {
  readonly contractTxid: string;
}

export const encodeCashVmProofText = (contractTxid: string): string => {
  if (!/^[0-9a-f]{64}$/i.test(contractTxid)) {
    throw new Error("CashVM proof contract txid must be a 32-byte transaction id.");
  }
  return `${cashVmProofPrefix}${contractTxid.toLowerCase()}`;
};

export const decodeCashVmProofText = (text: string): DemoCashVmProofEvent | undefined => {
  if (!text.startsWith(cashVmProofPrefix)) return undefined;
  const contractTxid = text.slice(cashVmProofPrefix.length);
  if (!/^[0-9a-f]{64}$/i.test(contractTxid)) {
    throw new Error("CashVM proof contract txid must be a 32-byte transaction id.");
  }
  return { contractTxid: contractTxid.toLowerCase() };
};

export const parseCashVmProofScript = (scriptHex: string): DemoCashVmProofEvent | undefined => {
  const bytes = Buffer.from(scriptHex, "hex");
  if (bytes[0] !== 0x6a || bytes[1] === undefined) return undefined;

  let offset = 2;
  let length = bytes[1];
  if (length === 0x4c) {
    const pushDataLength = bytes[2];
    if (pushDataLength === undefined) return undefined;
    length = pushDataLength;
    offset = 3;
  }
  if (bytes.length < offset + length) return undefined;

  return decodeCashVmProofText(bytes.subarray(offset, offset + length).toString("utf8"));
};

