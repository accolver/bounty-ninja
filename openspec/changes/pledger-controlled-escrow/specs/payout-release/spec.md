## CHANGED Requirements

### Requirement: Kind 73004 Published by Pledgers (Not Creator)

The Kind 73004 payout event SHALL be published by individual pledgers, not the
bounty creator. Each pledger publishes their own Kind 73004 containing
solver-locked tokens for their pledge portion.

#### Scenario: Pledger publishes payout event

- **WHEN** a pledger releases their funds to the solver
- **THEN** the pledger SHALL sign and publish a Kind 73004 event
- **AND** the event's pubkey SHALL be the pledger's pubkey (NOT the creator's)
- **AND** the `amount` tag SHALL reflect the pledger's released amount
- **AND** the `cashu` tag SHALL contain tokens P2PK-locked to the solver
- **AND** all standard tags SHALL be present: `a`, `e`, `p`, `amount`, `cashu`,
  `client`

#### Scenario: Multiple Kind 73004 events per bounty

- **WHEN** multiple pledgers release their funds
- **THEN** multiple Kind 73004 events SHALL exist for the same bounty
- **AND** each SHALL have a different pubkey (the releasing pledger)
- **AND** the total payout SHALL be the sum of all released amounts

### Requirement: Payout Authorization — Pledger-Based

The `parsePayout` function in `src/lib/bounty/helpers.ts` SHALL validate that a
Kind 73004 event was published by a pledger for the bounty (not necessarily the
creator).

#### Scenario: Validate payout from pledger

- **WHEN** a Kind 73004 event is received
- **THEN** the system SHALL verify that the event's pubkey matches a pubkey that
  has published a Kind 73002 pledge for the same bounty
- **AND** SHALL reject payout events from pubkeys that are not pledgers

#### Scenario: parsePayout signature change

- **WHEN** `parsePayout` is called
- **THEN** it SHALL accept a `pledgerPubkeys: string[]` parameter (the set of
  pubkeys from Kind 73002 events for this bounty) instead of
  `taskCreatorPubkey: string`
- **AND** SHALL validate `event.pubkey` is in the `pledgerPubkeys` set

### Requirement: BountyDetail Multi-Payout

The `BountyDetail` interface in `src/lib/bounty/types.ts` SHALL support multiple
payout events.

#### Scenario: BountyDetail.payouts replaces BountyDetail.payout

- **WHEN** a `BountyDetail` is constructed
- **THEN** the `payout: Payout | null` field SHALL be replaced with
  `payouts: Payout[]`
- **AND** the array SHALL contain all valid Kind 73004 events for this bounty
- **AND** consumers SHALL aggregate amounts across the array for total payout

### Requirement: parseBountyDetail Multi-Payout Aggregation

The `parseBountyDetail` function in `src/lib/bounty/helpers.ts` SHALL aggregate
multiple payout events and compute release progress.

#### Scenario: Parse multiple payouts

- **WHEN** `parseBountyDetail` is called with payout events
- **THEN** each payout event SHALL be validated against the set of pledger
  pubkeys (not the creator pubkey)
- **AND** all valid payout events SHALL be included in `BountyDetail.payouts`
- **AND** `deriveBountyStatus` SHALL be called with the vote tally result

### Requirement: Release Progress Tracking

The UI SHALL display release progress after consensus is reached.

#### Scenario: Release progress display

- **WHEN** the bounty status is `consensus_reached` or `releasing`
- **THEN** the UI SHALL display: "X of Y pledgers released (Z% of funds)"
- **AND** `X` SHALL be the count of unique pledger pubkeys in Kind 73004 events
- **AND** `Y` SHALL be the total count of unique pledger pubkeys in Kind 73002
  events
- **AND** `Z` SHALL be `(sum of released amounts / totalPledged) * 100`

### Requirement: Solver Claim from Multiple Payouts

The `SolverClaim.svelte` component SHALL aggregate tokens from multiple Kind
73004 payout events.

#### Scenario: Solver views multiple payouts

- **WHEN** the solver views a bounty with multiple payout events
- **THEN** the UI SHALL display the total aggregate payout amount
- **AND** SHALL list each individual payout with the releasing pledger's
  identity and amount
- **AND** SHALL provide claim instructions for each token
- **AND** SHALL indicate if some pledgers have not yet released

### Requirement: PayoutTrigger Redesign — Pledger Release Prompt

The `PayoutTrigger.svelte` component SHALL be redesigned as a pledger-facing
"Release Funds" prompt.

#### Scenario: Release prompt for pledgers after consensus

- **WHEN** vote consensus has been reached for a solution
- **AND** the current user has pledged to the bounty
- **AND** the current user has not yet released their funds
- **THEN** a "Release Funds to Solver" button SHALL be displayed
- **AND** the prompt SHALL show: the winning solution summary, the solver's
  pubkey (as npub), the pledger's pledge amount, and a warning about
  irreversibility

#### Scenario: Release prompt hidden after release

- **WHEN** the current user has already published a Kind 73004 for this bounty
- **THEN** the release button SHALL be hidden
- **AND** a "You have released your funds" confirmation SHALL be shown

#### Scenario: Non-pledgers see read-only status

- **WHEN** the current user has NOT pledged to the bounty
- **THEN** the release button SHALL NOT be shown
- **AND** the UI SHALL display the current release progress

#### Scenario: Private key handling for P2PK swap

- **WHEN** the pledger initiates a release
- **THEN** the system SHALL attempt to use the NIP-07 extension for signing
- **IF** the extension does not support P2PK proof signing
- **THEN** the system SHALL prompt for the pledger's nsec (same flow as current
  PayoutTrigger)
- **AND** the nsec SHALL be used only for the swap operation and SHALL NOT be
  stored

### Requirement: PledgeForm Lock Target Change

The `PledgeForm.svelte` component SHALL lock tokens to the pledger's own pubkey
instead of the bounty creator's pubkey.

#### Scenario: PledgeForm creates self-locked token

- **WHEN** the pledger submits a pledge via PledgeForm
- **THEN** the `createPledgeToken` function SHALL be called with the pledger's
  own pubkey (from `accountState.pubkey`)
- **AND** the locktime SHALL be the bounty deadline (from the expiration tag)
- **AND** the resulting token SHALL only be spendable by the pledger

#### Scenario: Bearer instrument warning updated

- **WHEN** the pledger views the pledge form
- **THEN** the warning SHALL state: "Your tokens will be locked to your own key
  until the bounty deadline. After vote consensus, you will be asked to release
  them to the winning solver."
- **AND** this replaces the old warning about trusting the task creator
