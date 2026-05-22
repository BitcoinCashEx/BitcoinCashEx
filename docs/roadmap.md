# BitcoinCashEx Roadmap

## Phase 0: Trustworthy Foundation

- [x] Pin BCHN to the current stable CashVM-compatible release.
- [x] Keep local RPC private to localhost and disable the BCHN wallet.
- [x] Add a typed RPC client with mainnet broadcast guards.
- [x] Add node readiness checks for BCHN version, chain, index state, and CashVM
  activation.
- [x] Keep dependencies minimal and auditable.

## Phase 1: CashVM Contract Runtime

- Add CashVM bytecode utilities backed by `@bitauth/libauth`.
- Add contract template conventions for P2S and covenant-based protocols.
- Add offline transaction assembly and local VM validation fixtures.
- Add regtest funding helpers without storing private keys in the node.

## Phase 2: DeFi Primitives

- [x] Implement integer-only AMM quote and swap math.
- [ ] Add UTXO-backed pool state models.
- [x] Add CashTokens-aware accounting types.
- [ ] Add deterministic fee and dust handling.
- Build transaction builders for deposit, swap, withdraw, and cancel flows.

## Phase 2.5: Launchpad And Bonding Curve

- [x] Add virtual-reserve bonding curve quote math.
- [ ] Add launch configuration validation.
- [ ] Add graduation threshold calculation.
- [ ] Add buy, sell, and graduate transaction data models.
- [ ] Add CashVM contract templates for curve state and migration.
- [ ] Add regtest CashToken lifecycle tests.

## Phase 3: Indexing And State

- Add BCHN RPC and ZMQ ingestion.
- Add contract UTXO discovery and confirmation tracking.
- Add reorg-aware state transitions.
- Add token metadata registry support.

## Phase 4: Security Hardening

- Add property tests for protocol math and transaction invariants.
- Add static checks for unsafe RPC calls, secrets, and mainnet broadcast paths.
- Add reproducible deployment documentation.
- Add external review checkpoints before any mainnet release.

## Phase 5: Product Surface

- Add SDK APIs for wallets and apps.
- Add a minimal operator dashboard.
- Add chipnet integration examples.
- Add mainnet deployment runbooks after audit readiness.
