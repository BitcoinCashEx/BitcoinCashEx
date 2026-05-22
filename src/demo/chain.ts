import { hexToBin, privateKeyToP2pkhCashAddress, privateKeyToP2pkhLockingBytecode } from "@bitauth/libauth";
import { loadConfig } from "../config.js";
import { BchnRpcClient } from "../node/rpc.js";
import {
  auditDemoAmmTradeTransition,
  buildDemoAmmProofPackReceipt,
  demoAmmSwapFeeSats,
  demoAmmTokenOutputDustSats,
  demoAmmWalletChangeDustSats,
  encodeDemoAmmPoolMarkerText,
  encodeDemoAmmTradeMarkerText,
  findDemoAmmTransitionAuditByTxid,
  parseDemoAmmPoolMarkerScript,
  parseDemoAmmTradeMarkerScript,
  quoteDemoAmmBuy,
  quoteDemoAmmSell,
  requireDemoAmmPoolTokenData,
  selectDemoAmmSellTokenUtxo,
  selectDemoAmmSwapFundingUtxo,
  summarizeDemoAmmPool,
  type DemoAmmProofPackReceipt,
  type DemoAmmPoolUtxo,
  type DemoAmmTransitionAudit
} from "./ammProof.js";
import { encodeCashVmProofText, extractFinalPushDataHex, parseCashVmProofScript } from "./cashVmProof.js";
import { eventHexToText, eventTextToHex, parseOpReturnEvent, replayDemoEvents, type DemoChainEvent, type DemoEventInput } from "./events.js";
import { createDemoOperatorP2shContract, deriveDemoP2shContract } from "./operatorContract.js";
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
export const demoUserPrivateKeyWif = "cMahea7zqjxrtgAbB7LSGbcQUr1uX1ojuat9jZodMN87K7XCyj5v";
export const demoUserAddress = "bchreg:qqr2l4rteh7j9mu54sfz4gglysfyfgm7esz8wrfywu";
const operatorContract = createDemoOperatorP2shContract(privateKey);
export const demoCashVmRedeemScript = operatorContract.redeemScript;
export const demoCashVmScriptPubKey = operatorContract.scriptPubKey;
export const demoCashVmAddress = operatorContract.address;

