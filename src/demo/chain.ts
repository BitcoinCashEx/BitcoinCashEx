import { hexToBin, privateKeyToP2pkhCashAddress, privateKeyToP2pkhLockingBytecode } from "@bitauth/libauth";
import { loadConfig } from "../config.js";
import { BchnRpcClient } from "../node/rpc.js";
import { eventHexToText, eventTextToHex, parseOpReturnEvent, replayDemoEvents, type DemoChainEvent, type DemoEventInput } from "./events.js";
import { summarizeDemoTokenData, type DemoTokenData } from "./tokenProof.js";

export const demoPrivateKeyHex = "0000000000000000000000000000000000000000000000000000000000000001";
export const demoPrivateKeyWif = "cMahea7zqjxrtgAbB7LSGbcQUr1uX1ojuat9jZodMN87JcbXMTcA";

const privateKey = hexToBin(demoPrivateKeyHex);
const addressResult = privateKeyToP2pkhCashAddress({ privateKey, prefix: "bchreg" });
if (typeof addressResult === "string") {
  throw new Error(addressResult);
}

const lockingBytecodeResult = privateKeyToP2pkhLockingBytecode({ privateKey });
if (typeof lockingBytecodeResult === "string") {
  throw new Error(lockingBytecodeResult);
}

export const demoAddress = addressResult.address;
export const demoScriptPubKey = Buffer.from(lockingBytecodeResult).toString("hex");

interface BlockTx {
  readonly txid: string;
  readonly vin: readonly { readonly coinbase?: string }[];
  readonly vout: readonly {
    readonly n: number;
    readonly scriptPubKey: {
      readonly addresses?: readonly string[];
      readonly hex: string;
      readonly type?: string;
    };
    readonly tokenData?: TokenData;
    readonly value: number;
  }[];
}

interface BlockVerbose {
  readonly height: number;
  readonly time: number;
  readonly tx: readonly BlockTx[];
}

interface TxOutInfo {
  readonly scriptPubKey: {
    readonly hex: string;
  };
  readonly tokenData?: TokenData;
  readonly value: number;
}

export type TokenData = DemoTokenData;

interface SpendableUtxo {
  readonly amountSats: bigint;
  readonly scriptPubKey: string;
  readonly tokenData?: TokenData;
  readonly txid: string;
  readonly vout: number;
}

interface SignedRawTransaction {
  readonly complete: boolean;
  readonly errors?: readonly unknown[];
  readonly hex: string;
}

interface TestMempoolAcceptResult {
  readonly allowed: boolean;
  readonly "reject-reason"?: string;
}

export interface DemoChainSnapshot {
  readonly blockCount: number;
  readonly events: readonly DemoChainEvent[];
  readonly replay: ReturnType<typeof replayDemoEvents>;
  readonly tokenProofs: readonly DemoTokenProof[];
  readonly wallet: {
    readonly address: string;
    readonly balanceSats: string;
    readonly spendableUtxos: number;
  };
}

export interface DemoTokenProof {
  readonly height: number;
  readonly tokenData: TokenData;
  readonly txid: string;
  readonly valueSats: string;
  readonly vout: number;
}

const config = loadConfig();
const rpc = new BchnRpcClient(config);

const satsToBch = (sats: bigint): string => {
  const whole = sats / 100_000_000n;
  const fraction = (sats % 100_000_000n).toString().padStart(8, "0");
  return `${whole}.${fraction}`;
};

const bchToSats = (value: number): bigint => BigInt(Math.round(value * 100_000_000));

const getBlockByHeight = async (height: number): Promise<BlockVerbose> => {
  const hash = await rpc.call<string>("getblockhash", [height]);
  return rpc.call<BlockVerbose>("getblock", [hash, 2]);
};

const findSpendableUtxos = async (): Promise<readonly SpendableUtxo[]> => {
  const blockCount = await rpc.call<number>("getblockcount");
  const utxos: SpendableUtxo[] = [];

  for (let height = 1; height <= blockCount; height += 1) {
    const block = await getBlockByHeight(height);
    for (const tx of block.tx) {
      const coinbase = tx.vin.some((input) => input.coinbase !== undefined);
      if (coinbase && blockCount - height < 100) continue;

      for (const output of tx.vout) {
        if (!output.scriptPubKey.addresses?.includes(demoAddress)) continue;

        const txout = await rpc.call<TxOutInfo | null>("gettxout", [tx.txid, output.n, true]);
        if (txout === null) continue;
        if (txout.tokenData !== undefined) continue;

        utxos.push({
          amountSats: bchToSats(txout.value),
          scriptPubKey: txout.scriptPubKey.hex,
          txid: tx.txid,
          vout: output.n
        });
      }
    }
  }

  return utxos.sort((left, right) => (left.amountSats < right.amountSats ? -1 : 1));
};

