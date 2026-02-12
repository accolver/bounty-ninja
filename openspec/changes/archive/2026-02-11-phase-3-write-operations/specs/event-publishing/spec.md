## ADDED Requirements

### Requirement: EventFactory Initialization

The system SHALL initialize an Applesauce `EventFactory` instance configured
with the NIP-07 signer from `$lib/nostr/signer.svelte.ts`. The `EventFactory`
MUST be the sole mechanism for constructing and signing Nostr events. The
factory SHALL be created lazily on first write operation, not at app startup.

#### Scenario: Factory creation with authenticated user

- **WHEN** a user is authenticated via NIP-07 and initiates their first write
  operation
- **THEN** an `EventFactory` instance SHALL be created with the NIP-07 signer
  from `applesauce-signers`
- **AND** the factory SHALL be reused for all subsequent write operations in the
  session

#### Scenario: Factory creation without authentication

- **WHEN** a write operation is attempted without NIP-07 authentication
- **THEN** the system SHALL reject the operation with an error message "Sign in
  with a Nostr extension to continue"
- **AND** no `EventFactory` SHALL be instantiated

### Requirement: Event Blueprint Registration

The system SHALL define Applesauce EventFactory blueprints in
`src/lib/task/blueprints.ts` for all five task event kinds: Kind 37300
(task), Kind 73002 (pledge), Kind 73001 (solution), Kind 1018 (vote), and Kind
73004 (payout). Each blueprint MUST produce a valid unsigned Nostr event with
the correct `kind`, `tags`, and `content` fields as specified in PRD Section 6.

#### Scenario: Task blueprint produces correct event structure

- **WHEN** the task blueprint is invoked with title, description, reward,
  tags, deadline, mint URL, and submission fee
- **THEN** the resulting unsigned event SHALL have `kind: 37300`
- **AND** SHALL include tags: `["d", "<unique-id>"]`, `["title", "<title>"]`,
  `["reward", "<amount>", "sat"]`, `["client", "bounty.ninja"]`
- **AND** SHALL include optional tags when provided: `["t", "<tag>"]`
  (repeatable), `["expiration", "<unix-timestamp>"]`, `["mint", "<url>"]`,
  `["fee", "<sats>"]`
- **AND** the `content` field SHALL contain the markdown description

#### Scenario: Blueprint for each event kind

- **WHEN** any blueprint is invoked
- **THEN** the resulting event MUST include the `["client", "bounty.ninja"]` tag as
  specified in PRD Section 6

### Requirement: NIP-07 Signing Flow

The system SHALL sign all events via the NIP-07 browser extension signer
(`window.nostr.signEvent()`). The application MUST NOT handle, store, or
transmit private keys under any circumstances. Signing SHALL be mediated through
`applesauce-signers`.

#### Scenario: Successful signing

- **WHEN** an unsigned event is passed to the NIP-07 signer
- **THEN** the signer extension SHALL be invoked to sign the event
- **AND** the signed event SHALL include a valid `sig` field and computed `id`

#### Scenario: User rejects signing

- **WHEN** the user rejects the NIP-07 signing prompt
- **THEN** the system SHALL catch the rejection error
- **AND** SHALL display a toast notification: "Signing cancelled"
- **AND** SHALL NOT publish any event or perform optimistic updates

#### Scenario: Signer timeout

- **WHEN** the NIP-07 signer does not respond within 30 seconds
- **THEN** the system SHALL abort the signing attempt
- **AND** SHALL display a toast notification: "Signer timed out. Please try
  again."

### Requirement: Multi-Relay Broadcasting

The system SHALL publish signed events to all connected relays simultaneously
via the Applesauce `RelayPool` from `$lib/nostr/relay-pool.ts`. A publish
operation SHALL be considered successful if at least one relay confirms receipt
(OK message). See PRD Section 11.2.

#### Scenario: Successful multi-relay publish

- **WHEN** a signed event is published to the relay pool
- **THEN** the event SHALL be sent to every relay in `pool.relays`
- **AND** the operation SHALL resolve as successful when at least one relay
  returns an OK confirmation

#### Scenario: All relays reject the event

- **WHEN** every connected relay rejects or fails to acknowledge the event
- **THEN** the system SHALL display a toast notification with the error: "Failed
  to publish event. Check relay connectivity."
- **AND** the optimistic local update SHALL be rolled back

#### Scenario: Partial relay failure

- **WHEN** some relays accept and some reject the event
- **THEN** the publish SHALL be considered successful
- **AND** failures SHALL be logged to the console for debugging

### Requirement: Optimistic Local Updates

The system SHALL insert signed events into the Applesauce `EventStore`
immediately after signing and before relay confirmation. This ensures the UI
updates instantly without waiting for relay round-trips. See PRD Section 7.4.

#### Scenario: Optimistic insert on publish

- **WHEN** an event is successfully signed
- **THEN** the event SHALL be added to `eventStore` via `eventStore.add(signed)`
  immediately
- **AND** the Svelte 5 rune-based stores (`tasks.svelte.ts`,
  `task-detail.svelte.ts`) SHALL reactively update
- **AND** the UI SHALL reflect the new event within the same render cycle

#### Scenario: Rollback on total publish failure

- **WHEN** all relays reject the published event
- **THEN** the optimistically inserted event SHALL be removed from the
  `EventStore`
- **AND** the UI SHALL revert to its previous state
