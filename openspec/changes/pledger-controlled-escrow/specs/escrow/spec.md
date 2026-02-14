## CHANGED Requirements

### Requirement: Pledge Token Locking — Pledger Self-Custody

The system SHALL lock pledge tokens to the **pledger's own pubkey** instead of
the bounty creator's pubkey. The `createPledgeToken` function in
`src/lib/cashu/escrow.ts` SHALL accept `pledgerPubkey` as the lock target.

#### Scenario: Create self-locked pledge token

- **WHEN** a pledger creates a pledge for a bounty
- **THEN** the Cashu token SHALL be P2PK-locked to the pledger's own hex pubkey
  (not the bounty creator's pubkey)
- **AND** the locktime SHALL be set to the bounty's deadline (from the
  expiration tag)
- **AND** no refund keys SHALL be set (pledger already owns the primary key)
- **AND** the locked token SHALL be encoded and placed in the Kind 73002 event's
  `["cashu", "<token>"]` tag

#### Scenario: Pledger retains custody throughout lifecycle

- **WHEN** pledge tokens are published in Kind 73002 events
- **THEN** only the pledger (holder of the corresponding private key) SHALL be
  able to spend the tokens at the mint
- **AND** the bounty creator SHALL NOT be able to spend the pledge tokens
- **AND** no other party SHALL be able to spend the tokens before locktime

### Requirement: Per-Pledger Release to Solver

The system SHALL implement a new `releasePledgeToSolver` function in
`src/lib/cashu/escrow.ts` that allows a pledger to swap their self-locked tokens
for solver-locked tokens after vote consensus.

#### Scenario: Pledger releases funds to solver

- **WHEN** vote consensus has been reached (66% quorum) for a solution
- **AND** the pledger initiates the release
- **THEN** the system SHALL swap the pledger's P2PK-locked proofs at the mint
  using the pledger's private key
- **AND** SHALL create new proofs P2PK-locked to the winning solver's pubkey
- **AND** SHALL return the solver-locked proofs for inclusion in a Kind 73004
  event

#### Scenario: Release with mint fees

- **WHEN** the mint charges fees for the swap operation
- **THEN** the payout amount SHALL equal the pledge amount minus mint fees
- **AND** the Kind 73004 event's `amount` tag SHALL reflect the actual post-fee
  amount

#### Scenario: Double-spend detection during release

- **WHEN** the pledger attempts to release but the proofs have already been
  spent at the mint
- **THEN** the system SHALL throw a `DoubleSpendError`
- **AND** SHALL NOT publish a Kind 73004 event
- **AND** SHALL display a toast: "These tokens have already been spent"

### Requirement: Simplified Pledge Reclaim

The system SHALL simplify the `reclaimPledge` function since the pledger already
holds the P2PK key. No refund path is needed.

#### Scenario: Reclaim after deadline

- **WHEN** the bounty deadline has passed
- **AND** the pledger has not released their funds
- **THEN** the pledger SHALL be able to swap their P2PK-locked proofs at the
  mint using their private key
- **AND** SHALL receive unlocked proofs
- **AND** the reclaim SHALL NOT require a refund key (pledger is the primary key
  holder)

#### Scenario: Reclaim before deadline

- **WHEN** the bounty deadline has NOT passed
- **THEN** the pledger SHALL still be able to swap their proofs (P2PK primary
  key is always valid regardless of locktime)
- **AND** the UI SHOULD warn: "Reclaiming before the deadline will impact your
  reputation"

## REMOVED Requirements

### Requirement: Creator-Initiated Token Swap (REMOVED)

The `swapPledgeTokens` function is REMOVED. The creator no longer collects or
swaps pledge tokens. Each pledger releases their own portion.

### Requirement: Multi-Mint Payout Orchestration (REMOVED)

The `processMultiMintPayout` and `encodeMultiMintPayoutTokens` functions are
REMOVED. Creator-centric multi-mint aggregation is replaced by per-pledger
release at each pledge's mint.

### Requirement: Pledge Spendability Check (REMOVED)

The `checkPledgeProofsSpendable` function is REMOVED. Spendability is verified
implicitly during the per-pledger release swap.

### Requirement: Group Pledges by Mint (REMOVED)

The `groupPledgesByMint` function is REMOVED. Multi-mint grouping was needed for
creator-centric aggregated payout. Per-pledger release handles each pledge at
its own mint independently.
