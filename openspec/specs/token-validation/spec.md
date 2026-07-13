## Requirements

### Requirement: Fail-Closed Financial Verification

Kind 73002 tokens SHALL be decoded and checked for unit, positive proof amounts,
sum, normalized mint, globally complete proof identity/replay ownership, mint proof state, cryptographic DLEQ issuance evidence, NUT-11 support,
declared payment key, and permanent P2PK policy. Only `valid` verification
contributes funding or voting value. `pending`, `unavailable`, and `invalid`
results SHALL contribute zero trusted value.

NUT-07 state SHALL NOT establish issuance authenticity. Missing or unverifiable
DLEQ evidence against the proof's exact mint keyset SHALL be invalid.

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
actions because a previously unspent proof can later be spent. Spend state is
separate from immutable issuance authenticity. A spent source contributes no
active funding or voting authority unless it has an exact valid source-bound
payout. Circular settlement evaluation SHALL monotonically prune unsettled
spent sources. A settled spent source remains historical release evidence, and
a spent payout remains valid completion evidence after solver claim. Replay
ownership is mint-scoped and global across pledge and payout outputs in all
loaded bounties; every claimant of a replayed proof is excluded, payout/source
identity overlap is invalid, and incomplete unbounded global relay coverage
fails closed.
