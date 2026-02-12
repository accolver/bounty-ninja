## ADDED Requirements

### Requirement: PledgeButton Component

The system SHALL provide a `PledgeButton.svelte` component at
`src/lib/components/pledge/PledgeButton.svelte` that serves as the "Fund this
task" call-to-action on the task detail page. The button SHALL open the
`PledgeForm` dialog when clicked.

#### Scenario: Authenticated user clicks PledgeButton

- **WHEN** an authenticated user clicks the PledgeButton on a task in `draft`
  or `open` status
- **THEN** the PledgeForm dialog SHALL open

#### Scenario: Unauthenticated user clicks PledgeButton

- **WHEN** an unauthenticated user clicks the PledgeButton
- **THEN** the system SHALL display a prompt to sign in with a Nostr extension
- **AND** SHALL NOT open the PledgeForm

#### Scenario: PledgeButton on completed/expired/cancelled task

- **WHEN** the task status is `completed`, `expired`, or `cancelled`
- **THEN** the PledgeButton SHALL be disabled
- **AND** SHALL display a tooltip explaining why (e.g., "This task is no
  longer accepting pledges")

### Requirement: PledgeForm Component

The system SHALL provide a `PledgeForm.svelte` component at
`src/lib/components/pledge/PledgeForm.svelte` rendered as a dialog/modal. The
form SHALL collect: pledge amount (in sats) and an optional message. The form
SHALL use Svelte 5 runes for all reactive state.

#### Scenario: Pledge amount validation — minimum

- **WHEN** the user enters a pledge amount of 0 or negative
- **THEN** the form SHALL display a validation error: "Pledge amount must be at
  least 1 sat"
- **AND** SHALL prevent submission

#### Scenario: Pledge amount validation — positive integer

- **WHEN** the user enters a non-integer or non-numeric pledge amount
- **THEN** the form SHALL display a validation error: "Pledge amount must be a
  whole number of sats"
- **AND** SHALL prevent submission

#### Scenario: Bearer instrument warning display

- **WHEN** the PledgeForm is opened
- **THEN** the form SHALL display a warning: "Cashu tokens are like cash. Once
  sent, they cannot be reversed. Ensure you trust this task creator."
- **AND** the user MUST acknowledge the warning before the submit button becomes
  active

### Requirement: Cashu Token Creation with P2PK Lock

When a pledge is submitted, the system SHALL create a Cashu token for the
specified amount, P2PK-locked to the task creator's pubkey per NUT-11. The
token creation flow uses `src/lib/cashu/escrow.ts` and `src/lib/cashu/p2pk.ts`.

#### Scenario: Successful token creation and locking

- **WHEN** the user confirms a pledge of N sats
- **THEN** the system SHALL mint N sats of Cashu tokens via the `CashuWallet`
- **AND** SHALL apply a P2PK spending condition locking the tokens to the task
  creator's hex pubkey
- **AND** SHALL encode the locked token using `getEncodedToken()` producing a
  `cashuA...` string

#### Scenario: Mint interaction failure during token creation

- **WHEN** the Cashu mint fails to mint tokens (network error, mint down)
- **THEN** the system SHALL display a toast: "Failed to create pledge tokens.
  Mint may be unavailable."
- **AND** SHALL NOT publish any Nostr event
- **AND** SHALL NOT perform any optimistic update

### Requirement: Kind 73002 Pledge Event Construction

The system SHALL construct a Kind 73002 event with the following tag structure
as defined in PRD Section 6.3:

**Required tags:**

- `["a", "37300:<task-creator-pubkey>:<d-tag>", "<relay-hint>"]` — task
  reference (NIP-33 address)
- `["p", "<task-creator-pubkey>"]` — for notifications to the task creator
- `["amount", "<sats>"]` — pledge amount in sats
- `["cashu", "<serialized-cashu-token>"]` — P2PK-locked Cashu token (NUT-11)
- `["mint", "<cashu-mint-url>"]` — the mint URL the token was minted from
- `["client", "bounty.ninja"]` — application identifier

**Content field:** Optional message from the funder.

#### Scenario: Complete pledge event with all required tags

- **WHEN** a pledge event is constructed
- **THEN** the event MUST contain `a`, `p`, `amount`, `cashu`, `mint`, and
  `client` tags
- **AND** the `a` tag SHALL reference the task's NIP-33 address in the format
  `37300:<pubkey>:<d-tag>`
- **AND** the `p` tag SHALL contain the task creator's pubkey
- **AND** the `amount` tag value SHALL match the token's actual sat amount
- **AND** the `cashu` tag SHALL contain the P2PK-locked encoded token
- **AND** the `mint` tag SHALL contain the mint URL used to create the token

#### Scenario: Pledge with optional message

- **WHEN** the funder includes a message (e.g., "Great idea, happy to fund
  this!")
- **THEN** the message SHALL be placed in the event's `content` field

### Requirement: Pledge Publishing and Optimistic Update

After token creation and event construction, the system SHALL sign the event via
NIP-07, publish to all connected relays, and optimistically update the local
`EventStore`.

#### Scenario: Successful pledge flow end-to-end

- **WHEN** the user submits a valid pledge
- **THEN** the system SHALL: (1) create P2PK-locked Cashu tokens, (2) construct
  the Kind 73002 event, (3) sign via NIP-07, (4) add to `EventStore`
  optimistically, (5) publish to all relays
- **AND** the task's `totalPledged` SHALL update immediately in the UI
- **AND** the pledge SHALL appear in the `PledgeList` component
- **AND** a success toast SHALL display: "Pledge of N sats submitted!"
- **AND** the PledgeForm dialog SHALL close

#### Scenario: Task status transition on first pledge

- **WHEN** a task in `draft` status receives its first pledge
- **THEN** the task's derived status SHALL transition to `open`
- **AND** the `TaskStatusBadge` SHALL update to reflect the new status

### Requirement: Single Mint Enforcement for MVP

For MVP, all pledges to a given task MUST use the same Cashu mint. If the
task specifies a `["mint", "<url>"]` tag, pledges MUST use that mint. If no
mint is specified, pledges SHALL use `PUBLIC_DEFAULT_MINT`.

#### Scenario: Mint mismatch prevention

- **WHEN** a user attempts to pledge using a different mint than the task's
  specified or default mint
- **THEN** the system SHALL reject the pledge with a validation error: "This
  task requires pledges from <mint-url>"
