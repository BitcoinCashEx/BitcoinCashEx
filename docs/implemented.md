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
- `/api/state` scans BCHN blocks and reconstructs launch state from chain
  events.
- `/tx/<txid>` acts as a local transaction explorer for the mined event.

This proves backend-controlled local-chain execution and chain-derived UI state.
It still does not prove a production CashVM covenant holding real CashToken
reserves.

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

- 10 test files.
- 29 unit tests.
- TypeScript strict mode passes.
- Build passes.
- npm audit reports 0 vulnerabilities.
- BCHN regtest health reports `ready: true`.
