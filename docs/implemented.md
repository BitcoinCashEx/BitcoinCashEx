# Implemented State

## Node

- BCHN `29.0.0` is pinned in Docker Compose.
- Regtest starts with `-upgrade12activationtime=0`, so the May 2026 CashVM rules
  are active locally.
- BCHN wallet RPCs are disabled.
- Host RPC and ZMQ ports are bound to `127.0.0.1`.
- `npm run node:health` verifies:
  - BCHN version is at least `29.0.0`.
  - The node chain matches `BCH_NETWORK`.
  - `txindex` is synced.
  - May 2026 CashVM rules are active.

## DeFi Core

- BCH and CashToken asset metadata types.
- CashToken category, decimal, and symbol validation.
- Constant-product AMM quote and reserve transition math.
- BCHN regtest AMM pool proof that stores real CashTokens and BCH in a CashVM
  P2SH UTXO, then spends and recreates that pool after backend-submitted swaps
  in both BCH-to-token and token-to-BCH directions.
- BCHN regtest launch-to-AMM proof that binds a pump-style launch to a real
  CashToken category with an on-chain TOKEN event, migrates the launch
  graduation BCH/token amounts into a CashVM AMM pool, then proves AMM swaps for
  that category.
- Virtual-reserve bonding curve buy/sell quote math.
- Liquidity initialization with locked minimum liquidity.
- Proportional add-liquidity quote with excess-side refunds.
- Proportional remove-liquidity quote.
- Slippage minimum-output calculations.
- Bonding-curve remaining-supply and slippage calculations.
- Deterministic CashToken launch lifecycle modeling for create, buy, sell,
  graduation eligibility, and graduation migration amounts.

## What The Launchpad Regression Proves

[tests/launchpad.test.ts](../tests/launchpad.test.ts) proves the current
pump.fun-style flow at the deterministic state-machine level:

- A CashToken launch can be created from validated token metadata.
- Multiple buys execute against the virtual-reserve bonding curve.
- A sell can move tokens back into the curve and BCH out of escrow.
- The launch reaches a graduation threshold.
- Graduation produces the BCH amount and remaining token amount to migrate into
  an AMM.
- Token supply and BCH escrow accounting remain consistent across the lifecycle.
- Invalid transitions are rejected.

This is not yet a live on-chain CashVM covenant test. The local demo now mines
a launch-to-token binding and AMM migration proof, but the launch curve itself
is still replayed from OP_RETURN events rather than enforced by a production
CashVM covenant.

## What The Regtest AMM Proof Proves

The local demo now proves the first on-chain AMM path on BCHN regtest:

- A real CashToken genesis transaction creates the launch asset.
- A `BCHEX1|TOKEN|<category>|<tokenGenesisTxid>` event can bind the pump-style
  launch replay to the real CashToken category used by the AMM proof.
- The backend moves that token output into the CashVM P2SH address as the AMM
  pool UTXO.
- The pool transaction includes a same-transaction `BCHEXAMM1|<category>`
  OP_RETURN marker, and scanner logic ignores token UTXOs without that marker.
- AMM pool reserves are rejected if they carry an NFT authority; the current
  pool uses fungible-only CashTokens.
- New CashVM pool and proof spends use a P2SH-wrapped P2PKH redeem script tied
  to the backend operator key, so they require the backend signature instead of
  being anyone-can-spend.
- A BCH-to-token swap transaction spends the active pool UTXO plus a backend
  BCH UTXO, then recreates the pool with increased BCH reserves and reduced
  token reserves.
- A token-to-BCH swap transaction spends the active pool UTXO plus the
  predefined user's CashToken UTXO, then recreates the pool with increased
  token reserves and reduced BCH reserves.
- The swap transactions pay CashTokens or BCH back to the predefined
  backend-controlled user address.
- `/api/state` distinguishes inactive spent pool UTXOs from the current active
  pool UTXO by using BCHN `gettxout`.
- `/api/state` exposes decoded AMM trade history as `trades`, with `height`,
  `txid`, `side`, `category`, `inputAmount`, and `outputAmount` for each swap.
- AMM swap transactions now emit `BCHEXAMM1|TRADE|...` OP_RETURN markers, and
  pool discovery treats those markers as the token category binding for the
  recreated pool UTXO.
- `/api/state.transitionAudits` pairs each decoded trade with the previous and
  next CashVM pool UTXO, confirms the swap spends the previous pool outpoint,
  verifies BCH/token reserve deltas, and checks that the constant-product
  invariant does not decrease.
- Each AMM transition audit also extracts the final redeem-script push from the
  pool input script, hashes it as P2SH, and verifies it matches the previous
  CashVM pool locking script. The mined transaction proves BCHN accepted that
  CashVM spend.
- `/api/proof-pack` runs a full backend-owned AMM proof: it ensures a CashVM
  pool exists, mines a BCH-to-token swap, mines a token-to-BCH swap, then
  returns only after `/api/state.proofPack` verifies the latest swap pair from
  chain-derived audit rows.
- `/api/launch-proof-pack` runs the composed launch path: it ensures the launch
  is graduated, mines a TOKEN binding event for a real CashToken, creates the
  category-specific CashVM AMM pool with the exact launch graduation BCH/token
  amounts, mines both AMM swap directions, and returns only after
  `/api/state.launchAmmProofPack` verifies the launch, token, migration pool,
  AMM audit, and CashVM spend linkage.
- `/tx/<swap-txid>` includes `ammTrade` and `ammTransitionAudit.cashVmSpend`,
  making each local explorer link a self-contained proof for that swap
  transaction.
