## ADDED Requirements

### Requirement: BountyForm Component

The system SHALL provide a `BountyForm.svelte` component at
`src/lib/components/bounty/BountyForm.svelte` for creating new bounties. The
form SHALL use Svelte 5 runes (`$state`, `$derived`) for all reactive state. The
form SHALL collect: title, markdown description, reward target (sats), category
tags, optional deadline, optional mint URL preference, and optional anti-spam
submission fee.

#### Scenario: Form field validation — title

- **WHEN** the user submits the form with an empty title
- **THEN** the form SHALL display a validation error: "Title is required"
- **AND** SHALL prevent submission

#### Scenario: Form field validation — reward amount

- **WHEN** the user enters a reward amount of 0 or a negative number
- **THEN** the form SHALL display a validation error: "Reward must be a positive
  number of sats"
- **AND** SHALL prevent submission

#### Scenario: Form field validation — submission fee range

- **WHEN** the user sets a submission fee outside the range
  `PUBLIC_MIN_SUBMISSION_FEE` (10) to `PUBLIC_MAX_SUBMISSION_FEE` (100) sats
- **THEN** the form SHALL display a validation error: "Submission fee must be
  between 10 and 100 sats"
- **AND** SHALL prevent submission

#### Scenario: Form field validation — deadline in the past

- **WHEN** the user sets a deadline that is in the past
- **THEN** the form SHALL display a validation error: "Deadline must be in the
  future"
- **AND** SHALL prevent submission

#### Scenario: Successful form submission

- **WHEN** all form fields are valid and the user clicks "Create Bounty"
- **THEN** the form SHALL construct a Kind 37300 event using the bounty
  blueprint from `src/lib/bounty/blueprints.ts`
- **AND** SHALL sign the event via NIP-07
- **AND** SHALL publish to all connected relays
- **AND** SHALL perform an optimistic local update to the `EventStore`
- **AND** SHALL display a success toast: "Bounty created!"
- **AND** SHALL navigate the user to the newly created bounty's detail page at
  `/bounty/<naddr>`

### Requirement: Kind 37300 Event Tag Structure

The BountyForm MUST construct a Kind 37300 Parameterized Replaceable Event
(NIP-33) with the following tag structure as defined in PRD Section 6.2:

**Required tags:**

- `["d", "<unique-bounty-id>"]` — NIP-33 identifier, generated as a UUID or slug
- `["title", "<bounty title>"]` — human-readable title
- `["reward", "<amount>", "sat"]` — target reward amount in sats
- `["client", "tasks.fyi"]` — application identifier

**Optional tags (included when user provides values):**

- `["t", "<tag>"]` — repeatable category tags (e.g., `["t", "development"]`,
  `["t", "design"]`)
- `["expiration", "<unix-timestamp>"]` — NIP-40 deadline timestamp
- `["mint", "<cashu-mint-url>"]` — preferred Cashu mint URL
- `["fee", "<sats>"]` — anti-spam submission fee amount

**Content field:** Markdown description of the bounty requirements.

#### Scenario: All required tags present

- **WHEN** a bounty event is constructed
- **THEN** the event MUST contain `d`, `title`, `reward`, and `client` tags
- **AND** the `d` tag value SHALL be unique per creator pubkey

#### Scenario: Optional tags included conditionally

- **WHEN** the user provides category tags, a deadline, a mint URL, or a
  submission fee
- **THEN** the corresponding optional tags SHALL be included in the event
- **AND** when the user omits optional fields, those tags SHALL NOT be present
  in the event

#### Scenario: Multiple category tags

- **WHEN** the user enters multiple category tags (e.g., "development",
  "lightning", "hardware")
- **THEN** each tag SHALL produce a separate `["t", "<tag>"]` entry in the event
  tags array

### Requirement: Create Bounty Page Route

The system SHALL provide a create bounty page at
`src/routes/bounty/new/+page.svelte` that renders the `BountyForm` component.
This page SHALL require NIP-07 authentication.

#### Scenario: Authenticated user visits /bounty/new

- **WHEN** an authenticated user navigates to `/bounty/new`
- **THEN** the page SHALL render the `BountyForm` component

#### Scenario: Unauthenticated user visits /bounty/new

- **WHEN** an unauthenticated user navigates to `/bounty/new`
- **THEN** the page SHALL display a prompt: "Sign in with a Nostr extension to
  create a bounty"
- **AND** SHALL render the `LoginButton` component

### Requirement: Bounty d-Tag Generation

The system SHALL generate a unique `d` tag value for each new bounty. The `d`
tag combined with the creator's pubkey forms the NIP-33 address
(`<kind>:<pubkey>:<d-tag>`). The `d` tag MUST be unique within the creator's
pubkey namespace.

#### Scenario: Unique d-tag generation

- **WHEN** a new bounty is created
- **THEN** the system SHALL generate a `d` tag value using a combination of a
  URL-safe slug derived from the title and a random suffix (e.g.,
  `lightning-vending-machine-a1b2c3`)
- **AND** the resulting NIP-33 address `37300:<pubkey>:<d-tag>` SHALL be
  globally unique

### Requirement: Post-Creation Navigation

After successful bounty creation, the system SHALL encode the new bounty's
NIP-33 address as an `naddr` (NIP-19) and navigate the user to
`/bounty/<naddr>`.

#### Scenario: Navigation after creation

- **WHEN** a bounty is successfully published
- **THEN** the system SHALL encode the bounty address using
  `nip19.naddrEncode()` from `nostr-tools`
- **AND** SHALL navigate to `/bounty/<naddr>` using SvelteKit's `goto()`
