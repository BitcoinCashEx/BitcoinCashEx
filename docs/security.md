# Security Notes

## Current Controls

- The BCHN Docker image is pinned to `zquestz/bitcoin-cash-node:29.0.0`.
- BCHN wallet RPCs are disabled in local node services.
- RPC ports are published only on `127.0.0.1`.
- BCHN RPC configuration fails fast on invalid booleans, unsupported URL
  protocols, credential-bearing URLs, empty credentials, and invalid timeouts.
- BCHN RPC responses are validated as JSON-RPC objects before their `result` is
  trusted; node-readiness result payloads are also shape-checked before health
  fields are used.
- Mainnet raw transaction broadcast is blocked in code unless explicitly enabled.
- Raw transaction broadcast helpers reject malformed raw transaction hex,
  malformed `testmempoolaccept` responses, malformed fee/vsize fields,
  malformed broadcast txids, and mismatched accepted-versus-broadcast txids.
- BCHN BCH amount values are checked for finite whole-satoshi monetary range
  before conversion into integer sats.
- Demo HTTP endpoints that prepare backend-signed transactions enforce bounded
  JSON object bodies, `application/json` content type, positive integer-string
  amounts, and a fixed maximum amount precision before submitting to BCHN.
- Demo HTTP endpoints reject duplicate request framing headers before reading
  backend-signed action bodies.
- On-chain demo event decoding rejects malformed field counts, invalid symbols,
  and non-positive trade amounts before launch replay.
- OP_RETURN event parsing rejects malformed hex, unsupported push opcodes,
  truncated pushdata, and trailing script bytes before decoding launch events.
- CashVM proof marker and P2SH scriptSig parsing reject malformed hex and
  truncated pushdata before proving contract spends.
- CashVM proof scanning never falls back to a trusted local redeem script when
  the on-chain spend input is missing or malformed.
- AMM marker parsing rejects malformed bytecode and zero-sized trade markers
  before reserve audits build proof-pack receipts.
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