export const scanDemoTokenProofs = async (): Promise<readonly DemoTokenProof[]> => {
  const blockCount = await rpc.call<number>("getblockcount");
  const proofs: DemoTokenProof[] = [];

  for (let height = 1; height <= blockCount; height += 1) {
    const block = await getBlockByHeight(height);
    for (const tx of block.tx) {
      for (const output of tx.vout) {
        if (output.tokenData === undefined) continue;
        summarizeDemoTokenData(output.tokenData);
        proofs.push({
          height,
          tokenData: output.tokenData,
          txid: tx.txid,
          valueSats: bchToSats(output.value).toString(),
          vout: output.n
        });
      }
    }
  }

  return proofs;
};

export const ensureDemoFunding = async (): Promise<void> => {
  const utxos = await findSpendableUtxos();
  const balance = utxos.reduce((sum, utxo) => sum + utxo.amountSats, 0n);
  if (balance >= 100_000n) return;

  await rpc.call<readonly string[]>("generatetoaddress", [101, demoAddress]);
};

export const mineDemoBlock = async (): Promise<void> => {
  await rpc.call<readonly string[]>("generatetoaddress", [1, demoAddress]);
};

export const scanDemoEvents = async (): Promise<readonly DemoChainEvent[]> => {
  const blockCount = await rpc.call<number>("getblockcount");
  const events: DemoChainEvent[] = [];

  for (let height = 1; height <= blockCount; height += 1) {
    const block = await getBlockByHeight(height);
    for (const tx of block.tx) {
      for (const output of tx.vout) {
        const input = parseOpReturnEvent(output.scriptPubKey.hex);
        if (input !== undefined) {
          events.push({ height, input, time: block.time, txid: tx.txid });
        }
      }
    }
  }

  return events;
};

export const getDemoSnapshot = async (): Promise<DemoChainSnapshot> => {
  const [blockCount, events, tokenProofs, utxos] = await Promise.all([
    rpc.call<number>("getblockcount"),
    scanDemoEvents(),
    scanDemoTokenProofs(),
    findSpendableUtxos()
  ]);

  return {
    blockCount,
    events,
    replay: replayDemoEvents(events),
    tokenProofs,
    wallet: {
      address: demoAddress,
      balanceSats: utxos.reduce((sum, utxo) => sum + utxo.amountSats, 0n).toString(),
      spendableUtxos: utxos.length
    }
  };
};

const signAndSubmit = async (raw: string, utxo: SpendableUtxo): Promise<string> => {
  const signed = await rpc.call<SignedRawTransaction>("signrawtransactionwithkey", [
    raw,
    [demoPrivateKeyWif],
    [
      {
        amount: satsToBch(utxo.amountSats),
        scriptPubKey: utxo.scriptPubKey,
        ...(utxo.tokenData === undefined ? {} : { tokenData: utxo.tokenData }),
        txid: utxo.txid,
        vout: utxo.vout
      }
    ],
    "ALL|FORKID"
  ]);

  if (!signed.complete) {
    throw new Error(`Demo transaction signing failed: ${JSON.stringify(signed.errors ?? [])}`);
  }

  const [acceptance] = await rpc.call<readonly TestMempoolAcceptResult[]>("testmempoolaccept", [[signed.hex]]);
  if (acceptance === undefined || !acceptance.allowed) {
    throw new Error(`Demo transaction rejected: ${acceptance?.["reject-reason"] ?? "unknown reason"}`);
  }

  return rpc.call<string>("sendrawtransaction", [signed.hex]);
};

