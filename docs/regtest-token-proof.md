# Regtest CashToken Proof Plan

The current launchpad regression proves deterministic launch accounting, not a
mined on-chain CashToken lifecycle. The next proof must create and spend real
CashToken UTXOs on regtest.

The repository now includes an intermediate local proof UI that submits and
mines backend-controlled BCHN regtest event transactions. That UI proves
chain-derived state and backend transaction submission, but not CashToken
covenant custody.

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
10. Mine blocks and verify all resulting UTXOs.

## BCHN-Only Alternative

BCHN can create token outputs using `createrawtransaction` `tokenData`, and
token-aware signing requires previous-output `tokenData` in
`signrawtransactionwithkey`. This path avoids Fulcrum but requires more custom
wallet code.

## References

- `https://mainnet.cash/tutorial/`
- `https://github.com/mainnet-cash/mainnet-js/blob/next/packages/mainnet-js/src/wallet/Cashtokens.test.ts`
- `https://cashscript.org/docs/language/globals/`
- `https://docs.bitcoincashnode.org/doc/json-rpc/createrawtransaction/`
- `https://docs.bitcoincashnode.org/doc/json-rpc/signrawtransactionwithkey/`
- `https://gitlab.com/bitcoin-cash-node/bitcoin-cash-node/-/raw/master/test/functional/bchn-rpc-tokens.py`