interface BlockTx {
  readonly txid: string;
  readonly vin: readonly {
    readonly coinbase?: string;
    readonly scriptSig?: {
      readonly hex: string;
    };
    readonly txid?: string;
    readonly vout?: number;
  }[];
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
  readonly redeemScript?: string;
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
  readonly pools: readonly DemoAmmPoolUtxo[];
  readonly proofPack: DemoAmmProofPackReceipt;
  readonly replay: ReturnType<typeof replayDemoEvents>;
  readonly tokenProofs: readonly DemoTokenProof[];
  readonly transitionAudits: readonly DemoAmmTransitionAuditProof[];
  readonly trades: readonly DemoAmmTradeProof[];
  readonly vmProofs: readonly DemoCashVmProof[];
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

export interface DemoAmmTradeProof {
  readonly category: string;
  readonly height: number;
  readonly inputAmount: string;
  readonly outputAmount: string;
  readonly side: "BCH_TO_TOKEN" | "TOKEN_TO_BCH";
  readonly txid: string;
}

export interface DemoAmmTransitionAuditProof extends DemoAmmTransitionAudit {
  readonly height: number;
}

export interface DemoCashVmProof {
  readonly contractScriptPubKey: string;
  readonly contractTxid: string;
  readonly height: number;
  readonly redeemScript: string;
  readonly spendTxid: string;
}

export interface DemoAmmProofPackRun {
  readonly bchToTokenTxid: string;
  readonly completedHeight: number;
  readonly createdPool: boolean;
  readonly poolTxid: string;
  readonly proofPack: DemoAmmProofPackReceipt;
  readonly startedHeight: number;
  readonly tokenGenesisTxid?: string;
  readonly tokenToBchTxid: string;
  readonly transitionAudits: readonly DemoAmmTransitionAuditProof[];
}

const config = loadConfig();
const rpc = new BchnRpcClient(config);

const satsToBch = (sats: bigint): string => {
  const whole = sats / 100_000_000n;
  const fraction = (sats % 100_000_000n).toString().padStart(8, "0");
  return `${whole}.${fraction}`;
};

const bchToSats = (value: number): bigint => BigInt(Math.round(value * 100_000_000));
const dustLimitSats = 546n;

const selectSpendableUtxo = (
  utxos: readonly SpendableUtxo[],
  minimumSats: bigint
): SpendableUtxo | undefined => utxos.find((utxo) => utxo.amountSats >= minimumSats);

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

const findDemoTokenUtxos = async (address: string): Promise<readonly SpendableUtxo[]> => {
  const blockCount = await rpc.call<number>("getblockcount");
  const utxos: SpendableUtxo[] = [];

  for (let height = 1; height <= blockCount; height += 1) {
    const block = await getBlockByHeight(height);
    for (const tx of block.tx) {
      for (const output of tx.vout) {
        if (output.tokenData === undefined || !output.scriptPubKey.addresses?.includes(address)) continue;
        const txout = await rpc.call<TxOutInfo | null>("gettxout", [tx.txid, output.n, true]);
        if (txout === null || txout.tokenData === undefined) continue;
        utxos.push({
          amountSats: bchToSats(txout.value),
          scriptPubKey: txout.scriptPubKey.hex,
          tokenData: txout.tokenData,
          txid: tx.txid,
          vout: output.n
        });
      }
    }
  }

  return utxos.sort((left, right) => {
    const leftAmount = BigInt(left.tokenData?.amount ?? "0");
    const rightAmount = BigInt(right.tokenData?.amount ?? "0");
    return leftAmount < rightAmount ? 1 : -1;
  });
};

export const scanDemoAmmPools = async (): Promise<readonly DemoAmmPoolUtxo[]> => {
  const blockCount = await rpc.call<number>("getblockcount");
  const pools: DemoAmmPoolUtxo[] = [];

  for (let height = 1; height <= blockCount; height += 1) {
    const block = await getBlockByHeight(height);
    for (const tx of block.tx) {
      const markerCategory = tx.vout
        .map((output) => parseDemoAmmPoolMarkerScript(output.scriptPubKey.hex))
        .find((category) => category !== undefined);
      if (markerCategory === undefined) continue;

      for (const output of tx.vout) {
        if (output.tokenData === undefined || output.scriptPubKey.hex !== demoCashVmScriptPubKey) continue;
        try {
          requireDemoAmmPoolTokenData(output.tokenData, markerCategory);
        } catch {
          continue;
        }
        const txout = await rpc.call<TxOutInfo | null>("gettxout", [tx.txid, output.n, true]);
        const pool = {
          active: txout !== null,
          height,
          tokenData: output.tokenData,
          txid: tx.txid,
          valueSats: bchToSats(output.value).toString(),
          vout: output.n
        };
        pools.push(pool);
      }
    }
  }

  return pools;
};

export const scanDemoAmmTrades = async (): Promise<readonly DemoAmmTradeProof[]> => {
  const blockCount = await rpc.call<number>("getblockcount");
  const trades: DemoAmmTradeProof[] = [];

  for (let height = 1; height <= blockCount; height += 1) {
    const block = await getBlockByHeight(height);
    for (const tx of block.tx) {
      for (const output of tx.vout) {
        const marker = parseDemoAmmTradeMarkerScript(output.scriptPubKey.hex);
        if (marker === undefined) continue;
        trades.push({
          category: marker.category,
          height,
          inputAmount: marker.inputAmount.toString(),
          outputAmount: marker.outputAmount.toString(),
          side: marker.side,
          txid: tx.txid
        });
      }
    }
  }

  return trades;
};

export const scanDemoAmmTransitionAudits = async (): Promise<readonly DemoAmmTransitionAuditProof[]> => {
  const [pools, trades] = await Promise.all([scanDemoAmmPools(), scanDemoAmmTrades()]);
  const blockCount = await rpc.call<number>("getblockcount");
  const transactionInputs = new Map<string, Set<string>>();

  for (let height = 1; height <= blockCount; height += 1) {
    const block = await getBlockByHeight(height);
    for (const tx of block.tx) {
      transactionInputs.set(
        tx.txid,
        new Set(
          tx.vin.flatMap((input) =>
            input.txid === undefined || input.vout === undefined ? [] : [`${input.txid}:${input.vout}`]
          )
        )
      );
    }
  }

  const sortedPools = [...pools].sort((left, right) => left.height - right.height || left.txid.localeCompare(right.txid));
  const sortedTrades = [...trades].sort((left, right) => left.height - right.height || left.txid.localeCompare(right.txid));
  const audits: DemoAmmTransitionAuditProof[] = [];

  for (const trade of sortedTrades) {
    const nextPool = sortedPools.find(
      (pool) => pool.txid === trade.txid && pool.tokenData.category.toLowerCase() === trade.category
    );
    if (nextPool === undefined) continue;

    const previousPool = sortedPools
      .filter(
        (pool) =>
          pool.tokenData.category.toLowerCase() === trade.category &&
          (pool.height < trade.height || (pool.height === trade.height && pool.txid.localeCompare(trade.txid) < 0))
      )
      .at(-1);
    if (previousPool === undefined) continue;

    const poolSpendConfirmed = transactionInputs.get(trade.txid)?.has(`${previousPool.txid}:${previousPool.vout}`) ?? false;
    audits.push({
      ...auditDemoAmmTradeTransition({
        nextPool,
        poolSpendConfirmed,
        previousPool,
        trade
      }),
      height: trade.height
    });
  }

  return audits;
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

export const scanDemoCashVmProofs = async (): Promise<readonly DemoCashVmProof[]> => {
  const blockCount = await rpc.call<number>("getblockcount");
  const proofs: DemoCashVmProof[] = [];

  for (let height = 1; height <= blockCount; height += 1) {
    const block = await getBlockByHeight(height);
    for (const tx of block.tx) {
      for (const output of tx.vout) {
        const proof = parseCashVmProofScript(output.scriptPubKey.hex);
        if (proof !== undefined) {
          const spendInput = tx.vin.find((input) => input.txid === proof.contractTxid);
          const redeemScript = extractFinalPushDataHex(spendInput?.scriptSig?.hex ?? "") ?? demoCashVmRedeemScript;
          proofs.push({
            contractScriptPubKey: deriveDemoP2shContract(redeemScript).scriptPubKey,
            contractTxid: proof.contractTxid,
            height,
            redeemScript,
            spendTxid: tx.txid
          });
        }
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
  const [blockCount, events, pools, tokenProofs, trades, transitionAudits, vmProofs, utxos] = await Promise.all([
    rpc.call<number>("getblockcount"),
    scanDemoEvents(),
    scanDemoAmmPools(),
    scanDemoTokenProofs(),
    scanDemoAmmTrades(),
    scanDemoAmmTransitionAudits(),
    scanDemoCashVmProofs(),
    findSpendableUtxos()
  ]);

  return {
    blockCount,
    events,
    pools,
    proofPack: buildDemoAmmProofPackReceipt(transitionAudits),
    replay: replayDemoEvents(events),
    tokenProofs,
    transitionAudits,
    trades,
    vmProofs,
    wallet: {
      address: demoAddress,
      balanceSats: utxos.reduce((sum, utxo) => sum + utxo.amountSats, 0n).toString(),
      spendableUtxos: utxos.length
    }
  };
};

const signAndSubmit = async (raw: string, utxo: SpendableUtxo): Promise<string> => {
  return signAndSubmitMany(raw, [utxo]);
};

const signAndSubmitMany = async (raw: string, utxos: readonly SpendableUtxo[]): Promise<string> => {
  const signed = await rpc.call<SignedRawTransaction>("signrawtransactionwithkey", [
    raw,
    [demoPrivateKeyWif, demoUserPrivateKeyWif],
    utxos.map((utxo) => ({
      amount: satsToBch(utxo.amountSats),
      ...(utxo.redeemScript === undefined ? {} : { redeemScript: utxo.redeemScript }),
      scriptPubKey: utxo.scriptPubKey,
      ...(utxo.tokenData === undefined ? {} : { tokenData: utxo.tokenData }),
      txid: utxo.txid,
      vout: utxo.vout
    })),
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

const activeAmmPool = async (): Promise<DemoAmmPoolUtxo | undefined> =>
  (await scanDemoAmmPools()).filter((pool) => pool.active).at(-1);

export const createDemoAmmPool = async (): Promise<DemoAmmPoolUtxo> => {
  const existingPool = await activeAmmPool();
  if (existingPool !== undefined) {
    return existingPool;
  }

  const [tokenUtxo] = await findDemoTokenUtxos(demoAddress);
  if (tokenUtxo === undefined || tokenUtxo.tokenData === undefined) {
    throw new Error("Mint a real CashToken before creating the AMM pool.");
  }
  requireDemoAmmPoolTokenData(tokenUtxo.tokenData);

  const feeSats = 1_000n;
  const poolValueSats = tokenUtxo.amountSats - feeSats;
  if (poolValueSats <= dustLimitSats) {
    throw new Error("Token UTXO BCH value is too small to seed an AMM pool.");
  }

  const raw = await rpc.call<string>("createrawtransaction", [
    [{ txid: tokenUtxo.txid, vout: tokenUtxo.vout }],
    [
      {
        [demoCashVmAddress]: {
          amount: satsToBch(poolValueSats),
          tokenData: tokenUtxo.tokenData
        }
      },
      {
        data: eventTextToHex(encodeDemoAmmPoolMarkerText(tokenUtxo.tokenData.category))
      }
    ]
  ]);
  const txid = await signAndSubmit(raw, tokenUtxo);
  await mineDemoBlock();

  const [pool] = (await scanDemoAmmPools()).filter((entry) => entry.txid === txid);
  if (pool === undefined) {
    throw new Error("Created AMM pool was not found after mining.");
  }
  summarizeDemoAmmPool(pool);
  return pool;
};

export const swapDemoAmmPool = async (
  bchAmountInSats = 1_000_000n,
  feeBps = 30
): Promise<{
  readonly nextPool: DemoAmmPoolUtxo;
  readonly tokenAmountOut: string;
  readonly txid: string;
}> => {
  const pool = await activeAmmPool();
  if (pool === undefined || pool.tokenData.amount === undefined) {
    throw new Error("Create an AMM pool before swapping.");
  }
  const quote = quoteDemoAmmBuy(pool, bchAmountInSats, feeBps);
  const walletUtxo = selectDemoAmmSwapFundingUtxo(await findSpendableUtxos(), bchAmountInSats);
  if (walletUtxo === undefined) {
    throw new Error("No sufficiently large spendable BCH UTXO is available for AMM swap.");
  }

  const walletChangeSats =
    walletUtxo.amountSats - bchAmountInSats - demoAmmTokenOutputDustSats - demoAmmSwapFeeSats;
  if (walletChangeSats <= demoAmmWalletChangeDustSats) {
    throw new Error("Wallet BCH UTXO is too small for AMM swap.");
  }

  const poolTokenReserve = BigInt(pool.tokenData.amount);
  const nextPoolTokenReserve = poolTokenReserve - quote.outputAmount;
  if (nextPoolTokenReserve <= 0n) {
    throw new Error("AMM swap would drain the pool token reserve.");
  }

  const nextPoolValueSats = BigInt(pool.valueSats) + bchAmountInSats;
  const raw = await rpc.call<string>("createrawtransaction", [
    [
      { txid: pool.txid, vout: pool.vout },
      { txid: walletUtxo.txid, vout: walletUtxo.vout }
    ],
    [
      {
        [demoCashVmAddress]: {
          amount: satsToBch(nextPoolValueSats),
          tokenData: {
            ...pool.tokenData,
            amount: nextPoolTokenReserve.toString()
          }
        }
      },
      {
        [demoUserAddress]: {
          amount: satsToBch(demoAmmTokenOutputDustSats),
          tokenData: {
            amount: quote.outputAmount.toString(),
            category: pool.tokenData.category
          }
        }
      },
      { [demoAddress]: satsToBch(walletChangeSats) },
      {
        data: eventTextToHex(
          encodeDemoAmmTradeMarkerText(
            "BCH_TO_TOKEN",
            pool.tokenData.category,
            bchAmountInSats,
            quote.outputAmount
          )
        )
      }
    ]
  ]);
  const txid = await signAndSubmitMany(raw, [
    {
      amountSats: BigInt(pool.valueSats),
      redeemScript: demoCashVmRedeemScript,
      scriptPubKey: demoCashVmScriptPubKey,
      tokenData: pool.tokenData,
      txid: pool.txid,
      vout: pool.vout
    },
    walletUtxo
  ]);
  await mineDemoBlock();

  const [nextPool] = (await scanDemoAmmPools()).filter((entry) => entry.txid === txid);
  if (nextPool === undefined) {
    throw new Error("AMM swap pool output was not found after mining.");
  }
  summarizeDemoAmmPool(nextPool);

  return {
    nextPool,
    tokenAmountOut: quote.outputAmount.toString(),
    txid
  };
};

export const runDemoAmmProofPack = async (): Promise<DemoAmmProofPackRun> => {
  await ensureDemoFunding();
  const startedHeight = await rpc.call<number>("getblockcount");
  let pool = await activeAmmPool();
  let tokenGenesisTxid: string | undefined;

  if (pool === undefined) {
    const token = await createDemoCashToken();
    tokenGenesisTxid = token.tokenGenesisTxid;
    pool = await createDemoAmmPool();
  }

  const bchToToken = await swapDemoAmmPool(1_000_000n);
  const tokenToBch = await sellDemoAmmTokens(50n);
  const snapshot = await getDemoSnapshot();
  const transitionAudits = snapshot.transitionAudits.filter(
    (audit) => audit.txid === bchToToken.txid || audit.txid === tokenToBch.txid
  );

  if (
    snapshot.proofPack.status !== "verified" ||
    snapshot.proofPack.bchToTokenTxid !== bchToToken.txid ||
    snapshot.proofPack.tokenToBchTxid !== tokenToBch.txid
  ) {
    throw new Error("Fresh AMM proof pack did not verify after mining.");
  }

  return {
    bchToTokenTxid: bchToToken.txid,
    completedHeight: snapshot.blockCount,
    createdPool: tokenGenesisTxid !== undefined,
    poolTxid: pool.txid,
    proofPack: snapshot.proofPack,
    startedHeight,
    ...(tokenGenesisTxid === undefined ? {} : { tokenGenesisTxid }),
    tokenToBchTxid: tokenToBch.txid,
    transitionAudits
  };
};

export const sellDemoAmmTokens = async (
  tokenAmountIn = 50n,
  feeBps = 30
): Promise<{
  readonly bchAmountOutSats: string;
  readonly nextPool: DemoAmmPoolUtxo;
  readonly tokenAmountIn: string;
  readonly txid: string;
}> => {
  const pool = await activeAmmPool();
  if (pool === undefined || pool.tokenData.amount === undefined) {
    throw new Error("Create an AMM pool before selling tokens.");
  }
  if (tokenAmountIn <= 0n) {
    throw new Error("tokenAmountIn must be positive.");
  }

  const tokenUtxo = selectDemoAmmSellTokenUtxo(
    await findDemoTokenUtxos(demoUserAddress),
    pool.tokenData.category,
    tokenAmountIn
  );
  if (tokenUtxo === undefined || tokenUtxo.tokenData?.amount === undefined) {
    throw new Error("No sufficiently large predefined user token UTXO is available for AMM sell.");
  }

  const quote = quoteDemoAmmSell(pool, tokenAmountIn, feeBps);
  const userBchOutSats = quote.outputAmount - demoAmmSwapFeeSats;
  if (userBchOutSats <= dustLimitSats) {
    throw new Error("AMM token sell output is too small after fees.");
  }

  const nextPoolValueSats = BigInt(pool.valueSats) - quote.outputAmount;
  if (nextPoolValueSats <= dustLimitSats) {
    throw new Error("AMM token sell would drain the pool BCH reserve.");
  }

  const userTokenAmount = BigInt(tokenUtxo.tokenData.amount);
  const userTokenChange = userTokenAmount - tokenAmountIn;
  const nextPoolTokenReserve = BigInt(pool.tokenData.amount) + tokenAmountIn;
  const outputs: unknown[] = [
    {
      [demoCashVmAddress]: {
        amount: satsToBch(nextPoolValueSats),
        tokenData: {
          ...pool.tokenData,
          amount: nextPoolTokenReserve.toString()
        }
      }
    }
  ];

  if (userTokenChange > 0n) {
    outputs.push({
      [demoUserAddress]: {
        amount: satsToBch(userBchOutSats),
        tokenData: {
          amount: userTokenChange.toString(),
          category: pool.tokenData.category
        }
      }
    });
  } else {
    outputs.push({ [demoUserAddress]: satsToBch(userBchOutSats) });
  }

  outputs.push({
    data: eventTextToHex(
      encodeDemoAmmTradeMarkerText("TOKEN_TO_BCH", pool.tokenData.category, tokenAmountIn, userBchOutSats)
    )
  });

  const raw = await rpc.call<string>("createrawtransaction", [
    [
      { txid: pool.txid, vout: pool.vout },
      { txid: tokenUtxo.txid, vout: tokenUtxo.vout }
    ],
    outputs
  ]);
  const txid = await signAndSubmitMany(raw, [
    {
      amountSats: BigInt(pool.valueSats),
      redeemScript: demoCashVmRedeemScript,
      scriptPubKey: demoCashVmScriptPubKey,
      tokenData: pool.tokenData,
      txid: pool.txid,
      vout: pool.vout
    },
    tokenUtxo
  ]);
  await mineDemoBlock();

  const [nextPool] = (await scanDemoAmmPools()).filter((entry) => entry.txid === txid);
  if (nextPool === undefined) {
    throw new Error("AMM sell pool output was not found after mining.");
  }
  summarizeDemoAmmPool(nextPool);

  return {
    bchAmountOutSats: userBchOutSats.toString(),
    nextPool,
    tokenAmountIn: tokenAmountIn.toString(),
    txid
  };
};

export const createDemoCashVmProof = async (): Promise<DemoCashVmProof> => {
  await ensureDemoFunding();
  const contractValueSats = 2_000n;
  const feeSats = 1_000n;
  const fundingUtxo = selectSpendableUtxo(await findSpendableUtxos(), contractValueSats + feeSats + dustLimitSats + 1n);
  if (fundingUtxo === undefined) {
    throw new Error("No sufficiently large spendable demo UTXO is available for CashVM proof.");
  }

  const changeSats = fundingUtxo.amountSats - contractValueSats - feeSats;
  if (changeSats <= dustLimitSats) {
    throw new Error("Demo UTXO is too small for CashVM proof funding.");
  }

  const fundingRaw = await rpc.call<string>("createrawtransaction", [
    [{ txid: fundingUtxo.txid, vout: fundingUtxo.vout }],
    [{ [demoCashVmAddress]: satsToBch(contractValueSats) }, { [demoAddress]: satsToBch(changeSats) }]
  ]);
  const contractTxid = await signAndSubmit(fundingRaw, fundingUtxo);
  await mineDemoBlock();

  const spendRaw = await rpc.call<string>("createrawtransaction", [
    [{ txid: contractTxid, vout: 0 }],
    [{ data: eventTextToHex(encodeCashVmProofText(contractTxid)) }, { [demoAddress]: satsToBch(1_000n) }]
  ]);
  const spendTxid = await signAndSubmit(spendRaw, {
    amountSats: contractValueSats,
    redeemScript: demoCashVmRedeemScript,
    scriptPubKey: demoCashVmScriptPubKey,
    txid: contractTxid,
    vout: 0
  });
  await mineDemoBlock();

  const blockCount = await rpc.call<number>("getblockcount");
  return {
    contractScriptPubKey: demoCashVmScriptPubKey,
    contractTxid,
    height: blockCount,
    redeemScript: demoCashVmRedeemScript,
    spendTxid
  };
};

export const submitDemoEvent = async (event: DemoEventInput): Promise<string> => {
  await ensureDemoFunding();
  const feeSats = 1_000n;
  const utxo = selectSpendableUtxo(await findSpendableUtxos(), feeSats + dustLimitSats + 1n);
  if (utxo === undefined) {
    throw new Error("No sufficiently large spendable demo UTXO is available after funding.");
  }

  const changeSats = utxo.amountSats - feeSats;
  if (changeSats <= dustLimitSats) {
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
  const fundingUtxo = [...(await findSpendableUtxos())]
    .sort((left, right) => (left.amountSats < right.amountSats ? 1 : -1))
    .find((utxo) => utxo.amountSats > 1_000_000n);
  if (fundingUtxo === undefined) {
    throw new Error("No sufficiently large spendable demo UTXO is available for token genesis.");
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
            category: preGenesisTxid
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
    readonly vout: readonly { readonly scriptPubKey: { readonly hex: string }; readonly tokenData?: TokenData; readonly value: number }[];
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

  const cashVmProof = tx.vout
    .map((output) => parseCashVmProofScript(output.scriptPubKey.hex))
    .find((entry) => entry !== undefined);

  const ammTrade = tx.vout
    .map((output) => parseDemoAmmTradeMarkerScript(output.scriptPubKey.hex))
    .find((entry) => entry !== undefined);

  const ammPoolCategory = tx.vout
    .map((output) => parseDemoAmmPoolMarkerScript(output.scriptPubKey.hex))
    .find((entry) => entry !== undefined);

  const ammTransitionAudit =
    ammTrade === undefined ? undefined : findDemoAmmTransitionAuditByTxid(await scanDemoAmmTransitionAudits(), txid);

  return { ammPoolCategory, ammTrade, ammTransitionAudit, cashVmProof, event, eventText: text, tx };
};
