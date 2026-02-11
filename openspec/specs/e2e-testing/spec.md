## ADDED Requirements

### Requirement: Playwright Configuration

The application SHALL provide a Playwright configuration file at
`playwright.config.ts` that configures E2E testing for the SvelteKit static SPA.

The configuration SHALL:

- Set the base URL to `http://localhost:4173` (SvelteKit preview server)
- Configure a `webServer` block that runs `bun run build && bun run preview`
  before tests
- Set a global timeout of 30 seconds per test
- Configure screenshot capture on failure
- Use Chromium as the primary browser, with optional Firefox and WebKit projects
- Set `retries: 1` in CI environments (detected via `process.env.CI`)

The configuration SHALL define a `setup` project that starts a local Nostr relay
(`nak serve`) and seeds it with test fixture events before the test suite runs.

#### Scenario: Playwright test execution

- **WHEN** a developer runs `bun run test:e2e`
- **THEN** Playwright SHALL build the app, start the preview server, start a
  local relay, seed test data, and execute all E2E tests
- **THEN** test results SHALL be reported to the console with pass/fail status

#### Scenario: CI environment

- **WHEN** E2E tests run in a CI environment where `CI=true`
- **THEN** Playwright SHALL retry failed tests once before marking them as
  failed
- **THEN** screenshots SHALL be captured for all failures

### Requirement: Mock NIP-07 Signer

All E2E tests that require authentication SHALL inject a mock NIP-07 signer
using Playwright's `page.addInitScript()`.

The mock signer SHALL implement the `window.nostr` interface with:

- `getPublicKey()`: Returns a deterministic test pubkey
- `signEvent(event)`: Signs the event with a deterministic test private key
  using `nostr-tools` signing utilities
- `nip04.encrypt()` / `nip04.decrypt()`: Stub implementations that return the
  input (not used in MVP but required for interface completeness)

The test private key SHALL be a fixed, well-known key used only for testing
(never for real funds).

#### Scenario: Mock signer injection

- **WHEN** an E2E test page loads with the mock NIP-07 signer injected
- **THEN** `window.nostr` SHALL be available
- **THEN** `window.nostr.getPublicKey()` SHALL return the test pubkey
- **THEN** the application SHALL detect the signer and enable authenticated
  features

### Requirement: Mock Cashu Mint

E2E tests involving Cashu operations (pledging, solution submission fees) SHALL
use a mock Cashu mint.

The mock mint SHALL be implemented as either:

- A lightweight HTTP server started by Playwright's `globalSetup` that responds
  to Cashu mint API endpoints with valid but test-only token responses, OR
- Intercepted network requests via Playwright's `page.route()` that return mock
  responses for mint API calls

The mock mint SHALL support the following operations: mint info, mint tokens,
swap tokens, and verify tokens.

Mock Cashu tokens SHALL be structurally valid but use test-only keyset IDs to
prevent accidental use on real mints.

#### Scenario: Mock mint for pledge flow

- **WHEN** an E2E test creates a pledge with Cashu tokens
- **THEN** the mock mint SHALL respond to token creation requests with valid
  test tokens
- **THEN** the pledge event SHALL contain a structurally valid `cashu` tag

### Requirement: Local Nostr Relay for E2E

E2E tests SHALL use a local Nostr relay started via `nak serve` (installed via
mise) for isolated, reproducible testing.

The local relay SHALL run at `ws://localhost:10547` (the default `nak serve`
port).

The relay SHALL be started before the test suite and stopped after all tests
complete.

Test fixture events (sample bounties, pledges, solutions) SHALL be seeded to the
local relay before tests run using `nak event` CLI commands or direct WebSocket
publishing.

The application under test SHALL be configured to connect to the local relay
instead of public relays (via environment variable override or test-specific
configuration).

#### Scenario: Isolated test environment

- **WHEN** E2E tests execute
- **THEN** all Nostr events SHALL be read from and written to the local relay
  only
- **THEN** no requests SHALL be made to public Nostr relays
- **THEN** each test run SHALL start with a clean relay state (relay restarted
  or events cleared)

### Requirement: Bounty Lifecycle E2E Test

The application SHALL include an E2E test at
`src/tests/e2e/bounty-lifecycle.spec.ts` that validates the full bounty
lifecycle: create → fund → submit solution → vote → payout.

The test SHALL:

