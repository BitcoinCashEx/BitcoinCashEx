# Architecture

BitcoinCashEx is organized around a small set of boundaries:

- `src/node`: Bitcoin Cash Node RPC connectivity, readiness checks, and guarded
  raw transaction submission.
- `src/cashvm`: CashVM capability metadata and bytecode utilities.
- `src/defi`: deterministic protocol math and future contract state machines.
- `src/config.ts`: environment-driven runtime configuration.
- `src/cli.ts`: operational commands for local development and CI.

The first production constraint is that protocol behavior must be deterministic
and testable without a live node. Node-backed integration comes after core math
and transaction invariants are stable.

