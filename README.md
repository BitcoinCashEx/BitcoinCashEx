# BitcoinCashEx

BitcoinCashEx is being built as a Bitcoin Cash DeFi engineering workspace for
CashVM-native contracts, BCHN-backed local development, deterministic protocol
math, and production-grade safety checks.

## Current Foundation

- Bitcoin Cash full node target: Bitcoin Cash Node (BCHN) `v29.0.0`.
- Local chain target: BCHN regtest with the May 2026 CashVM upgrade forced active.
- Public test chain target: BCHN chipnet for upgrade-compatible integration tests.
- Core runtime: TypeScript on Node.js, using auditable Bitcoin Cash primitives.
- Initial DeFi module: integer-only constant-product swap math with invariant tests.
- CashToken asset metadata validation.
- Liquidity mint, add, and remove quote math.
- Slippage guards.
- Virtual-reserve bonding curve math for launchpad pricing.
- Deterministic token launch lifecycle regression for create, buy, sell, and
  graduation.
- BCHN regtest AMM proof that moves a real CashToken output into a CashVM P2SH
  pool UTXO, swaps BCH into tokens, and swaps tokens back into BCH by spending
  and recreating the pool.
- One-click launch-to-AMM proof that binds a pump-style launch to a real
  CashToken category on chain, creates the CashVM pool with the launch
  graduation BCH/token amounts, proves the pool spent the bound token genesis
  output, and verifies both AMM swap directions.
- BCHN raw transaction safety helper that checks `testmempoolaccept` before
  broadcasting.

## Quick Start

```sh
npm install
npm test
npm run typecheck
npm run build
```

Start the local BCHN regtest node:

```sh
cp .env.example .env
npm run node:up
npm run node:health
```

Start the local launchpad proof UI:

```sh
npm run demo
```

Open `http://127.0.0.1:3000`. The backend uses a predefined regtest key,
submits BCHN transactions itself, mines each action, can mint a real CashToken
output, can fund and spend a simple CashVM P2SH contract, can create and swap
both directions against a CashVM-held AMM pool UTXO, renders decoded AMM trade
history plus reserve-transition, CashVM spend, and operator redeem-script audit
rows, can run a one-click AMM proof pack, can run a one-click launch-to-AMM
proof pack, and links each trade, event, token, and contract transaction to a
local transaction view under `/tx/<txid>`. Launch event pages show decoded event
details. AMM swap transaction pages include a compact AMM/CashVM proof summary,
decoded trade marker, reserve-transition audit, and P2SH redeem-script spend
audit for that exact transaction. The launch-to-AMM receipt also exposes the
expected and actual token-genesis and pool-funding outpoints so the UI proves
the CashToken category was created from its pre-genesis output and the AMM pool
was seeded from the bound CashToken genesis output. It also shows the token
binding order check proving token genesis was mined before the launch binding
event.

Stop it when finished:

```sh
npm run node:down
```

## Roadmap

The implementation roadmap is maintained in [docs/roadmap.md](docs/roadmap.md).
The node selection and CashVM activation notes are in
[docs/node-selection.md](docs/node-selection.md).
The pump.fun-style launchpad direction is described in
[docs/launchpad.md](docs/launchpad.md).
The missing on-chain CashToken regression path is tracked in
[docs/regtest-token-proof.md](docs/regtest-token-proof.md).

## Implemented Modules

- [src/node/rpc.ts](src/node/rpc.ts): typed BCHN JSON-RPC client with mainnet
  broadcast guardrails.
- [src/node/health.ts](src/node/health.ts): BCHN readiness and CashVM activation
  checks.
- [src/node/transactions.ts](src/node/transactions.ts): mempool-first raw
  transaction broadcast flow.
- [src/cashvm](src/cashvm): CashVM upgrade metadata and bytecode helpers.
- [src/defi](src/defi): BCH/CashToken assets, swap math, liquidity math, and
  slippage guards.
- [src/defi/bondingCurve.ts](src/defi/bondingCurve.ts): pump.fun-style
  virtual-reserve buy/sell quote math.
- [src/defi/launchpad.ts](src/defi/launchpad.ts): deterministic launch
  lifecycle state machine.
- [src/demo](src/demo): local browser demo backed by BCHN regtest
  transactions.
