# Security Notes

## Current Controls

- The BCHN Docker image is pinned to `zquestz/bitcoin-cash-node:29.0.0`.
- BCHN wallet RPCs are disabled in local node services.
- RPC ports are published only on `127.0.0.1`.
- Mainnet raw transaction broadcast is blocked in code unless explicitly enabled.
- Demo HTTP endpoints that prepare backend-signed transactions enforce bounded
  JSON object bodies, `application/json` content type, positive integer-string
  amounts, and a fixed maximum amount precision before submitting to BCHN.
- Runtime dependencies start with `@bitauth/libauth`, which has no runtime
  dependencies.
- `.env` is ignored and `.env.example` contains only development credentials.

## Required Before Mainnet

- Verify BCHN release signatures or build BCHN reproducibly.
- Replace all development RPC credentials.
- Run with dedicated infrastructure secrets and firewall rules.
- Add contract-level review for every covenant and script template.
- Add property tests for all value-conservation, fee, dust, and slippage rules.
- Require human approval for any mainnet broadcast path.
