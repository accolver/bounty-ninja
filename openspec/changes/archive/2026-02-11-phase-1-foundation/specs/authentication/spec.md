## ADDED Requirements

### Requirement: NIP-07 Signer Detection

`src/lib/nostr/signer.svelte.ts` MUST implement reactive NIP-07 browser
extension signer detection using Svelte 5 runes. The module MUST export a
class-based reactive store that tracks whether a NIP-07 signer (`window.nostr`)
is available. Detection MUST occur on module initialization and MUST handle the
case where the extension loads asynchronously after the page.

#### Scenario: Signer detected when extension is present

- **WHEN** the application loads in a browser with a NIP-07 extension installed
  (e.g., nos2x, Alby)
- **THEN** `window.nostr` is detected as available
- **AND** the signer state reflects that a signer is available

#### Scenario: Signer not detected when no extension

- **WHEN** the application loads in a browser without a NIP-07 extension
- **THEN** the signer state reflects that no signer is available
- **AND** all write actions are disabled in the UI

#### Scenario: Late-loading extension is detected

- **WHEN** the application loads before the NIP-07 extension injects
  `window.nostr`
- **THEN** the signer module retries detection (e.g., polling or listening for
  `window.nostr` to appear)
- **AND** the signer state updates reactively when the extension becomes
  available

### Requirement: Reactive Account State

`src/lib/nostr/account.svelte.ts` MUST implement reactive account state using
Svelte 5 runes (`$state`, `$derived`). The module MUST export a class-based
store that tracks the current user's public key (hex format) and derived
properties such as the npub (NIP-19 encoded) representation. The store MUST NOT
use legacy Svelte stores (`writable`, `readable`, `derived` from `svelte/store`)
or legacy reactive syntax (`$:`).

#### Scenario: Account state is reactive

- **WHEN** the user logs in and the pubkey is set
- **THEN** all components consuming the account state re-render with the new
  pubkey
- **AND** the derived `npub` property updates automatically

#### Scenario: Account state starts as logged out

- **WHEN** the application loads without a prior session
- **THEN** the account state indicates no user is logged in (pubkey is `null`)

### Requirement: Login Flow

The login flow MUST call `window.nostr.getPublicKey()` via the NIP-07 signer to
obtain the user's public key. On successful login, the pubkey MUST be stored in
the reactive account state. The pubkey MAY be persisted to `localStorage` for
session persistence across page reloads. The application MUST NOT request,
handle, or store the user's private key at any point.

#### Scenario: Successful login via NIP-07

- **WHEN** the user clicks the Login button
- **AND** a NIP-07 extension is available
- **THEN** `window.nostr.getPublicKey()` is called
- **AND** the returned hex pubkey is stored in the account state
- **AND** the UI updates to show the user's npub

#### Scenario: Login persists across page reload

- **WHEN** the user has logged in and the pubkey is stored in `localStorage`
- **AND** the page is reloaded
- **THEN** the account state is restored from `localStorage`
- **AND** the user appears logged in without re-triggering NIP-07

#### Scenario: Private key is never accessed

- **WHEN** any login or authentication operation occurs
- **THEN** the application never calls `window.nostr.getPrivateKey()` or any
  equivalent
- **AND** no private key material is stored in memory, localStorage, or
  IndexedDB

### Requirement: Logout Flow

The application MUST provide a logout mechanism that clears the pubkey from the
reactive account state and removes any persisted session data from
`localStorage`. After logout, the UI MUST revert to the logged-out state.

#### Scenario: Successful logout

- **WHEN** the user triggers logout
- **THEN** the account state pubkey is set to `null`
- **AND** any `localStorage` session data is cleared
- **AND** the UI reverts to showing the Login button

### Requirement: Login Error Handling

The login flow MUST handle NIP-07 errors gracefully, including user rejection of
the signing request, extension timeout, and malformed responses.

#### Scenario: User rejects NIP-07 prompt

- **WHEN** the user clicks Login
- **AND** the NIP-07 extension prompts for permission
- **AND** the user rejects the prompt
- **THEN** the application catches the rejection error
- **AND** the account state remains logged out
- **AND** a user-friendly message is displayed (e.g., "Login cancelled")

#### Scenario: NIP-07 extension times out

- **WHEN** the user clicks Login
- **AND** the NIP-07 extension does not respond within 30 seconds
- **THEN** the login attempt is aborted with a timeout error
- **AND** a message is displayed: "Signer timed out. Please try again."

#### Scenario: No NIP-07 extension available

- **WHEN** the user clicks Login
- **AND** no NIP-07 extension is detected
- **THEN** a prompt is displayed suggesting the user install a Nostr signer
  extension
- **AND** links to nos2x and Alby are provided

### Requirement: LoginButton Component

`src/lib/components/auth/LoginButton.svelte` MUST render a button that triggers
the NIP-07 login flow when clicked. When the user is logged out, it MUST display
"Login" or "Sign in". When the user is logged in, this component is not rendered
(replaced by profile display in the Header). The button MUST be keyboard
accessible and MUST have an appropriate `aria-label`.

#### Scenario: Login button triggers NIP-07 flow

- **WHEN** the Login button is clicked
- **THEN** the NIP-07 `getPublicKey()` flow is initiated

#### Scenario: Login button is accessible

- **WHEN** the Login button is rendered
- **THEN** it is focusable via keyboard Tab navigation
- **AND** it is activatable via Enter or Space key
- **AND** it has an `aria-label` describing its purpose
