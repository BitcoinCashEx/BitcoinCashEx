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

This is not yet a live on-chain CashVM covenant test. The missing proof is a
regtest integration that creates a real CashToken category, builds CashVM
transactions, spends launch covenant UTXOs, and mines the lifecycle on BCHN.

## What The Regtest AMM Proof Proves

The local demo now proves the first on-chain AMM path on BCHN regtest:

- A real CashToken genesis transaction creates the launch asset.
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

Current local proof values:

- Initial pool transaction:
  `6d21a365013c10636de2f32635ab4a087f4d0788e695b9768e1192bf750fcff8`.
- Swap transaction:
  `1ee2ae9cdc69c563f68d0007c2a93d8896b970b8a7324cebca0e0dea1cfa8a29`.
- Reverse swap transaction:
  `beb1fb6d5d33d8e3acbc0a494371f1ee2b287567ddaca84eb335b5b167099144`.
- Active pool reserves after the reverse swap: `5000719128` sats and `899871`
  CashTokens.
- Backend user payout after the BCH-to-token swap: `179` CashTokens.
- Backend user payout after the token-to-BCH swap: `275872` sats, with `129`
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
- `/api/state` scans BCHN blocks and reconstructs launch state from chain
  events, token outputs, CashVM pool UTXOs, and CashVM spend proofs.
- `/tx/<txid>` acts as a local transaction explorer for the mined event.

This proves backend-controlled local-chain execution, real CashToken genesis,
operator-gated CashVM contract spends, CashVM-held AMM pool UTXOs, backend
swaps in both AMM directions, and chain-derived UI state. It still does not
prove a production CashVM covenant enforcing AMM reserve math.

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
- 45 unit tests.
- TypeScript strict mode passes.
- Build passes.
- npm audit reports 0 vulnerabilities.
- BCHN regtest health reports `ready: true`.
