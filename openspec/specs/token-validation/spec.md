## Requirements

### Requirement: Fail-Closed Financial Verification

Kind 73002 tokens SHALL be decoded and checked for unit, positive proof amounts,
sum, normalized mint, proof identity/replay, mint proof state, NUT-11 support,
declared payment key, and permanent P2PK policy. Only `valid` verification
contributes funding or voting value. `pending`, `unavailable`, and `invalid`
results SHALL contribute zero trusted value.

#### Scenario: Mint unavailable

- **WHEN** proof state cannot be established
- **THEN** the pledge SHALL remain visible as unavailable/unverified
- **AND** it SHALL not contribute financial state or authorize an action

#### Scenario: Unsupported locktime token

- **WHEN** a new pledge proof contains a locktime or refund key
- **THEN** it SHALL be invalid under the permanent Minibits policy
- **AND** no reclaim promise SHALL be inferred from its timestamp

### Requirement: Mutable Proof State

Proof-state results SHALL be freshness-bounded and revalidated for financial
actions because a previously unspent bearer proof can later be spent. Duplicate
proof identities across events SHALL count at most once using deterministic
event ordering.
