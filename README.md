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
submits BCHN transactions itself, mines each action, and links each event to a
local transaction view under `/tx/<txid>`.

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