export const submitDemoEvent = async (event: DemoEventInput): Promise<string> => {
  await ensureDemoFunding();
  const [utxo] = await findSpendableUtxos();
  if (utxo === undefined) {
    throw new Error("No spendable demo UTXO is available after funding.");
  }

  const feeSats = 1_000n;
  const changeSats = utxo.amountSats - feeSats;
  if (changeSats <= 546n) {
    throw new Error("Demo UTXO is too small to submit an event transaction.");
  }

  const eventHex = eventTextToHex(
    event.kind === "CREATE"
      ? [
          "BCHEX1",
          "CREATE",
          event.symbol,
          event.decimals,
          event.maxSupply,
          event.virtualBchReserveSats,
          event.virtualTokenReserve,
          event.feeBps,
          event.graduationThresholdBchSats
        ].join("|")
      : event.kind === "BUY"
        ? ["BCHEX1", "BUY", event.bchAmountInSats].join("|")
        : event.kind === "SELL"
          ? ["BCHEX1", "SELL", event.tokenAmountIn].join("|")
          : "BCHEX1|GRADUATE"
  );

  const raw = await rpc.call<string>("createrawtransaction", [
    [{ txid: utxo.txid, vout: utxo.vout }],
    [{ data: eventHex }, { [demoAddress]: satsToBch(changeSats) }]
  ]);
  const txid = await signAndSubmit(raw, utxo);
  await mineDemoBlock();
  return txid;
};

export const createDemoCashToken = async (): Promise<{
  readonly category: string;
  readonly preGenesisTxid: string;
  readonly tokenGenesisTxid: string;
}> => {
  await ensureDemoFunding();
  const [fundingUtxo] = await findSpendableUtxos();
  if (fundingUtxo === undefined) {
    throw new Error("No spendable demo UTXO is available for token genesis.");
  }

  const preGenesisValueSats = fundingUtxo.amountSats - 1_000n;
  if (preGenesisValueSats <= 2_000n) {
    throw new Error("Demo UTXO is too small for CashToken genesis.");
  }

  const preGenesisRaw = await rpc.call<string>("createrawtransaction", [
    [{ txid: fundingUtxo.txid, vout: fundingUtxo.vout }],
    [{ [demoAddress]: satsToBch(preGenesisValueSats) }]
  ]);
  const preGenesisTxid = await signAndSubmit(preGenesisRaw, fundingUtxo);
  await mineDemoBlock();

  const preGenesisUtxo = await rpc.call<TxOutInfo | null>("gettxout", [preGenesisTxid, 0, true]);
  if (preGenesisUtxo === null) {
    throw new Error("Pre-genesis UTXO was not found after mining.");
  }

  const tokenUtxo: SpendableUtxo = {
    amountSats: bchToSats(preGenesisUtxo.value),
    scriptPubKey: preGenesisUtxo.scriptPubKey.hex,
    txid: preGenesisTxid,
    vout: 0
  };
  const tokenValueSats = tokenUtxo.amountSats - 1_000n;

  const tokenGenesisRaw = await rpc.call<string>("createrawtransaction", [
    [{ txid: tokenUtxo.txid, vout: tokenUtxo.vout }],
    [
      {
        [demoAddress]: {
          amount: satsToBch(tokenValueSats),
          tokenData: {
            amount: "900000",
            category: preGenesisTxid,
            nft: {
              capability: "minting",
              commitment: "00"
            }
          }
        }
      }
    ]
  ]);
  const tokenGenesisTxid = await signAndSubmit(tokenGenesisRaw, tokenUtxo);
  await mineDemoBlock();

  return {
    category: preGenesisTxid,
    preGenesisTxid,
    tokenGenesisTxid
  };
};

export const getDecodedTransaction = async (txid: string) => {
  const tx = await rpc.call<{
    readonly blockhash?: string;
    readonly confirmations?: number;
    readonly hex: string;
    readonly txid: string;
    readonly vout: readonly { readonly scriptPubKey: { readonly hex: string }; readonly value: number }[];
  }>("getrawtransaction", [txid, true]);

  const event = tx.vout
    .map((output) => parseOpReturnEvent(output.scriptPubKey.hex))
    .find((entry) => entry !== undefined);

  const text = tx.vout
    .map((output) => {
      const parsed = parseOpReturnEvent(output.scriptPubKey.hex);
      if (parsed === undefined) return undefined;
      const hex = output.scriptPubKey.hex;
      const length = Number.parseInt(hex.slice(2, 4), 16);
      return eventHexToText(hex.slice(4, 4 + length * 2));
    })
    .find((entry) => entry !== undefined);

  return { event, eventText: text, tx };
};
