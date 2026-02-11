## ADDED Requirements

### Requirement: Settings Page

The application SHALL provide a settings page at
`src/routes/settings/+page.svelte` that allows authenticated users to manage
their relay list, preferred Cashu mint, and theme preference.

The settings page SHALL require NIP-07 authentication. If the user is not
authenticated, the page SHALL display a prompt to log in via a NIP-07 browser
extension.

All user settings SHALL be persisted to `localStorage` under a namespaced key
`tasks.fyi:settings` as a JSON-serialized object.

Settings SHALL be loaded from `localStorage` on application initialization and
applied before first render where possible (theme) or on relay/mint
initialization.

#### Scenario: Authenticated user visits settings

- **WHEN** an authenticated user navigates to `/settings`
- **THEN** the page SHALL display sections for Relay Management, Cashu Mint
  Selection, and Theme Toggle
- **THEN** each section SHALL reflect the user's current persisted settings

#### Scenario: Unauthenticated user visits settings

- **WHEN** an unauthenticated user navigates to `/settings`
- **THEN** the page SHALL display a message "Sign in with a Nostr extension to
  manage your settings" with a `LoginButton` component

### Requirement: Relay List Management

The settings page SHALL provide a relay list management interface that allows
users to add and remove Nostr relay WebSocket URLs.

The relay list SHALL be initialized with the default relays from the
`PUBLIC_DEFAULT_RELAYS` environment variable.

Adding a relay SHALL validate that the input is a valid WebSocket URL (starting
with `wss://` or `ws://`).

Removing a relay SHALL require confirmation if it is the last remaining relay
(to prevent the user from having zero relays).

Changes to the relay list SHALL be persisted to `localStorage` immediately upon
modification.

The application SHALL use the persisted relay list (if present) instead of the
default relay list on subsequent page loads.

#### Scenario: Add a relay

- **WHEN** a user enters `wss://relay.example.com` in the relay input field and
  clicks "Add"
- **THEN** the relay SHALL appear in the relay list
- **THEN** the `RelayPool` SHALL connect to the new relay
- **THEN** the updated relay list SHALL be persisted to `localStorage`

#### Scenario: Add invalid relay URL

- **WHEN** a user enters `http://not-a-websocket.com` and clicks "Add"
- **THEN** the input SHALL display a validation error: "Relay URL must start
  with wss:// or ws://"
- **THEN** the relay SHALL NOT be added to the list

#### Scenario: Remove a relay

- **WHEN** a user clicks the remove button next to a relay in the list
- **THEN** the relay SHALL be removed from the list
- **THEN** the `RelayPool` SHALL disconnect from that relay
- **THEN** the updated relay list SHALL be persisted to `localStorage`

#### Scenario: Attempt to remove last relay

- **WHEN** a user attempts to remove the only remaining relay
- **THEN** a confirmation dialog SHALL appear warning "Removing all relays will
  prevent the app from loading data. Continue?"
- **THEN** the relay SHALL only be removed if the user confirms

#### Scenario: Duplicate relay prevention

- **WHEN** a user attempts to add a relay URL that already exists in the list
- **THEN** the input SHALL display a validation error: "This relay is already in
  your list"

### Requirement: Cashu Mint Selection

The settings page SHALL provide a mint selector that allows users to choose
their preferred Cashu mint URL.

The mint selector SHALL display the current mint URL (defaulting to
`PUBLIC_DEFAULT_MINT`).

The mint selector SHALL allow the user to enter a custom mint URL.

The selected mint SHALL be persisted to `localStorage` and used by the
`CashuMint`/`CashuWallet` singleton on subsequent page loads.

#### Scenario: Change preferred mint

- **WHEN** a user enters a new mint URL and confirms the selection
- **THEN** the preferred mint SHALL be updated in `localStorage`
- **THEN** a toast notification SHALL confirm "Preferred mint updated"
- **THEN** the new mint SHALL be used for subsequent pledge and solution fee
  operations

#### Scenario: Reset to default mint

- **WHEN** a user clicks "Reset to default"
- **THEN** the mint selection SHALL revert to the `PUBLIC_DEFAULT_MINT` value
- **THEN** the change SHALL be persisted to `localStorage`

### Requirement: Theme Toggle

The settings page SHALL provide a toggle to switch between Tokyo Night dark mode
(default) and Tokyo Night light mode.

The theme toggle SHALL apply the `.light` CSS class to the `<html>` element when
light mode is selected, and remove it for dark mode.

The selected theme SHALL be persisted to `localStorage` under the key
`tasks.fyi:theme`.

The theme SHALL be applied on page load before first paint by reading
`localStorage` in a synchronous `<script>` block in `app.html` to prevent flash
of incorrect theme (FOIT).

The theme toggle MUST respect the `prefers-color-scheme` media query as the
initial default if no persisted preference exists.

#### Scenario: Toggle to light mode

- **WHEN** a user toggles the theme switch to "Light"
- **THEN** the `.light` class SHALL be added to the `<html>` element
- **THEN** all Tokyo Night Day color tokens SHALL take effect immediately
- **THEN** the preference SHALL be persisted to `localStorage`

#### Scenario: Toggle to dark mode

- **WHEN** a user toggles the theme switch to "Dark"
- **THEN** the `.light` class SHALL be removed from the `<html>` element
- **THEN** all Tokyo Night Storm color tokens SHALL take effect immediately
- **THEN** the preference SHALL be persisted to `localStorage`

#### Scenario: Theme persistence across page loads

- **WHEN** a user has selected light mode and reloads the page
- **THEN** the page SHALL render in light mode without a flash of dark mode

#### Scenario: System preference fallback

- **WHEN** no theme preference is stored in `localStorage`
- **THEN** the application SHALL use `prefers-color-scheme: light` to determine
  if light mode should be applied
- **THEN** if the system preference is dark or not set, dark mode (default)
  SHALL be used

### Requirement: User Profile Store

The application SHALL provide a reactive user profile store at
`src/lib/stores/user-profile.svelte.ts` that manages the current authenticated
user's Kind 0 profile metadata.

The store SHALL subscribe to the `EventStore` for Kind 0 events matching the
current user's pubkey.

The store SHALL expose reactive properties: `name`, `displayName`, `picture`,
`nip05`, `about`, and `pubkey`.

The store SHALL update reactively when a new Kind 0 event is received for the
current user.

#### Scenario: User logs in

- **WHEN** a user authenticates via NIP-07 and their pubkey is set
- **THEN** the store SHALL subscribe to Kind 0 events for that pubkey
- **THEN** the store SHALL populate profile fields from the most recent Kind 0
  event content (JSON-parsed)

#### Scenario: No profile found

- **WHEN** no Kind 0 event exists for the current user's pubkey
- **THEN** the store SHALL expose `null` for `name`, `displayName`, `picture`,
  and `nip05`
- **THEN** the `pubkey` property SHALL still be set

### Requirement: localStorage Size Safety

The application SHALL NOT store more than 100KB of data in `localStorage` for
settings.

If a write to `localStorage` fails (e.g., quota exceeded), the application SHALL
display a toast warning and continue operating with in-memory settings only.

#### Scenario: localStorage quota exceeded

- **WHEN** a `localStorage.setItem()` call throws a `QuotaExceededError`
- **THEN** the application SHALL catch the error, display a toast "Settings
  could not be saved — storage full", and retain the settings in memory for the
  current session