1. Navigate to `/bounty/new` and fill in the bounty creation form (title,
   description, reward, tags, fee)
2. Submit the form and verify the bounty appears on the home page
3. Navigate to the bounty detail page and verify all fields are displayed
   correctly
4. Fund the bounty by creating a pledge (using mock Cashu tokens)
5. Verify the bounty status transitions from "draft" to "open"
6. Submit a solution with an anti-spam fee
7. Verify the bounty status transitions to "in_review"
8. Cast an approval vote on the solution
9. Verify the vote tally updates
10. Trigger payout and verify the bounty status transitions to "completed"

#### Scenario: Full lifecycle passes

- **WHEN** the bounty lifecycle E2E test executes against the local relay with
  mock NIP-07 and mock Cashu mint
- **THEN** all steps SHALL complete without errors
- **THEN** the final bounty status SHALL be "completed"

#### Scenario: Bounty creation form validation

- **WHEN** the test submits the bounty form with an empty title
- **THEN** the form SHALL display a validation error and NOT publish an event

### Requirement: Search Flow E2E Test

The application SHALL include an E2E test at `src/tests/e2e/search.spec.ts` that
validates the search and discovery flow.

The test SHALL:

1. Seed the local relay with multiple bounties with distinct titles and tags
2. Navigate to the home page and verify bounties are displayed
3. Type a search query into the hero SearchBar
4. Press Enter and verify navigation to `/search?q=<query>`
5. Verify that search results display matching bounties
6. Apply a status filter and verify results update
7. Click a category tab on the home page and verify filtering works
8. Verify the empty state is shown for a query with no matches

#### Scenario: Search returns results

- **WHEN** the test searches for a term that matches seeded bounty titles
- **THEN** the search results page SHALL display the matching bounties
- **THEN** non-matching bounties SHALL NOT appear in the results

#### Scenario: Search empty state

- **WHEN** the test searches for "xyznonexistent123"
- **THEN** the search results page SHALL display the empty state message

### Requirement: Authentication E2E Test

The application SHALL include an E2E test at `src/tests/e2e/auth.spec.ts` that
validates the NIP-07 authentication flow.

The test SHALL:

1. Load the home page without the mock NIP-07 signer and verify the "Login"
   button is displayed
2. Verify that write actions (create bounty, pledge, submit solution, vote) are
   disabled or prompt for login
3. Inject the mock NIP-07 signer and click "Login"
4. Verify the user's profile information (npub or display name) appears in the
   Header
5. Verify that write actions become available
6. Navigate to `/settings` and verify the settings page loads with user-specific
   content
7. Log out and verify the UI returns to the unauthenticated state

#### Scenario: Login flow

- **WHEN** the test clicks "Login" with the mock NIP-07 signer available
- **THEN** the Header SHALL display the test user's profile information
- **THEN** the "Login" button SHALL be replaced by the profile menu

#### Scenario: Unauthenticated restrictions

- **WHEN** the test attempts to navigate to `/bounty/new` without authentication
- **THEN** the page SHALL display a login prompt instead of the bounty creation
  form

### Requirement: Accessibility E2E Checks

All E2E tests SHALL include basic accessibility assertions:

- Verify that all pages have a `<main>` landmark
- Verify that all images have `alt` attributes
- Verify that all form inputs have associated labels
- Verify that focus is managed correctly after navigation (focus moves to main
  content area)
- Verify that the skip-to-content link is present and functional

#### Scenario: Accessibility landmarks

- **WHEN** any page loads in an E2E test
- **THEN** the page SHALL contain exactly one `<main>` element
- **THEN** the page SHALL contain a `<nav>` element for navigation
- **THEN** all interactive elements SHALL be reachable via keyboard Tab
  navigation

### Requirement: Lighthouse CI Targets

The E2E test suite SHOULD include a Lighthouse CI check (via `@lhci/cli` or
Playwright's built-in Lighthouse integration) that validates:

- Performance score > 90
- Accessibility score > 90
- Best Practices score > 90

If Lighthouse CI integration is not feasible in the initial implementation, the
targets SHALL be documented as manual verification steps in the test README.

#### Scenario: Lighthouse audit passes

- **WHEN** a Lighthouse audit runs against the built application
- **THEN** the Performance score SHALL be greater than 90
- **THEN** the Accessibility score SHALL be greater than 90
- **THEN** the Best Practices score SHALL be greater than 90
