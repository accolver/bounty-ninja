## CHANGED Requirements

### Requirement: BountyStatus Type Extension

The `BountyStatus` type in `src/lib/bounty/types.ts` SHALL be extended.

#### Scenario: New status values

- **WHEN** the `BountyStatus` union type is defined
- **THEN** it SHALL include `'consensus_reached'` and `'releasing'` in addition
  to existing values
- **AND** the full type SHALL be:
  `'open' | 'in_review' | 'consensus_reached' | 'releasing' | 'completed' | 'expired' | 'cancelled'`

### Requirement: BountyDetail Payouts Array

The `BountyDetail` interface SHALL use `payouts: Payout[]` instead of
`payout: Payout | null`.

#### Scenario: BountyDetail.payouts field

- **WHEN** a `BountyDetail` object is constructed
- **THEN** the `payouts` field SHALL be an array of `Payout` objects
- **AND** an empty array indicates no payouts have been made
- **AND** multiple entries indicate multiple pledgers have released

### Requirement: EscrowState Type Update

The `EscrowState` type in `src/lib/cashu/types.ts` SHALL be updated to reflect
the pledger-controlled model.

#### Scenario: Updated escrow states

- **WHEN** the `EscrowState` type is defined
- **THEN** it SHALL include: `'locked' | 'released' | 'reclaimed' | 'expired'`
- **AND** `locked` SHALL mean tokens are P2PK-locked to the pledger's pubkey
- **AND** `released` SHALL mean the pledger has swapped tokens to solver-locked
  (replaces `claimed`)
- **AND** `reclaimed` SHALL mean the pledger took back their tokens after
  deadline (replaces `refunded`)
- **AND** `expired` SHALL mean the locktime passed without action

### Requirement: Payout Interface Unchanged

The `Payout` interface in `src/lib/bounty/types.ts` SHALL remain structurally
unchanged. The `pubkey` field now represents the releasing pledger (not the
creator), but the interface shape is the same.

#### Scenario: Payout.pubkey semantics

- **WHEN** a `Payout` object is created
- **THEN** the `pubkey` field SHALL contain the hex pubkey of the pledger who
  released the funds
- **AND** this MAY differ from the bounty creator's pubkey

### Requirement: Blueprint Parameter Updates

The `PayoutBlueprintParams` in `src/lib/bounty/blueprints.ts` SHALL remain
unchanged in structure. The caller changes (pledger calls it instead of
creator), but the parameters are the same.

The `PledgeBlueprintParams` in `src/lib/bounty/blueprints.ts` SHALL remain
unchanged in structure. The `creatorPubkey` field is still used for the `p` tag
(notification to creator), but the Cashu token inside is now locked to the
pledger — this is a caller-side change, not a blueprint change.

#### Scenario: PledgeBlueprint still references creator for p-tag

- **WHEN** a pledge blueprint is constructed
- **THEN** the `p` tag SHALL still reference the bounty creator's pubkey (for
  notification purposes)
- **AND** the `cashu` tag SHALL contain a token locked to the pledger's pubkey
  (this is determined by the caller, not the blueprint)
