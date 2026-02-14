## CHANGED Requirements

### Requirement: Extended Bounty Status Type

The `BountyStatus` type in `src/lib/bounty/types.ts` SHALL be extended with two
new statuses: `consensus_reached` and `releasing`.

#### Scenario: BountyStatus type definition

- **WHEN** the `BountyStatus` type is defined
- **THEN** it SHALL include:
  `'open' | 'in_review' | 'consensus_reached' |
'releasing' | 'completed' | 'expired' | 'cancelled'`
- **AND** `consensus_reached` SHALL represent the state where vote quorum (66%)
  has been met but no pledger has released funds yet
- **AND** `releasing` SHALL represent the state where at least one pledger has
  released funds but the bounty is not yet fully paid out

### Requirement: Vote-Aware Status Derivation

The `deriveBountyStatus` function in `src/lib/bounty/state-machine.ts` SHALL
accept a `hasConsensus` parameter to determine whether vote quorum has been
reached.

#### Scenario: Status priority chain

- **WHEN** `deriveBountyStatus` is called with all event arrays and the
  `hasConsensus` flag
- **THEN** the status priority chain SHALL be (highest to lowest):
  1. `cancelled` — if delete events exist
  2. `completed` — if payout events exist AND all pledgers have released OR
     deadline has passed (conservative: any payouts = completed)
  3. `expired` — if the expiration tag is in the past AND no payouts exist
  4. `releasing` — if any payout events exist (but not all pledgers released)
  5. `consensus_reached` — if `hasConsensus` is true AND no payouts exist
  6. `in_review` — if solution events exist
  7. `open` — default for any published bounty

#### Scenario: Transition to consensus_reached

- **WHEN** at least one solution has received 66% approval weight AND no Kind
  73004 payout events exist
- **THEN** the status SHALL be `consensus_reached`

#### Scenario: Transition to releasing

- **WHEN** at least one Kind 73004 payout event exists for the bounty AND
  `hasConsensus` is true
- **THEN** the status SHALL be `releasing`

#### Scenario: Transition to completed

- **WHEN** Kind 73004 payout events exist
- **THEN** the status SHALL be `completed`
- **AND** the UI SHALL display the aggregate released amount vs. total pledged
  amount

#### Scenario: Expired overrides consensus but not payouts

- **WHEN** the bounty deadline has passed AND no payout events exist
- **THEN** the status SHALL be `expired` regardless of whether consensus was
  reached
- **AND** pledgers SHALL be able to reclaim their funds

### Requirement: BountyStatusBadge Extension

The `BountyStatusBadge.svelte` component SHALL support the new statuses with
appropriate labels and styling.

#### Scenario: New status badge configurations

- **WHEN** the bounty status is `consensus_reached`
- **THEN** the badge SHALL display "Consensus Reached" with an appropriate color
  (e.g., Tokyo Night cyan/info)
- **WHEN** the bounty status is `releasing`
- **THEN** the badge SHALL display "Releasing Funds" with an appropriate color
  (e.g., Tokyo Night yellow/warning)
