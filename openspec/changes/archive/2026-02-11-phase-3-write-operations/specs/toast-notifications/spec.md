## ADDED Requirements

### Requirement: Global Toast State Store

The system SHALL provide a reactive toast notification state store at
`src/lib/stores/toast.svelte.ts` using Svelte 5 runes. The store SHALL manage a
queue of toast messages with support for multiple simultaneous toasts. The store
SHALL be a singleton class-based store using `$state` for the toast queue.

#### Scenario: Add a toast message

- **WHEN** any part of the application calls the toast store's `add()` method
  with a message, type, and optional duration
- **THEN** a new toast entry SHALL be added to the reactive queue
- **AND** the toast SHALL include: `id` (unique), `message` (string), `type`
  ("success" | "error" | "warning" | "info"), and `duration` (milliseconds,
  default 5000)

#### Scenario: Auto-dismiss toast after duration

- **WHEN** a toast's duration elapses
- **THEN** the toast SHALL be automatically removed from the queue
- **AND** the UI SHALL animate the toast out (respecting
  `prefers-reduced-motion`)

#### Scenario: Manual dismiss toast

- **WHEN** a user clicks the dismiss button on a toast
- **THEN** the toast SHALL be immediately removed from the queue

#### Scenario: Maximum toast limit

- **WHEN** more than 5 toasts are in the queue simultaneously
- **THEN** the oldest toast SHALL be removed to make room for the new one

### Requirement: Toaster Component

The system SHALL provide a `Toaster.svelte` component at
`src/lib/components/shared/Toaster.svelte` that renders the toast queue from the
toast store. The Toaster SHALL be mounted once in the root layout
(`src/routes/+layout.svelte`).

#### Scenario: Toast rendering position

- **WHEN** toasts are present in the queue
- **THEN** the Toaster SHALL render them in a fixed position at the bottom-right
  of the viewport (desktop) or bottom-center (mobile)
- **AND** toasts SHALL stack vertically with the newest at the bottom

#### Scenario: Toast type styling

- **WHEN** a toast of type "success" is rendered
- **THEN** it SHALL use the `--success` color token (`#9ece6a` dark / `#385f0d`
  light`)
- **WHEN** a toast of type "error" is rendered
- **THEN** it SHALL use the `--destructive` color token (`#f7768e` dark /
  `#8c4351` light`)
- **WHEN** a toast of type "warning" is rendered
- **THEN** it SHALL use the `--warning` color token (`#e0af68` dark / `#8f5e15`
  light`)
- **WHEN** a toast of type "info" is rendered
- **THEN** it SHALL use the `--primary` color token (`#7aa2f7` dark / `#2959aa`
  light`)

#### Scenario: Accessibility for toasts

- **WHEN** a toast is rendered
- **THEN** it SHALL use `role="alert"` and `aria-live="polite"` for screen
  reader announcement
- **AND** the dismiss button SHALL have `aria-label="Dismiss notification"`
- **AND** toasts SHALL be keyboard-dismissible via Escape key when focused

### Requirement: Toast Integration with Write Operations

All write operations (bounty creation, pledge, solution submission, vote
casting, payout) SHALL use the toast store to provide user feedback. See PRD
Section 13.

#### Scenario: Successful publish toast

- **WHEN** any event is successfully published to at least one relay
- **THEN** a "success" toast SHALL be displayed with an operation-specific
  message (e.g., "Bounty created!", "Pledge of N sats submitted!", "Solution
  submitted!", "Vote submitted!", "Payout sent!")

#### Scenario: Publish failure toast

- **WHEN** an event fails to publish to all relays
- **THEN** an "error" toast SHALL be displayed: "Failed to publish. Check relay
  connectivity."

#### Scenario: Signing cancelled toast

- **WHEN** the user rejects the NIP-07 signing prompt
- **THEN** a "warning" toast SHALL be displayed: "Signing cancelled"

#### Scenario: Signer timeout toast

- **WHEN** the NIP-07 signer times out after 30 seconds
- **THEN** an "error" toast SHALL be displayed: "Signer timed out. Please try
  again."

#### Scenario: Mint unavailable toast

- **WHEN** the Cashu mint is unreachable after retries
- **THEN** an "error" toast SHALL be displayed: "Mint unavailable. Try a
  different mint?"

#### Scenario: Token double-spend toast

- **WHEN** a Cashu token swap fails due to double-spend
- **THEN** an "error" toast SHALL be displayed: "This token has already been
  claimed"
