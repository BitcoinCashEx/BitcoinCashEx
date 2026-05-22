import http from "node:http";
import {
  createDemoAmmPool,
  createDemoCashVmProof,
  createDemoCashToken,
  demoAddress,
  ensureDemoFunding,
  getDecodedTransaction,
  getDemoSnapshot,
  runDemoAmmProofPack,
  sellDemoAmmTokens,
  swapDemoAmmPool,
  submitDemoEvent
} from "./chain.js";
import { buyLaunchTokens, graduateTokenLaunch, sellLaunchTokens } from "../defi/launchpad.js";

const port = Number.parseInt(process.env.BCHEX_DEMO_PORT ?? "3000", 10);

const json = (response: http.ServerResponse, status: number, payload: unknown): void => {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8"
  });
  response.end(JSON.stringify(payload, (_, value: unknown) => (typeof value === "bigint" ? value.toString() : value), 2));
};

const parseBody = async (request: http.IncomingMessage): Promise<Record<string, unknown>> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>);
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", reject);
  });

const bigintBody = (body: Record<string, unknown>, key: string): bigint => {
  const value = body[key];
  if (typeof value !== "string" || !/^[0-9]+$/.test(value)) {
    throw new Error(`${key} must be an integer string.`);
  }
  return BigInt(value);
};

