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
  output, proves the migration transaction conserves the bound genesis token
  amount, proves the first pool vout is present in same-transaction token
  outputs, rejects NFT-bearing launch or migration token outputs, and verifies
  both AMM swap directions.
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
decoded trade marker, reserve-transition audit, malformed-marker and reserve
underflow checks, and P2SH redeem-script spend audit for that exact transaction.
Pool summaries, quotes, and audits validate token categories and BCH reserve
strings before integer reserve math.
AMM funding and token-sell selectors fail closed on non-positive trade amounts,
malformed token data, and NFT-bearing token UTXOs before the backend prepares a
spend.
Backend-signed POST actions validate bounded JSON object bodies, JSON content
type, and positive integer-string amounts before preparing transactions.
BCHN RPC configuration fails fast on ambiguous boolean switches, unsupported
RPC URL protocols, URL-embedded credentials, empty credentials, and invalid
timeouts.
BCHN JSON-RPC responses are validated before returned results are trusted.
Raw transaction helpers validate transaction hex, `testmempoolaccept` response
shape, and broadcast txids before accepting a broadcast result.
On-chain launch events validate exact field counts and positive trade amounts
before replaying chain state.
Proof-pack receipts also reject malformed categories, malformed transaction
ids, and self-referential audit pairs.
The launch-to-AMM receipt also exposes the
expected and actual token-genesis and pool-funding outpoints so the UI proves
the CashToken category was created from its pre-genesis output and the AMM pool
was seeded from the bound CashToken genesis output. It also shows the token
binding order check proving token genesis was mined before the launch binding
event, plus the migration token conservation check for pool output plus token
change. The receipt also requires the bound genesis output to be
`tokenGenesisTxid:0` and fungible-only, and rejects same-category NFT authority
in the migration transaction. The pool output is also cross-checked against the
same transaction's token outputs at the exact AMM pool vout.

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
