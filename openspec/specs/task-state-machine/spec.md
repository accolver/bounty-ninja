## Requirements

### Requirement: Trusted Bounty Lifecycle

All routes and actions SHALL derive lifecycle from the shared validated
financial projection, not raw event presence or declared amounts.

#### Scenario: Main progression

- **WHEN** projected events change
- **THEN** status SHALL progress through `draft`, `open`, `in_review`,
  `consensus_reached`, `releasing`, and `completed`
- **AND** `completed` SHALL require one valid source-bound payout for every
  active validated source pledge

#### Scenario: Trusted inputs

- **WHEN** a pledge is invalid, replayed, retracted, unavailable, or spent
  without a valid source-bound settlement
- **THEN** it SHALL not create funding, voting weight, consensus, release
  authority, completion, or reputation

#### Scenario: Historical settlement

- **WHEN** a spent source has an exact valid source-bound payout
- **THEN** its prior authority and completion SHALL be preserved
- **AND** a later spent payout SHALL not regress completion

#### Scenario: Ambiguous consensus

- **WHEN** multiple solutions meet quorum
- **THEN** no winner SHALL be selected and release SHALL remain blocked

### Requirement: Side States

An authorized creator Kind 73005 bounty retraction SHALL produce `cancelled`.
An expired deadline before completion SHALL produce `expired`, but SHALL not
unlock Cashu proofs. Unauthorized and cross-bounty retractions SHALL be ignored.
Latest-event choices SHALL use deterministic `(created_at, id)` ordering.
