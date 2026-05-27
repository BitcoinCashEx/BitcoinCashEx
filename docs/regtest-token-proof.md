# Regtest CashToken Proof Plan

The current launchpad regression proves deterministic launch accounting, not a
mined on-chain CashToken lifecycle. The next proof must create and spend real
CashToken UTXOs on regtest.

The repository now includes an intermediate local proof UI that submits and
mines backend-controlled BCHN regtest event transactions. It also creates a real
CashToken output by mining a pre-genesis transaction and spending vout `0` in a
token genesis transaction. It also funds and spends a P2SH CashVM contract that
requires the backend operator key signature, moves the real CashToken output
into that CashVM P2SH AMM pool UTXO, and executes a backend-submitted BCH to
token swap plus a token to BCH reverse swap by spending and recreating that
pool. The launch-to-AMM receipt also verifies that the pool was funded by
spending the bound CashToken genesis output, and that the token genesis spent
`<category>:0` before the launch TOKEN binding was mined. It also verifies that
the first migration transaction conserves the bound CashToken genesis amount
across the AMM pool output plus token change. It requires the bound genesis
output to be `tokenGenesisTxid:0`, requires launch and migration token outputs
to be fungible-only, and rejects same-category NFT authority in the migration
transaction. The first AMM pool vout must also be present in the migration
transaction's token outputs with the same token amount. This proves backend
transaction submission, chain-derived state, native BCHN `tokenData`, CashVM
spend plumbing, and AMM pool UTXO updates, but not yet CashVM-enforced covenant
custody.

## Practical Stack

- `mainnet-js@4.0.0-next.13` for wallet funding, CashToken genesis, token sends,
  and practical regtest/chipnet wallet workflows.
- `cashscript@0.12.1` plus `cashc@0.12.1` for CashVM covenants that hold and
  inspect CashToken UTXOs.
- `@bitauth/libauth@3.1.0-next.8` for lower-level transaction and VM checks.
- BCHN RPC remains the consensus node path for `testmempoolaccept`,
  `sendrawtransaction`, and transaction inspection.

`mainnet-js` regtest expects an Electrum/Fulcrum-style indexer. This repository
currently runs BCHN only, so a real wallet-level regtest proof needs a Fulcrum
service such as `ws://127.0.0.1:60003`, or it must use lower-level libauth
transaction construction directly.

## Required Regression

The integration test should:

1. Start BCHN regtest with May 2026 CashVM active.
2. Start Fulcrum connected to BCHN.
3. Fund a regtest wallet.
4. Create a real CashToken category.
5. Lock the launch supply in a launch covenant UTXO.
6. Execute buy transactions against the bonding curve.
7. Execute a sell transaction.
8. Reach the graduation threshold.
9. Move BCH plus remaining CashTokens into an AMM pool covenant.
10. Execute BCH-to-token and token-to-BCH AMM swaps.
11. Mine blocks and verify all resulting UTXOs.

## Current BCHN-Only Proof

The current implementation uses BCHN RPC directly, without Fulcrum:

- `/api/token` mines a real CashToken genesis output.
- `/api/pool` spends that token output into the CashVM P2SH pool address.
- AMM pool discovery requires a `BCHEXAMM1|<category>` OP_RETURN marker in the
  pool transaction and rejects NFT-bearing token reserves.
- New pool spends use redeem script
  `76a914751e76e8199196d454941c45d1b3a323f1433bd688ac`, a P2PKH signature
  check for the predefined backend operator key.
- `/api/swap` spends the active pool plus a backend BCH UTXO, recreates the
  pool with updated reserves, and pays CashTokens to the predefined user
  address. The swap transaction carries a decoded
  `BCHEXAMM1|TRADE|BCH_TO_TOKEN|...` marker.
- `/api/swap-token-to-bch` spends the active pool plus the predefined user's
  CashToken UTXO, recreates the pool with updated reserves, and pays BCH plus
  token change to that user address. The reverse swap transaction carries a
  decoded `BCHEXAMM1|TRADE|TOKEN_TO_BCH|...` marker.
- `/api/state` scans mined blocks, `tokenData`, live UTXO status, and decoded
  AMM trade history to show the current active pool and swap rows.
- Decoded trade rows use `height`, `txid`, `side`, `category`, `inputAmount`,
  and `outputAmount`, and the demo UI links each `txid` to `/tx/<txid>`.
- `/api/state.transitionAudits` reconstructs each AMM swap from the previous
  CashVM pool UTXO, the decoded trade marker, and the recreated pool UTXO. It
  checks the previous pool outpoint is spent, expected reserves match actual
  reserves, the constant-product invariant does not decrease, and the revealed
  redeem script hashes back to the spent CashVM P2SH pool script. It also checks
  the revealed redeem script is the expected backend operator script. The audit
  rejects malformed trade categories, sides, non-integer or zero trade amounts,
  and trade outputs that would underflow the previous BCH or token reserve.
- AMM proof-pack receipt construction rejects malformed token categories and
  transaction ids, malformed previous-pool transaction ids, and
  self-referential buy/sell audit transaction ids even if a caller supplies
  forged verified audit rows.
- `/api/proof-pack` is the one-click path: the backend mines a fresh
  BCH-to-token swap and a fresh token-to-BCH swap, then returns the latest
  verified proof receipt and local explorer links.
- `/api/launch-proof-pack` is the launch-to-AMM path: the backend ensures the
  pump-style launch is graduated, mines a `BCHEX1|TOKEN|<category>|<genesis>`
  binding event for a real CashToken, creates a CashVM pool for that category
  with the launch graduation BCH/token amounts, proves that token genesis spent
  `<category>:0`, proves that token genesis was mined before the TOKEN binding,
  proves that the pool input spent `<genesis>:0`, proves the migration
  transaction conserved the bound genesis token amount, rejects NFT-bearing
  launch or migration token outputs, proves the first AMM pool vout is present
  in the same transaction's token outputs, runs both AMM swap directions, and
  returns only after the chain-derived launch/AMM receipt verifies.
- `/tx/<swap-txid>` returns decoded `ammTrade` and `ammTransitionAudit` fields,
  so the explorer link itself shows marker data, expected reserves, actual
  reserves, previous pool spend confirmation, CashVM P2SH spend status, and
  operator redeem-script verification status.
- `/tx/<launch-event-txid>` shows decoded launch event details, including TOKEN
  binding category and token genesis transaction ids.

The current CashVM script gates custody by backend signature. The next hardening
milestone is a covenant template that validates token category continuity,
reserve deltas, fee accounting, and pool identity without trusting backend
policy.

## BCHN-Only Alternative

BCHN can create token outputs using `createrawtransaction` `tokenData`, and
token-aware signing requires previous-output `tokenData` in
`signrawtransactionwithkey`. This path now powers the local AMM proof. It avoids
Fulcrum but requires custom UTXO discovery and coin selection.

## References

- `https://mainnet.cash/tutorial/`
- `https://github.com/mainnet-cash/mainnet-js/blob/next/packages/mainnet-js/src/wallet/Cashtokens.test.ts`
- `https://cashscript.org/docs/language/globals/`
- `https://docs.bitcoincashnode.org/doc/json-rpc/createrawtransaction/`
- `https://docs.bitcoincashnode.org/doc/json-rpc/signrawtransactionwithkey/`
- `https://gitlab.com/bitcoin-cash-node/bitcoin-cash-node/-/raw/master/test/functional/bchn-rpc-tokens.py`
