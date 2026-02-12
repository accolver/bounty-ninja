## ADDED Requirements

### Requirement: VoteButton Component

The system SHALL provide a `VoteButton.svelte` component at
`src/lib/components/voting/VoteButton.svelte` that allows pledgers to cast
approve or reject votes on solutions. The component SHALL render two buttons:
"Approve" and "Reject". The component SHALL use Svelte 5 runes for all reactive
state.

#### Scenario: VoteButton for eligible pledger

- **WHEN** an authenticated user who has published at least one Kind 73002
  pledge for the task views a solution
- **THEN** the VoteButton SHALL render enabled "Approve" and "Reject" buttons
- **AND** the user's vote weight (their total pledge amount) SHALL be displayed

#### Scenario: VoteButton for non-pledger

- **WHEN** an authenticated user who has NOT pledged to the task views a
  solution
- **THEN** the VoteButton SHALL render disabled buttons
- **AND** SHALL display a tooltip: "Only funders can vote"

#### Scenario: VoteButton for unauthenticated user

- **WHEN** an unauthenticated user views a solution
- **THEN** the VoteButton SHALL render disabled buttons
- **AND** SHALL display a tooltip: "Sign in and fund this task to vote"

#### Scenario: VoteButton after user has already voted

- **WHEN** a user who has already voted on a solution views the VoteButton
- **THEN** the button corresponding to their current vote SHALL be visually
  highlighted (active state)
- **AND** clicking the opposite button SHALL allow them to change their vote
  (publish a new Kind 1018 event)

### Requirement: Voting Eligibility Enforcement

Only pubkeys that have published at least one Kind 73002 pledge event for the
specific task SHALL be eligible to vote. This is enforced client-side by
checking the `EventStore` for matching pledge events. See PRD Section 6.5 and
PRD Section 14.2.

**Note:** Relays will accept any Kind 1018 event regardless of pledger status.
Eligibility enforcement is client-side only — the app validates on read by
ignoring votes from non-pledgers when computing tallies. This is a known
limitation documented in PRD Section 22.1.

#### Scenario: Pledger eligibility check

- **WHEN** a Kind 1018 vote event is received
- **THEN** the system SHALL look up the voter's pubkey in the set of Kind 73002
  pledge events for the referenced task
- **AND** if the voter has no matching pledge, the vote SHALL be assigned zero
  weight and excluded from the tally

#### Scenario: Multiple pledges from same pubkey

- **WHEN** a voter has published multiple Kind 73002 pledges for the same task
- **THEN** the voter's total pledge amount SHALL be the sum of all their pledge
  amounts
- **AND** the vote weight SHALL be `totalPledgeAmount` (linear)

### Requirement: Kind 1018 Vote Event Construction

The system SHALL construct a Kind 1018 event with the following tag structure as
defined in PRD Section 6.5:

**Required tags:**

- `["a", "37300:<task-creator-pubkey>:<d-tag>", "<relay-hint>"]` — task
  reference
- `["e", "<solution-event-id>", "<relay-hint>"]` — reference to the solution
  being voted on
- `["p", "<solution-author-pubkey>"]` — for notifications to the solution author
- `["vote", "approve"]` or `["vote", "reject"]` — the vote choice
- `["client", "bounty.ninja"]` — application identifier

**Content field:** Optional comment explaining the vote.

#### Scenario: Approve vote event

- **WHEN** a pledger clicks "Approve" on a solution
- **THEN** the event SHALL include `["vote", "approve"]`
- **AND** the `e` tag SHALL reference the solution's event ID
- **AND** the `a` tag SHALL reference the task's NIP-33 address

#### Scenario: Reject vote event

- **WHEN** a pledger clicks "Reject" on a solution
- **THEN** the event SHALL include `["vote", "reject"]`

### Requirement: Vote Deduplication

Each pubkey MAY vote once per solution. If a pubkey publishes multiple Kind 1018
events for the same solution, the latest event (by `created_at`) SHALL be the
canonical vote. Earlier votes SHALL be superseded. See PRD Section 6.5.

#### Scenario: Voter changes their vote

- **WHEN** a pledger who previously voted "approve" now votes "reject" on the
  same solution
- **THEN** a new Kind 1018 event SHALL be published with `["vote", "reject"]`
- **AND** the tally computation SHALL use only the latest vote (highest
  `created_at`) per pubkey per solution
- **AND** the previous "approve" weight SHALL be removed and replaced with
  "reject" weight

#### Scenario: Duplicate vote same choice

- **WHEN** a pledger votes "approve" on a solution they already approved
- **THEN** the system SHOULD prevent publishing a redundant event
- **AND** SHALL display a toast: "You have already voted to approve this
  solution"

### Requirement: Linear Weighted Vote Tally

Vote weight SHALL be calculated as `pledgeAmountInSats` (linear: 1 sat = 1 vote
weight) per PRD Section 10.2. The tally SHALL use the `tallyVotes()` function
from `src/lib/task/voting.ts`.

#### Scenario: Vote weight calculation

- **WHEN** a voter has pledged 10,000 sats to the task
- **THEN** their vote weight SHALL be `10000`

#### Scenario: Zero pledge amount

- **WHEN** a voter has 0 sats pledged (non-pledger)
- **THEN** their vote weight SHALL be 0
- **AND** their vote SHALL be excluded from the tally

#### Scenario: Quorum determination

- **WHEN** the total pledged amount for a task is 40,000 sats
- **THEN** the quorum threshold SHALL be `40000 * 0.5` = 20000
- **AND** a solution is "approved" when total approve weight > total reject
  weight AND total approve weight >= 20000

### Requirement: Real-Time Vote Tally Updates

The `VoteProgress` component SHALL update in real-time as new Kind 1018 events
arrive in the `EventStore`. The tally SHALL be recomputed reactively using
Svelte 5 `$derived` runes.

#### Scenario: New vote arrives via relay

- **WHEN** a new Kind 1018 vote event is received from a relay subscription
- **THEN** the event SHALL be added to the `EventStore`
- **AND** the `task-detail.svelte.ts` store SHALL reactively recompute the
  vote tally
- **AND** the `VoteProgress` component SHALL re-render with updated
  approve/reject weights and quorum percentage

#### Scenario: Consensus reached

- **WHEN** a solution's approve weight exceeds the quorum threshold and exceeds
  reject weight
- **THEN** the `VoteResults` component SHALL display: "Solution approved!
  Awaiting payout from task creator."
- **AND** the task creator SHALL see a "Trigger Payout" button

### Requirement: Vote Publishing and Optimistic Update

After event construction, the system SHALL sign the vote event via NIP-07,
publish to all connected relays, and optimistically update the local
`EventStore`.

#### Scenario: Successful vote submission

- **WHEN** a pledger casts a vote
- **THEN** the system SHALL: (1) construct the Kind 1018 event, (2) sign via
  NIP-07, (3) add to `EventStore` optimistically, (4) publish to all relays
- **AND** the vote tally SHALL update immediately in the UI
- **AND** a success toast SHALL display: "Vote submitted!"