- `/tx/<launch-event-txid>` includes a decoded launch-event summary, so TOKEN
  binding links show the real CashToken category and genesis transaction.

Current local proof values:

- Initial pool transaction:
  `6d21a365013c10636de2f32635ab4a087f4d0788e695b9768e1192bf750fcff8`.
- Latest launch TOKEN binding event:
  `7c29863147b38d007090ee2fddd2846de941273899b0541b6cf6590e396b6999` at
  height `153`.
- Latest launch-bound CashToken category:
  `f54a6239d9c043260cd6807dd7f5f2215ad3ae3bf2a739f78497ae2747b6c55f`.
- Latest launch-bound token genesis:
  `099471f4bdab69100e21ff25913838dfb15e493a69a55dcb4a860233db3c430b`.
- Latest launch-bound CashVM pool transaction:
  `aa41776798bc395feea1f4f50b233b95ba9698586f784a58f4bdfc6a259e1220`.
- Latest migration seed amounts: `328119` sats and `133581` CashTokens.
- Latest marker-backed BCH-to-token swap:
  `9b35938e7deb72287a9f4d1793cfb1b2ad0c16e477c975d64ea7832c1ab1a14e` at
  height `155`.
- Latest marker-backed token-to-BCH swap:
  `aba29690a5267b41224f5ea4ae4e0122482ff67a12c0894ae6443f6bd521faa7` at
  height `156`.
- Active pool reserves after the latest reverse swap: `423993` sats and `103451`
  CashTokens.
- Backend user payout after the BCH-to-token swap: `31130` CashTokens.
- Backend user payout after the token-to-BCH swap: `2126` sats, with `30130`
  CashTokens returned as change.
- Operator-gated CashVM proof spend:
  `e226c354e2dffefebd85762d64f34a453683489e8407800fe59e8411f65cd3b1`.
- Current redeem script:
  `76a914751e76e8199196d454941c45d1b3a323f1433bd688ac`.

This is an on-chain UTXO, CashToken, CashVM P2SH, transaction construction,
signing, mempool, mining, and explorer proof. It is still not a production
covenant that enforces the AMM reserve transition inside CashVM.

## Transaction Safety

- Mainnet `sendrawtransaction` calls are blocked unless
  `BCH_ALLOW_MAINNET_BROADCAST=true`.
- Raw transaction broadcasting flows through `testmempoolaccept` first.
- Rejected raw transactions are not broadcast.

## Local Proof UI

- `npm run demo` starts a local browser UI on `http://127.0.0.1:3000`.
- The backend owns a predefined regtest key and submits transactions directly to
  BCHN.
- Each launch action is encoded as a compact OP_RETURN event transaction.
- Each submitted action is mined into a block.
- The UI can also create a real CashToken output via BCHN raw transactions:
  pre-genesis vout `0`, token genesis, and fungible-only `tokenData.amount`.
- The UI can fund and spend a CashVM P2SH contract that requires the backend
  operator key signature.
- The UI can create a CashVM AMM pool UTXO and submit a backend-controlled BCH
  to CashToken swap against it.
- The UI can also submit a backend-controlled token to BCH swap by spending the
  predefined user's CashToken UTXO.
- The UI can run a composed launch-to-AMM proof pack that mines a TOKEN binding
  event, creates a CashVM pool for the bound token category with the launch
  graduation BCH/token amounts, and verifies both AMM swap directions.
- `/api/state` scans BCHN blocks and reconstructs launch state from chain
  events, token outputs, CashVM pool UTXOs, decoded AMM trades, and CashVM spend
  proofs.
- `/api/state.launchAmmProofPack` verifies the launch CREATE/GRADUATE events,
  TOKEN binding event, real token genesis output, CashVM pool, AMM proof pair,
  migration seed amounts, and CashVM P2SH spend audits.
- The UI renders an `AMM Trades` table with human-readable swap sides,
  input/output amounts, block height, token category, and local `/tx/<txid>`
  explorer links.
- The UI renders an `AMM Reserve Audit` table with expected versus actual pool
  reserves, prior-pool spend confirmation, CashVM spend status, and per-swap
  verification status.
- The UI has a `Run Full AMM Proof` button and a `Latest Proof Pack` receipt
  with the latest verified BCH-to-token and token-to-BCH explorer links.
- The UI has a `Run Launch To AMM Proof` button and receipt with launch token
  binding, graduation amounts, migrated pool amounts, pool, and AMM explorer
  links.
- `/tx/<txid>` acts as a local transaction explorer for the mined transaction;
  launch event pages include decoded event data, and AMM swap pages include a
  compact AMM/CashVM proof summary, decoded trade marker, reserve audit data,
  and CashVM P2SH spend audit data.

This proves backend-controlled local-chain execution, real CashToken genesis,
operator-gated CashVM contract spends, CashVM-held AMM pool UTXOs, backend
swaps in both AMM directions, decoded trade history, audited pool transitions,
audited CashVM pool spends, on-chain launch/token binding, graduation-sized AMM
migration, and chain-derived UI state. It still does not prove a production
CashVM covenant enforcing launch or AMM reserve math.

## Current Validation

Run:

```sh
npm run typecheck
npm test
npm run build
npm run security:audit
npm run node:health
```

Current local result:

- 14 test files.
- 61 unit tests.
- TypeScript strict mode passes.
- Build passes.
- npm audit reports 0 vulnerabilities.
- BCHN regtest health reports `ready: true`.
