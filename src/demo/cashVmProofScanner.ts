import { extractFinalPushDataHex, parseCashVmProofScript } from "./cashVmProof.js";
import { deriveDemoP2shContract } from "./operatorContract.js";

export interface DemoCashVmProof {
  readonly contractScriptPubKey: string;
  readonly contractTxid: string;
  readonly height: number;
  readonly redeemScript: string;
  readonly spendTxid: string;
}

export interface DemoCashVmProofTx {
  readonly txid: string;
  readonly vin: readonly {
    readonly scriptSig?: {
      readonly hex: string;
    };
    readonly txid?: string;
  }[];
  readonly vout: readonly {
    readonly scriptPubKey: {
      readonly hex: string;
    };
  }[];
}

export const extractDemoCashVmProofsFromTx = (
  tx: DemoCashVmProofTx,
  height: number
): readonly DemoCashVmProof[] => {
  const proofs: DemoCashVmProof[] = [];

  for (const output of tx.vout) {
    const proof = parseCashVmProofScript(output.scriptPubKey.hex);
    if (proof === undefined) continue;

    const spendInput = tx.vin.find((input) => input.txid === proof.contractTxid);
    const scriptSigHex = spendInput?.scriptSig?.hex;
    if (scriptSigHex === undefined) continue;

    const redeemScript = extractFinalPushDataHex(scriptSigHex);
    if (redeemScript === undefined) continue;

    proofs.push({
      contractScriptPubKey: deriveDemoP2shContract(redeemScript).scriptPubKey,
      contractTxid: proof.contractTxid,
      height,
      redeemScript,
      spendTxid: tx.txid
    });
  }

  return proofs;
};
