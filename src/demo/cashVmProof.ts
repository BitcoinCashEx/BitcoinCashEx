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

  return decodeCashVmProofText(bytes.subarray(offset, offset + length).toString("utf8"));
};

export const extractFinalPushDataHex = (scriptHex: string): string | undefined => {
  if (!/^(?:[0-9a-f]{2})*$/i.test(scriptHex)) return undefined;

  const bytes = Buffer.from(scriptHex, "hex");
  let offset = 0;
  let finalPush: Buffer | undefined;

  while (offset < bytes.length) {
    const opcode = bytes[offset];
    if (opcode === undefined) return undefined;
    offset += 1;

    if (opcode >= 0x01 && opcode <= 0x4b) {
      if (bytes.length < offset + opcode) return undefined;
      finalPush = bytes.subarray(offset, offset + opcode);
      offset += opcode;
      continue;
    }

    if (opcode === 0x4c) {
      const length = bytes[offset];
      if (length === undefined) return undefined;
      offset += 1;
      if (bytes.length < offset + length) return undefined;
      finalPush = bytes.subarray(offset, offset + length);
      offset += length;
      continue;
    }

    return undefined;
  }

  return finalPush?.toString("hex");
};
