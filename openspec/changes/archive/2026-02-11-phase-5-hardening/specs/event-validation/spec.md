## ADDED Requirements

### Requirement: Nostr Event Signature Verification

All Nostr events retrieved from relays or loaded from the IndexedDB cache MUST
have their signatures verified before being rendered in any UI component.
Signature verification SHALL use `verifyEvent()` from `nostr-tools`. Events that
fail signature verification MUST be silently discarded and SHALL NOT be inserted
into the Applesauce `EventStore`.

#### Scenario: Valid event passes verification

- **WHEN** a Nostr event is received from a relay WebSocket subscription
- **THEN** `verifyEvent(event)` from `nostr-tools` SHALL be called
- **AND** if the function returns `true`, the event SHALL be added to the
  `EventStore` and persisted to IndexedDB

#### Scenario: Event with invalid signature is rejected

- **WHEN** a Nostr event is received whose `sig` field does not match the `id`
  and `pubkey`
- **THEN** `verifyEvent(event)` SHALL return `false`
- **AND** the event SHALL NOT be added to the `EventStore`
- **AND** the event SHALL NOT be persisted to IndexedDB
- **AND** a warning SHALL be logged to the console:
  `"Rejected event with invalid signature: <event.id>"`

#### Scenario: Event loaded from IndexedDB cache is re-verified

- **WHEN** events are loaded from the `nostr-idb` IndexedDB cache on application
  startup
- **THEN** each event SHALL be verified with `verifyEvent()` before being added
  to the `EventStore`
- **AND** any cached events that fail verification SHALL be deleted from
  IndexedDB

### Requirement: Required Tag Validation for Bounty Events

Kind 37300 bounty events MUST be validated for required tags before being parsed
and displayed. A bounty event MUST contain at minimum: a `d` tag, a `title` tag
(or `subject` tag), and a `reward` tag with a valid numeric amount. Events
missing any required tag SHALL be skipped and not displayed.

#### Scenario: Bounty event missing required d tag

- **WHEN** a Kind 37300 event is received that has no `d` tag
- **THEN** the event SHALL NOT be parsed into a `Bounty` object
- **AND** a warning SHALL be logged:
  `"Skipping bounty event missing 'd' tag: <event.id>"`

#### Scenario: Bounty event with invalid reward amount

- **WHEN** a Kind 37300 event has a `reward` tag whose value is not a positive
  integer (e.g., `"abc"`, `"-100"`, `"0"`)
- **THEN** the event SHALL NOT be parsed into a `Bounty` object
- **AND** a warning SHALL be logged:
  `"Skipping bounty event with invalid reward: <event.id>"`

#### Scenario: Valid bounty event with all required tags

- **WHEN** a Kind 37300 event has valid `d`, `title`, and `reward` tags and
  passes signature verification
- **THEN** it SHALL be parsed into a `Bounty` object and displayed in the UI

### Requirement: Required Tag Validation for Pledge Events

Kind 73002 pledge events MUST contain: an `a` tag referencing a valid bounty
address (format `37300:<pubkey>:<d-tag>`), an `amount` tag with a positive
integer, a `cashu` tag with a non-empty value, and a `mint` tag with a valid
URL.

#### Scenario: Pledge event missing bounty reference

- **WHEN** a Kind 73002 event has no `a` tag or an `a` tag that does not match
  the format `37300:<hex-pubkey>:<d-tag>`
- **THEN** the event SHALL NOT be parsed into a `Pledge` object
- **AND** it SHALL NOT appear in any pledge list

#### Scenario: Pledge event with empty cashu tag

- **WHEN** a Kind 73002 event has a `cashu` tag with an empty string value
- **THEN** the event SHALL NOT be parsed into a `Pledge` object

### Requirement: Required Tag Validation for Solution Events

Kind 73001 solution events MUST contain: an `a` tag referencing a valid bounty
address and non-empty `content` field.

#### Scenario: Solution event with empty content

- **WHEN** a Kind 73001 event has an empty `content` field
- **THEN** the event SHALL NOT be displayed in the solution list

### Requirement: Required Tag Validation for Vote Events

Kind 1018 vote events MUST contain: an `a` tag referencing a valid bounty
address, an `e` tag referencing a solution event ID, and a `vote` tag with value
`"approve"` or `"reject"`.

#### Scenario: Vote event with invalid vote value

- **WHEN** a Kind 1018 event has a `vote` tag with a value other than
  `"approve"` or `"reject"`
- **THEN** the vote SHALL be ignored and not counted in the tally

#### Scenario: Vote from non-pledger is ignored

- **WHEN** a Kind 1018 vote event is received from a pubkey that has not
  published a Kind 73002 pledge for the referenced bounty
- **THEN** the vote SHALL have zero weight in the tally
- **AND** it SHALL NOT be displayed in the vote count

### Requirement: Payout Event Authorization

Kind 73004 payout events MUST only be accepted from the bounty creator's pubkey.
A payout event MUST reference the bounty via an `a` tag and the winning solution
via an `e` tag.

#### Scenario: Payout event from non-creator is rejected

- **WHEN** a Kind 73004 event is received whose `pubkey` does not match the
  bounty creator's pubkey
- **THEN** the event SHALL be ignored
- **AND** it SHALL NOT affect the bounty's status

#### Scenario: Valid payout event transitions bounty to completed

- **WHEN** a Kind 73004 event is received from the bounty creator's pubkey with
  valid `a` and `e` tags
- **THEN** the bounty status SHALL transition to `"completed"`
