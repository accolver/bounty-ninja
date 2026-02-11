## ADDED Requirements

### Requirement: SolutionForm Component

The system SHALL provide a `SolutionForm.svelte` component at
`src/lib/components/solution/SolutionForm.svelte` for submitting solutions to
bounties. The form SHALL collect: markdown description (proof of work), optional
deliverable URL, and the anti-spam fee payment. The form SHALL use Svelte 5
runes for all reactive state.

#### Scenario: SolutionForm visibility based on bounty status

- **WHEN** the bounty status is `open` or `in_review` and the user is
  authenticated
- **THEN** the SolutionForm SHALL be visible on the bounty detail page

#### Scenario: SolutionForm hidden for non-interactive states

- **WHEN** the bounty status is `draft`, `completed`, `expired`, or `cancelled`
- **THEN** the SolutionForm SHALL NOT be rendered

#### Scenario: SolutionForm hidden for unauthenticated users

- **WHEN** the user is not authenticated via NIP-07
- **THEN** the SolutionForm SHALL NOT be rendered
- **AND** a message SHALL display: "Sign in with a Nostr extension to submit a
  solution"

### Requirement: Anti-Spam Fee Validation

The system SHALL require every solution submission to include a Cashu token as
an anti-spam fee. The fee amount MUST be between `PUBLIC_MIN_SUBMISSION_FEE`
(default: 10 sats) and `PUBLIC_MAX_SUBMISSION_FEE` (default: 100 sats) as
defined in environment variables. If the bounty specifies a `["fee", "<sats>"]`
tag, the fee MUST match that exact amount. The anti-spam fee token is NOT
P2PK-locked — it is immediately claimable by the bounty creator as compensation
for reviewing submissions. The fee is non-refundable regardless of vote outcome.
See PRD Section 6.4.

#### Scenario: Fee within valid range

- **WHEN** the bounty specifies a fee of 21 sats via `["fee", "21"]` tag
- **THEN** the SolutionForm SHALL require exactly 21 sats as the anti-spam fee
- **AND** the fee amount SHALL be displayed to the user before submission

#### Scenario: Fee below minimum

- **WHEN** a solution event is received with a `["cashu", "<token>"]` tag
  containing less than `PUBLIC_MIN_SUBMISSION_FEE` sats
- **THEN** the system SHALL flag the solution as "Insufficient anti-spam fee"
- **AND** the solution SHALL be displayed with a warning badge: "Insufficient
  anti-spam fee"

#### Scenario: Fee above maximum

- **WHEN** a user attempts to submit a solution with a fee exceeding
  `PUBLIC_MAX_SUBMISSION_FEE` sats
- **THEN** the form SHALL display a validation error: "Submission fee must not
  exceed 100 sats"
- **AND** SHALL prevent submission

#### Scenario: Missing anti-spam fee

- **WHEN** a solution event is received without a `["cashu", "<token>"]` tag
- **THEN** the system SHALL display the solution with a warning badge: "No
  anti-spam fee"
- **AND** the solution SHALL still be visible but flagged as unverified per PRD
  Section 13.4

#### Scenario: Bounty with no fee tag

- **WHEN** a bounty does not include a `["fee", "<sats>"]` tag
- **THEN** the SolutionForm SHALL default to `PUBLIC_MIN_SUBMISSION_FEE` (10
  sats) as the required fee
- **AND** SHALL allow the user to increase the fee up to
  `PUBLIC_MAX_SUBMISSION_FEE` (100 sats)

### Requirement: Anti-Spam Fee Token Creation

The anti-spam fee token SHALL be a plain (non-P2PK-locked) Cashu token that the
bounty creator can immediately claim. This differs from pledge tokens which are
P2PK-locked.

#### Scenario: Create unlocked anti-spam fee token

- **WHEN** the user submits a solution
- **THEN** the system SHALL mint a Cashu token for the fee amount WITHOUT P2PK
  locking
- **AND** the token SHALL be immediately claimable by anyone (the bounty creator
  claims it as review compensation)
- **AND** the encoded token SHALL be placed in the `["cashu", "<token>"]` tag of
  the Kind 73001 event

### Requirement: Kind 73001 Solution Event Construction

The system SHALL construct a Kind 73001 event with the following tag structure
as defined in PRD Section 6.4:

**Required tags:**

- `["a", "37300:<bounty-creator-pubkey>:<d-tag>", "<relay-hint>"]` — bounty
  reference
- `["p", "<bounty-creator-pubkey>"]` — for notifications to the bounty creator
- `["cashu", "<serialized-cashu-token>"]` — anti-spam fee token (NOT
  P2PK-locked)
- `["client", "tasks.fyi"]` — application identifier

**Optional tags:**

- `["r", "<url>"]` — deliverable URL (e.g., PR link, file link)

**Content field:** Markdown description of the solution with proof of work.

#### Scenario: Complete solution event with all required tags

- **WHEN** a solution event is constructed
- **THEN** the event MUST contain `a`, `p`, `cashu`, and `client` tags
- **AND** the `a` tag SHALL reference the bounty's NIP-33 address
- **AND** the `p` tag SHALL contain the bounty creator's pubkey

#### Scenario: Solution with deliverable URL

- **WHEN** the solver provides a deliverable URL (e.g., a GitHub PR link)
- **THEN** the event SHALL include an `["r", "<url>"]` tag

#### Scenario: Solution without deliverable URL

- **WHEN** the solver does not provide a deliverable URL
- **THEN** the `r` tag SHALL NOT be present in the event

### Requirement: Solution Form Field Validation

The SolutionForm SHALL validate all inputs before allowing submission.

#### Scenario: Empty description

- **WHEN** the user submits a solution with an empty description
- **THEN** the form SHALL display a validation error: "Solution description is
  required"
- **AND** SHALL prevent submission

#### Scenario: Invalid deliverable URL

- **WHEN** the user enters a deliverable URL that is not a valid URL
- **THEN** the form SHALL display a validation error: "Please enter a valid URL"
- **AND** SHALL prevent submission

### Requirement: Solution Publishing and Optimistic Update

After anti-spam token creation and event construction, the system SHALL sign the
event via NIP-07, publish to all connected relays, and optimistically update the
local `EventStore`.

#### Scenario: Successful solution submission end-to-end

- **WHEN** the user submits a valid solution with anti-spam fee
- **THEN** the system SHALL: (1) create the anti-spam fee Cashu token, (2)
  construct the Kind 73001 event, (3) sign via NIP-07, (4) add to `EventStore`
  optimistically, (5) publish to all relays
- **AND** the solution SHALL appear in the `SolutionList` component immediately
- **AND** the bounty's `solutionCount` SHALL increment
- **AND** a success toast SHALL display: "Solution submitted!"

#### Scenario: Bounty status transition on first solution

- **WHEN** a bounty in `open` status receives its first solution
- **THEN** the bounty's derived status SHALL transition to `in_review`
- **AND** the `BountyStatusBadge` SHALL update accordingly
