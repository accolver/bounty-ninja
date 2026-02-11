## ADDED Requirements

### Requirement: Client-Side Publish Rate Limiter

A `RateLimiter` service SHALL be created at `src/lib/nostr/rate-limiter.ts` that
enforces per-event-kind cooldown periods for publishing Nostr events. The rate
limiter MUST prevent accidental spam from rapid repeated submissions (e.g.,
double-clicking a submit button, network retry loops). The rate limiter SHALL
operate entirely client-side and SHALL NOT depend on relay-side rate limiting.

#### Scenario: User publishes a bounty event within cooldown

- **WHEN** a user successfully publishes a Kind 37300 bounty event
- **AND** attempts to publish another Kind 37300 event within the cooldown
  period (default: 30 seconds)
- **THEN** the second publish attempt SHALL be rejected
- **AND** a toast notification SHALL display: "Please wait before creating
  another bounty"
- **AND** the remaining cooldown time SHALL be shown

#### Scenario: User publishes different event kinds in sequence

- **WHEN** a user publishes a Kind 73002 pledge event
- **AND** immediately publishes a Kind 73001 solution event
- **THEN** both events SHALL be accepted because they are different event kinds
  with independent cooldown timers

#### Scenario: Cooldown period expires

- **WHEN** a user published a Kind 37300 bounty event 31 seconds ago (cooldown:
  30s)
- **AND** attempts to publish another Kind 37300 event
- **THEN** the publish SHALL be allowed

### Requirement: Per-Kind Cooldown Configuration

The rate limiter MUST support configurable cooldown periods per event kind.
Default cooldown values SHALL be:

- Kind 37300 (Bounty): 30 seconds
- Kind 73001 (Solution): 60 seconds
- Kind 73002 (Pledge): 10 seconds
- Kind 1018 (Vote): 5 seconds
- Kind 73004 (Payout): 60 seconds

#### Scenario: Vote cooldown is shorter than bounty cooldown

- **WHEN** a user casts a vote (Kind 1018)
- **THEN** the cooldown SHALL be 5 seconds
- **AND** the user SHALL be able to vote on a different solution after 5 seconds

#### Scenario: Pledge cooldown allows rapid funding

- **WHEN** a user pledges to a bounty (Kind 73002)
- **THEN** the cooldown SHALL be 10 seconds
- **AND** the user SHALL be able to pledge to a different bounty after 10
  seconds

### Requirement: Rate Limiter UI Integration

All publish-triggering UI elements (BountyForm submit, PledgeForm submit,
SolutionForm submit, VoteButton, payout trigger) MUST check the rate limiter
before initiating a publish. When a cooldown is active, the submit button MUST
be disabled and display the remaining cooldown time.

#### Scenario: Submit button disabled during cooldown

- **WHEN** a user has just published a bounty and the 30-second cooldown is
  active
- **THEN** the "Create Bounty" button on `/bounty/new` SHALL be disabled
- **AND** the button label SHALL show the remaining seconds (e.g., "Wait 25s")

#### Scenario: Cooldown countdown updates in real-time

- **WHEN** a cooldown is active for a publish action
- **THEN** the remaining time displayed on the button SHALL update every second
- **AND** when the countdown reaches zero, the button SHALL re-enable
  automatically

### Requirement: Rate Limiter State Persistence

Rate limiter state (last publish timestamps per kind) SHALL be stored in memory
only and SHALL NOT persist across page reloads. This ensures users are not
locked out after a page refresh.

#### Scenario: Page reload clears rate limiter state

- **WHEN** a user publishes a bounty event and immediately refreshes the page
- **THEN** the rate limiter state SHALL be cleared
- **AND** the user SHALL be able to publish another bounty event immediately

### Requirement: Rate Limiter Bypass for Replaceable Events

Parameterized replaceable events (Kind 37300 bounty updates) that update an
existing event (same `d` tag) SHALL have a reduced cooldown of 10 seconds
instead of the standard 30 seconds, since updates to existing bounties are a
legitimate rapid-edit use case.

#### Scenario: Bounty update has reduced cooldown

- **WHEN** a user edits an existing bounty (publishes a Kind 37300 with the same
  `d` tag)
- **THEN** the cooldown for the next edit of that same bounty SHALL be 10
  seconds
- **AND** creating a new bounty (different `d` tag) SHALL still use the
  30-second cooldown