const renderPage = (): string => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>BitcoinCashEx Local Launchpad</title>
    <style>
      :root { color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      body { margin: 0; background: #f7f7f4; color: #1e2420; }
      header { padding: 24px clamp(16px, 4vw, 48px); background: #0f2f24; color: white; }
      main { padding: 24px clamp(16px, 4vw, 48px); display: grid; gap: 18px; }
      h1 { margin: 0 0 8px; font-size: clamp(26px, 4vw, 44px); letter-spacing: 0; }
      h2 { margin: 0 0 12px; font-size: 18px; letter-spacing: 0; }
      p { margin: 0; max-width: 920px; line-height: 1.5; }
      section { background: white; border: 1px solid #d8ddd5; border-radius: 8px; padding: 18px; }
      .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; }
      .metric { border: 1px solid #e0e4dc; border-radius: 6px; padding: 12px; background: #fbfcfa; min-height: 72px; }
      .label { display: block; color: #59655d; font-size: 12px; text-transform: uppercase; letter-spacing: .04em; }
      .value { display: block; margin-top: 6px; font-size: 18px; font-weight: 700; overflow-wrap: anywhere; }
      .controls { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
      button { appearance: none; border: 0; border-radius: 6px; background: #176f4d; color: white; padding: 10px 14px; font-weight: 700; cursor: pointer; min-height: 40px; }
      button.secondary { background: #31423a; }
      button:disabled { background: #a8b0aa; cursor: not-allowed; }
      input { border: 1px solid #cbd2ca; border-radius: 6px; padding: 10px; min-height: 20px; width: 150px; }
      table { width: 100%; border-collapse: collapse; }
      th, td { text-align: left; border-bottom: 1px solid #e3e6e1; padding: 10px 8px; vertical-align: top; }
      th { color: #59655d; font-size: 12px; text-transform: uppercase; letter-spacing: .04em; }
      code { background: #eef1eb; border-radius: 4px; padding: 2px 4px; }
      a { color: #0f6846; font-weight: 700; }
      .status { min-height: 22px; color: #31423a; }
      .error { color: #9f1d1d; }
      .ok { color: #176f4d; font-weight: 700; }
      .bad { color: #9f1d1d; font-weight: 700; }
    </style>
  </head>
  <body>
    <header>
      <h1>BitcoinCashEx Local Launchpad</h1>
      <p>Backend-owned regtest wallet. Button clicks submit and mine local BCHN transactions, then this page reconstructs launch state from on-chain event transactions.</p>
    </header>
    <main>
      <section>
        <h2>Actions</h2>
        <div class="controls">
          <button id="fund">Fund Wallet</button>
          <button id="token" class="secondary">Mint Real CashToken</button>
          <button id="cashvm" class="secondary">Run CashVM Proof</button>
          <button id="pool" class="secondary">Create AMM Pool</button>
          <button id="proofPack">Run Full AMM Proof</button>
          <input id="swapAmount" value="1000000" aria-label="Swap BCH amount sats" />
          <button id="swap" class="secondary">Swap BCH To Token</button>
          <input id="ammSellAmount" value="50" aria-label="AMM sell token amount" />
          <button id="ammSell" class="secondary">Swap Token To BCH</button>
          <button id="create">Create Token Launch</button>
          <input id="buyAmount" value="100000" aria-label="Buy amount sats" />
          <button id="buy">Buy</button>
          <input id="sellAmount" value="25000" aria-label="Sell amount tokens" />
          <button id="sell" class="secondary">Sell</button>
          <button id="graduate" class="secondary">Graduate</button>
        </div>
        <p class="status" id="status"></p>
      </section>
      <section>
        <h2>Chain State</h2>
        <div class="grid" id="metrics"></div>
      </section>
      <section>
        <h2>Latest Proof Pack</h2>
        <div id="proofPackView"></div>
      </section>
      <section>
        <h2>AMM Trades</h2>
        <div id="trades"></div>
      </section>
      <section>
        <h2>AMM Reserve Audit</h2>
        <div id="audits"></div>
      </section>
      <section>
        <h2>On-Chain Events</h2>
        <div id="events"></div>
      </section>
    </main>
    <script>
      const status = document.getElementById('status');
      const metrics = document.getElementById('metrics');
      const proofPackView = document.getElementById('proofPackView');
      const trades = document.getElementById('trades');
      const audits = document.getElementById('audits');
      const events = document.getElementById('events');
      const setStatus = (text, isError = false) => {
        status.textContent = text;
        status.className = isError ? 'status error' : 'status';
      };
      const post = async (path, body = {}) => {
        setStatus('Submitting...');
        const response = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Request failed');
        setStatus('Mined tx ' + (data.txid || 'ok'));
        await refresh();
      };
      const metric = (label, value) => '<div class="metric"><span class="label">' + label + '</span><span class="value">' + value + '</span></div>';
      const txLink = (txid) => '<a href="/tx/' + txid + '" target="_blank">' + txid.slice(0, 12) + '...</a>';
      const amount = (value) => {
        const text = String(value);
        return /^[0-9]+$/.test(text) ? text.replace(/\\B(?=(\\d{3})+(?!\\d))/g, ',') : text;
      };
      const sideName = (side) => {
        const value = String(side);
        const key = value.toLowerCase().replaceAll('_', '-');
        if (key === 'bch-to-token' || key === 'buy') return 'BCH to Token';
        if (key === 'token-to-bch' || key === 'sell') return 'Token to BCH';
        return value;
      };
      const refresh = async () => {
        const response = await fetch('/api/state');
        const data = await response.json();
        const launch = data.launch;
        const activePool = data.pools.filter((pool) => pool.active).at(-1);
        const auditFailures = data.transitionAudits.filter((audit) => audit.status !== 'verified').length;
        const pack = data.proofPack;
        metrics.innerHTML = [
          metric('Height', data.blockCount),
          metric('Wallet', '<code>' + data.wallet.address + '</code>'),
          metric('Wallet sats', data.wallet.balanceSats),
          metric('Status', launch ? launch.status : 'not created'),
          metric('Supply sold', launch ? launch.currentSupply : '0'),
          metric('Remaining tokens', launch ? launch.remainingTokenSupply : '0'),
          metric('Escrow sats', launch ? launch.bchEscrowSats : '0'),
          metric('Fees sats', launch ? launch.feesCollectedBchSats : '0'),
          metric('Pool BCH sats', activePool ? activePool.valueSats : 'not created'),
          metric('Pool tokens', activePool ? activePool.tokenData.amount : 'not created'),
          metric('AMM audit', data.transitionAudits.length === 0 ? 'no swaps' : auditFailures === 0 ? 'verified' : auditFailures + ' failed')
        ].join('');
        proofPackView.innerHTML = pack.status === 'missing'
          ? '<p>No complete proof pack found yet.</p>'
          : '<table><thead><tr><th>Status</th><th>Heights</th><th>BCH To Token</th><th>Token To BCH</th><th>Audits</th></tr></thead><tbody><tr><td><span class="' + (pack.status === 'verified' ? 'ok' : 'bad') + '">' + pack.status + '</span></td><td>' + pack.startHeight + '-' + pack.endHeight + '</td><td>' + txLink(pack.bchToTokenTxid) + '</td><td>' + txLink(pack.tokenToBchTxid) + '</td><td>' + pack.auditTxids.map(txLink).join(' ') + '</td></tr></tbody></table>' +
            (pack.problems.length === 0 ? '' : '<p class="error">' + pack.problems.join(' ') + '</p>');
        trades.innerHTML = data.trades.length === 0
          ? '<p>No decoded AMM trades found yet.</p>'
          : '<table><thead><tr><th>Height</th><th>Side</th><th>Category</th><th>Input Amount</th><th>Output Amount</th><th>Tx</th></tr></thead><tbody>' +
            data.trades.map((trade) => '<tr><td>' + trade.height + '</td><td>' + sideName(trade.side) + '</td><td><code>' + trade.category + '</code></td><td>' + amount(trade.inputAmount) + '</td><td>' + amount(trade.outputAmount) + '</td><td>' + txLink(trade.txid) + '</td></tr>').join('') +
            '</tbody></table>';
        audits.innerHTML = data.transitionAudits.length === 0
          ? '<p>No AMM reserve audits found yet.</p>'
          : '<table><thead><tr><th>Height</th><th>Status</th><th>Side</th><th>Expected BCH</th><th>Actual BCH</th><th>Expected Tokens</th><th>Actual Tokens</th><th>Spent Pool</th><th>Tx</th></tr></thead><tbody>' +
            data.transitionAudits.map((audit) => '<tr><td>' + audit.height + '</td><td><span class="' + (audit.status === 'verified' ? 'ok' : 'bad') + '">' + audit.status + '</span></td><td>' + sideName(audit.side) + '</td><td>' + amount(audit.expectedBchReserveSats) + '</td><td>' + amount(audit.actualBchReserveSats) + '</td><td>' + amount(audit.expectedTokenReserve) + '</td><td>' + amount(audit.actualTokenReserve) + '</td><td>' + audit.poolSpendConfirmed + '</td><td>' + txLink(audit.txid) + '</td></tr>').join('') +
            '</tbody></table>';
        const tokenProofs = data.tokenProofs.length === 0
          ? '<p>No real CashToken outputs found yet.</p>'
          : '<table><thead><tr><th>Height</th><th>Category</th><th>Amount</th><th>Tx</th></tr></thead><tbody>' +
            data.tokenProofs.map((proof) => '<tr><td>' + proof.height + '</td><td><code>' + proof.tokenData.category + '</code></td><td>' + (proof.tokenData.amount || 'NFT') + '</td><td>' + txLink(proof.txid) + '</td></tr>').join('') +
            '</tbody></table>';
        const vmProofs = data.vmProofs.length === 0
          ? '<p>No CashVM contract spends found yet.</p>'
          : '<table><thead><tr><th>Height</th><th>Redeem Script</th><th>Contract Tx</th><th>Spend Tx</th></tr></thead><tbody>' +
            data.vmProofs.map((proof) => '<tr><td>' + proof.height + '</td><td><code>' + proof.redeemScript + '</code></td><td>' + txLink(proof.contractTxid) + '</td><td>' + txLink(proof.spendTxid) + '</td></tr>').join('') +
            '</tbody></table>';
        const pools = data.pools.length === 0
          ? '<p>No AMM pool UTXOs found yet.</p>'
          : '<table><thead><tr><th>Height</th><th>Active</th><th>BCH Sats</th><th>Tokens</th><th>Tx</th></tr></thead><tbody>' +
            data.pools.map((pool) => '<tr><td>' + pool.height + '</td><td>' + pool.active + '</td><td>' + pool.valueSats + '</td><td>' + (pool.tokenData.amount || '0') + '</td><td>' + txLink(pool.txid) + '</td></tr>').join('') +
            '</tbody></table>';
        const launchEvents = data.history.length === 0
          ? '<p>No launch events mined yet.</p>'
          : '<table><thead><tr><th>Height</th><th>Action</th><th>Tx</th><th>Status After</th></tr></thead><tbody>' +
            data.history.map((entry) => '<tr><td>' + entry.height + '</td><td>' + entry.kind + '</td><td>' + txLink(entry.txid) + '</td><td>' + (entry.statusAfter || '') + '</td></tr>').join('') +
            '</tbody></table>';
        events.innerHTML = '<h3>Real CashToken Outputs</h3>' + tokenProofs + '<h3>CashVM AMM Pool UTXOs</h3>' + pools + '<h3>CashVM Contract Spends</h3>' + vmProofs + '<h3>Launch Events</h3>' + launchEvents;
      };
      document.getElementById('fund').onclick = () => post('/api/fund').catch((error) => setStatus(error.message, true));
      document.getElementById('token').onclick = () => post('/api/token').catch((error) => setStatus(error.message, true));
      document.getElementById('cashvm').onclick = () => post('/api/cashvm').catch((error) => setStatus(error.message, true));
      document.getElementById('pool').onclick = () => post('/api/pool').catch((error) => setStatus(error.message, true));
      document.getElementById('proofPack').onclick = () => post('/api/proof-pack').catch((error) => setStatus(error.message, true));
      document.getElementById('swap').onclick = () => post('/api/swap', { bchAmountInSats: document.getElementById('swapAmount').value }).catch((error) => setStatus(error.message, true));
      document.getElementById('ammSell').onclick = () => post('/api/swap-token-to-bch', { tokenAmountIn: document.getElementById('ammSellAmount').value }).catch((error) => setStatus(error.message, true));
      document.getElementById('create').onclick = () => post('/api/create').catch((error) => setStatus(error.message, true));
      document.getElementById('buy').onclick = () => post('/api/buy', { bchAmountInSats: document.getElementById('buyAmount').value }).catch((error) => setStatus(error.message, true));
      document.getElementById('sell').onclick = () => post('/api/sell', { tokenAmountIn: document.getElementById('sellAmount').value }).catch((error) => setStatus(error.message, true));
      document.getElementById('graduate').onclick = () => post('/api/graduate').catch((error) => setStatus(error.message, true));
      refresh().catch((error) => setStatus(error.message, true));
      setInterval(() => refresh().catch(() => {}), 5000);
    </script>
  </body>
</html>`;

const serializeSnapshot = async () => {
  const snapshot = await getDemoSnapshot();
  return {
    blockCount: snapshot.blockCount,
    graduation: snapshot.replay.graduation,
    history: snapshot.replay.history.map((entry) => ({
      height: entry.event.height,
      kind: entry.event.input.kind,
      quote: entry.quote,
      statusAfter: entry.statusAfter,
      txid: entry.event.txid
    })),
    launch: snapshot.replay.launch === undefined
      ? undefined
      : {
          asset: snapshot.replay.launch.asset,
          bchEscrowSats: snapshot.replay.launch.bchEscrowSats,
          currentSupply: snapshot.replay.launch.curve.currentSupply,
          feesCollectedBchSats: snapshot.replay.launch.feesCollectedBchSats,
          graduationThresholdBchSats: snapshot.replay.launch.graduationThresholdBchSats,
          remainingTokenSupply: snapshot.replay.launch.curve.maxSupply - snapshot.replay.launch.curve.currentSupply,
          status: snapshot.replay.launch.status
        },
    pools: snapshot.pools,
    proofPack: snapshot.proofPack,
    tokenProofs: snapshot.tokenProofs,
    transitionAudits: snapshot.transitionAudits.map((audit) => ({
      actualBchReserveSats: audit.actualBchReserveSats,
      actualTokenReserve: audit.actualTokenReserve,
      category: audit.category,
      constantProductAfter: audit.constantProductAfter,
      constantProductBefore: audit.constantProductBefore,
      expectedBchReserveSats: audit.expectedBchReserveSats,
      expectedTokenReserve: audit.expectedTokenReserve,
      height: audit.height,
      inputAmount: audit.inputAmount,
      nextPoolTxid: audit.nextPoolTxid,
      outputAmount: audit.outputAmount,
      poolSpendConfirmed: audit.poolSpendConfirmed,
      previousPoolTxid: audit.previousPoolTxid,
      problems: audit.problems,
      side: audit.side,
      status: audit.status,
      txid: audit.txid
    })),
    trades: snapshot.trades.map((trade) => ({
      category: trade.category,
      height: trade.height,
      inputAmount: trade.inputAmount,
      outputAmount: trade.outputAmount,
      side: trade.side,
      txid: trade.txid
    })),
    vmProofs: snapshot.vmProofs,
    wallet: snapshot.wallet
  };
};

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

    if (request.method === "GET" && url.pathname === "/") {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(renderPage());
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/state") {
      json(response, 200, await serializeSnapshot());
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/fund") {
      await ensureDemoFunding();
      json(response, 200, { ok: true });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/token") {
      const result = await createDemoCashToken();
      json(response, 200, { txid: result.tokenGenesisTxid, ...result });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/cashvm") {
      const result = await createDemoCashVmProof();
      json(response, 200, { txid: result.spendTxid, ...result });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/pool") {
      const result = await createDemoAmmPool();
      json(response, 200, { txid: result.txid, pool: result });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/proof-pack") {
      const result = await runDemoAmmProofPack();
      json(response, 200, { txid: result.tokenToBchTxid, ...result });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/swap") {
      const body = await parseBody(request);
      const result = await swapDemoAmmPool(bigintBody(body, "bchAmountInSats"));
      json(response, 200, result);
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/swap-token-to-bch") {
      const body = await parseBody(request);
      const result = await sellDemoAmmTokens(bigintBody(body, "tokenAmountIn"));
      json(response, 200, result);
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/create") {
      const snapshot = await getDemoSnapshot();
      if (snapshot.replay.launch !== undefined) throw new Error("Launch already exists on this local chain.");
      const txid = await submitDemoEvent({
        decimals: 0,
        feeBps: 100,
        graduationThresholdBchSats: 300_000n,
        kind: "CREATE",
        maxSupply: 900_000n,
        symbol: "PUMP",
        virtualBchReserveSats: 100_000n,
        virtualTokenReserve: 1_000_000n
      });
      json(response, 200, { txid });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/buy") {
      const body = await parseBody(request);
      const snapshot = await getDemoSnapshot();
      if (snapshot.replay.launch === undefined) throw new Error("Create a launch first.");
      buyLaunchTokens(snapshot.replay.launch, bigintBody(body, "bchAmountInSats"));
      const txid = await submitDemoEvent({ bchAmountInSats: bigintBody(body, "bchAmountInSats"), kind: "BUY" });
      json(response, 200, { txid });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/sell") {
      const body = await parseBody(request);
      const snapshot = await getDemoSnapshot();
      if (snapshot.replay.launch === undefined) throw new Error("Create a launch first.");
      sellLaunchTokens(snapshot.replay.launch, bigintBody(body, "tokenAmountIn"));
      const txid = await submitDemoEvent({ kind: "SELL", tokenAmountIn: bigintBody(body, "tokenAmountIn") });
      json(response, 200, { txid });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/graduate") {
      const snapshot = await getDemoSnapshot();
      if (snapshot.replay.launch === undefined) throw new Error("Create a launch first.");
      graduateTokenLaunch(snapshot.replay.launch);
      const txid = await submitDemoEvent({ kind: "GRADUATE" });
      json(response, 200, { txid });
      return;
    }

    const txMatch = /^\/tx\/([0-9a-f]{64})$/i.exec(url.pathname);
    if (request.method === "GET" && txMatch?.[1] !== undefined) {
      const decoded = await getDecodedTransaction(txMatch[1]);
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(`<!doctype html><title>Tx ${txMatch[1]}</title><body style="font-family: ui-monospace, monospace; padding: 24px;"><p><a href="/">Back</a></p><h1>Local Tx ${txMatch[1]}</h1><pre>${JSON.stringify(decoded, null, 2)}</pre></body>`);
      return;
    }

    json(response, 404, { error: "Not found" });
  } catch (error) {
    json(response, 500, { error: error instanceof Error ? error.message : String(error) });
  }
});

server.listen(port, () => {
  console.log(`BitcoinCashEx local launchpad: http://127.0.0.1:${port}`);
  console.log(`Backend demo wallet: ${demoAddress}`);
});
