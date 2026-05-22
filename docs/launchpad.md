# BitcoinCashEx Launchpad Design

## What We Have Now

BitcoinCashEx currently implements off-chain deterministic primitives:

- Constant-product AMM quote and liquidity math.
- BCH/CashToken asset metadata validation.
- Slippage checks.
- BCHN RPC readiness and raw-transaction safety checks.

This is not a full Uniswap implementation yet. It is the tested math and node
foundation needed before adding CashVM contracts and transaction builders.

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
