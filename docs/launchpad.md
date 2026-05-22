# BitcoinCashEx Launchpad Design

## What We Have Now

BitcoinCashEx currently implements off-chain deterministic primitives:

- Constant-product AMM quote and liquidity math.
- BCH/CashToken asset metadata validation.
- Slippage checks.
- BCHN RPC readiness and raw-transaction safety checks.
- A local BCHN regtest UI that can mint a real CashToken, move it into a
  CashVM P2SH AMM pool UTXO, submit a backend-controlled BCH to token swap, and
  submit a token to BCH reverse swap.

This is not a full Uniswap implementation yet. It is now a working local
transaction proof for AMM pool custody and swap state transitions. The current
P2SH proof script requires the backend operator signature; the remaining
production step is replacing backend policy with a covenant that enforces the
reserve transition inside CashVM.

## Pump.fun-Style Model On Bitcoin Cash

A Bitcoin Cash version should be shaped around BCH-native constraints:

- Tokens are CashTokens, not ERC-20 balances.
- State is held in UTXOs, not contract storage.
- Contracts validate transactions as checklists.
- Covenant identity should be tracked with CashToken NFTs and commitments.
- User receipts should be explicit UTXOs or NFTs so failed/raced transactions
  can be retried safely.

## Launch Lifecycle

1. Create token category.
2. Lock launch supply in a launch covenant.
3. Sell tokens on a deterministic bonding curve.
4. Keep BCH proceeds in the covenant.
5. When the graduation threshold is reached, move remaining tokens and BCH into
   a CPMM pool.
6. Burn or lock any admin/migration authority.
7. Continue trading through the AMM.

## Bonding Curve Choice

The first implementation uses virtual reserves:

```text
price = virtual_bch_reserve / virtual_token_reserve
```

Buyers add BCH and remove tokens. Sellers add tokens and remove BCH. This is
compatible with the constant-product machinery we already test, and it keeps all
math integer-only.

Reasons to start here:

- It is simpler to audit than exponential or polynomial curves.
- It can graduate cleanly into a CPMM.
- It maps naturally to UTXO-held BCH and CashToken reserves.
- It can be tested off-chain before contract encoding.

## BCH-Specific Risks

- UTXO contention: many users spending the same curve UTXO can race. Production
  needs either batched orders, multiple sale threads, or retry-aware wallets.
- VM integer limits: contract math must be kept within CashVM number limits or
  use carefully bounded scaling.
- Token supply: CashToken fungible supply must fit consensus limits.
- MEV/order advantage: instant first-accepted transactions are simple but not
  always fair. Batch/tick settlement can reduce this.
- Graduation: migration into AMM must be deterministic and permissionless.
- Metadata: token identity, icon, and ticker should use registries without
  placing trust in mutable web metadata.

## Near-Term Build Plan

- Add virtual-reserve bonding curve quote math. Done in
  `src/defi/bondingCurve.ts`.
- Add launch configuration validation. Done in `src/defi/launchpad.ts`.
- Add graduation threshold calculations. Done in `src/defi/launchpad.ts`.
- Add deterministic launch lifecycle regression. Done in
  `tests/launchpad.test.ts`.
- Add BCHN-only CashToken mint, CashVM AMM pool, and backend swap proof. Done in
  `src/demo/chain.ts`, `src/demo/ammProof.ts`, and `tests/demoAmmProof.test.ts`.
- Add two-sided BCH-to-token and token-to-BCH AMM demo swaps. Done in
  `src/demo/chain.ts` and `src/demo/server.ts`.
- Add decoded AMM trade history to the demo UI and `/api/state` response. Done
  in `src/demo/server.ts`.
- Add AMM reserve-transition audits that reconstruct each swap from previous
  and next CashVM pool UTXOs. Done in `src/demo/ammProof.ts`,
  `src/demo/chain.ts`, and `src/demo/server.ts`.
- Add one-click AMM proof-pack runner and latest receipt selection. Done in
  `src/demo/chain.ts`, `src/demo/server.ts`, and `tests/demoAmmProof.test.ts`.
- Add transaction-builder data models for create, buy, sell, and graduate.
- Add CashScript or libauth contract templates after the math has full property
  coverage.
- Add regtest integration tests that create a CashToken category and exercise a
  launch lifecycle.

## Research References

- CashTokens: `https://cashtokens.org/`
- CashTokens specification: `https://github.com/cashtokens/cashtokens`
- CashScript: `https://github.com/CashScript/cashscript`
- CashTokens AMM DEX designs:
  `https://bitcoincashresearch.org/t/cashtokens-amm-dex-designs/1408`
- Fex.Cash Fair Meme whitepaper:
  `https://github.com/fex-cash/fex/blob/main/whitepaper/fairmeme_whitepaper.md`
- Fex.Cash AMM whitepaper:
  `https://github.com/fex-cash/fex/blob/main/whitepaper/fex_whitepaper.md`
- Jedex:
  `https://github.com/bitjson/jedex`

## Regtest Proof

The on-chain proof plan is tracked in
[regtest-token-proof.md](regtest-token-proof.md). The current codebase has a
deterministic launch regression; it does not yet mine a real CashToken launch on
BCHN regtest.

There is now also a local event-backed proof UI:

- Run `npm run demo`.
- Open `http://127.0.0.1:3000`.
- Click create, buy, sell, and graduate.
- The backend submits and mines BCHN regtest transactions for each action.
- Click mint real CashToken to create a pre-genesis transaction, spend vout `0`,
  and mine a BCHN transaction with native `tokenData`.
- Click run CashVM proof to fund a P2SH CashVM contract and spend it by
  signing with the predefined backend operator key.
- Click create AMM pool to move the real CashToken output into the CashVM P2SH
  pool UTXO.
- Click swap BCH to token to spend the active pool, recreate it with updated
  reserves, and pay CashTokens to the predefined backend user address.
- Click swap token to BCH to spend the active pool and predefined user's
  CashToken UTXO, recreate the pool, and pay BCH plus token change back to that
  user address.
- Click run full AMM proof to let the backend execute a fresh BCH-to-token swap
  and token-to-BCH swap, then verify the latest proof pair from chain-derived
  reserve audits and CashVM P2SH spend audits.
- The page reconstructs state from mined OP_RETURN event transactions, renders
  `Latest Proof Pack`, `AMM Trades`, and `AMM Reserve Audit` tables from
  `/api/state`, and links trade, event, token, and contract rows to local
  `/tx/<txid>` transaction views.
- AMM swap transaction views include the decoded trade marker, matching
  reserve-transition audit, and CashVM P2SH redeem-script spend audit, so the
  proof-pack links can be opened directly.
