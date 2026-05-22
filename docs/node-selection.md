# Bitcoin Cash Node Selection

## Decision

Use Bitcoin Cash Node (BCHN) `v29.0.0` as the pinned full-node target for
BitcoinCashEx development.

Reasons:

- BCHN is the practical default Bitcoin Cash full node for current consensus.
- BCHN `v29.0.0` is the stable release listed by the official BCHN download data.
- BCHN `v29.0.0` implements the May 15, 2026 CashVM upgrade.
- The Docker image is pinned to an explicit version tag, not `latest`.
- The Docker service pins `platform: linux/amd64` because the published
  `29.0.0` Docker tag is currently listed for `linux/amd64`.
- Runtime RPC is bound to localhost on the host, with the BCHN wallet disabled.

## CashVM Upgrade

The May 15, 2026 Bitcoin Cash upgrade activates:

- Pay to Script (P2S).
- Bounded looping operations.
- Function definition and invocation operations.
- Re-enabled bitwise operations.

Activation references:

- Mainnet: MTP `1778846400`, May 15, 2026 12:00:00 UTC.
- Chipnet: MTP `1763208000`, November 16, 2025 12:00:00 UTC.
- Regtest: this repo starts BCHN with `-upgrade12activationtime=0`.

## Development Networks

- `regtest`: deterministic local testing, no wallet in the node, May 2026 rules
  forced active.
- `chipnet`: public upgrade-compatible integration testing.
- `mainnet`: read-only by default; raw transaction broadcast is blocked unless
  `BCH_ALLOW_MAINNET_BROADCAST=true`.

## Sources Checked

- Official BCHN download data: `https://bitcoincashnode.org/en/download.html`
- BCHN website versions file:
  `https://gitlab.com/bitcoin-cash-node/bchn-sw/bchnode-web/-/raw/master/app/data/versions.json`
- BCHN May 2026 upgrade spec:
  `https://upgradespecs.bitcoincashnode.org/2026-05-15-upgrade/`
- BCHN CLI docs for `-upgrade12activationtime`, `-chipnet`, `-regtest`, RPC,
  wallet, and ZMQ options:
  `https://docs.bitcoincashnode.org/doc/cli/bitcoind/`
- Docker image listing for the pinned `zquestz/bitcoin-cash-node:29.0.0` tag:
  `https://hub.docker.com/r/zquestz/bitcoin-cash-node/tags`
