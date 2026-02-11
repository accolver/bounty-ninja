## Context

Phases 1–3 of Tasks.fyi established the project foundation (Nostr connectivity,
Applesauce EventStore, Tokyo Night theming), built the read-only bounty display
layer (data models, reactive stores, bounty cards, detail pages), and
implemented all write operations (bounty creation, Cashu pledging with P2PK
escrow, solution submission, linear weighted voting, and payout). The core
bounty lifecycle is functional end-to-end.

Phase 4 addresses the gap between "functional" and "usable." Users currently
have no way to search or discover bounties beyond scrolling the home page list.
There is no settings page for customizing relays, mints, or themes. The layout
is not optimized for mobile devices. There are no E2E tests validating the full
user journey, and the app lacks branding assets for social sharing. This phase
delivers the discovery, personalization, responsive design, and test coverage
needed to make the app production-ready.

## Goals

- **Search & Discovery**: Enable users to find bounties via NIP-50 full-text
  search on a dedicated search relay, with client-side fallback filtering when
  the relay is unavailable. Provide category/tag filtering on the home page and
  a dedicated search results page at `/search`.
- **User Settings**: Allow users to manage their relay list (add/remove relays),
  select a preferred Cashu mint, and toggle between Tokyo Night dark and light
  themes — all persisted to localStorage.
- **Responsive Layout**: Deliver a mobile-first responsive design with a bottom
  navigation bar on mobile, a category sidebar on desktop, and a responsive
  Header with adaptive search bar behavior.
- **Branding & Meta**: Add Open Graph and Twitter Card meta tags, favicon, logo
  SVG, and OG image so that shared links render rich previews on social
  platforms.
- **E2E Test Coverage**: Establish a Playwright E2E test suite using a local
  Nostr relay (`nak serve`), mock NIP-07 signer, and mock Cashu mint to validate
  the full bounty lifecycle, search flow, and authentication flow.

## Non-Goals

- **DVM / ContextVM integration**: AI solver support and NIP-90 Data Vending
  Machine integration are deferred to Phase 6.
- **Multi-mint Cashu support**: The MVP uses a single configured mint per user.
  Cross-mint swaps and multi-mint pledge aggregation are out of scope.
- **Internationalization (i18n)**: The app is English-only for MVP. Localization
  infrastructure is deferred.
- **NIP-60 wallet UI**: A full in-app Cashu wallet management interface is out
  of scope. Users manage tokens externally.
- **Relay list discovery (NIP-65)**: Automatic relay list fetching from the
  user's Kind 10002 events is deferred. Users manually configure relays in
  settings.
- **Notification system**: NIP-04 DM-based notifications for bounty updates are
  deferred.
- **Advanced search features**: Faceted search, saved searches, search history,
  and search suggestions are out of scope for this phase.

## Decisions

### Decision: NIP-50 search with client-side fallback

**Choice**: Issue NIP-50 search queries to a dedicated search relay
(`PUBLIC_SEARCH_RELAY`, default `wss://relay.nostr.band`), falling back to
client-side substring matching against cached EventStore events when the relay
is unavailable.

**Rationale**: NIP-50 provides relay-side full-text search which is far more
capable than client-side filtering (it can search across all events the relay
has indexed, not just those cached locally). However, NIP-50 support is not
universal — only certain relays implement it. Using a dedicated search relay
isolates search traffic from the user's general relay list. The client-side
fallback ensures search remains functional even when the search relay is down,
albeit with reduced scope (only locally cached events).

**Alternatives considered**:

- _Client-side only search_: Rejected because it can only search events already
  fetched and cached, missing the vast majority of bounties on the network.
- _DVM-based search (NIP-90)_: Rejected as overly complex for MVP and introduces
  additional trust dependencies.
- _Multiple search relays_: Rejected for MVP simplicity. Can be added later by
  querying multiple NIP-50 relays and deduplicating results.

### Decision: localStorage for user preferences

**Choice**: Persist user settings (relay list, preferred mint, theme) to
`localStorage` as a JSON object under the key `tasks.fyi:settings`. Theme
preference stored separately under `tasks.fyi:theme` for synchronous access in
`app.html`.

**Rationale**: localStorage is synchronous, universally available in browsers,
and requires no additional dependencies. For the small amount of settings data
(relay URLs, a mint URL, a theme string), localStorage is the simplest and most
appropriate storage mechanism. The theme key is stored separately so it can be
read synchronously in a `<script>` block in `app.html` to prevent flash of
incorrect theme on page load.

**Alternatives considered**:

- _IndexedDB_: Rejected because settings data is small and simple (no need for
  structured queries), and IndexedDB is asynchronous which complicates theme
  initialization.
- _Nostr events (Kind 30078 app-specific data)_: Rejected for MVP because it
  requires authentication to read settings, adds relay dependency for basic
  preferences, and introduces latency on app load.
- _Cookies_: Rejected because the app has no server-side component and cookies
  add unnecessary complexity.

### Decision: Tailwind CSS responsive breakpoints for layout

**Choice**: Use Tailwind CSS's built-in responsive breakpoints (`sm: 640px`,
`lg: 1024px`) with a mobile-first approach. Conditionally render `MobileNav`
(below `sm`), `Sidebar` (at `lg` and above), and adapt `Header` layout at each
breakpoint.

**Rationale**: Tailwind's responsive utilities are already in the stack and
provide a consistent, well-documented approach to responsive design.
Mobile-first ensures the most constrained viewport is the default, with
progressive enhancement for larger screens. The `sm`/`lg` breakpoints align with
common device categories (phone / tablet / desktop) without over-engineering for
every possible viewport.

**Alternatives considered**:

- _Container queries_: Rejected because browser support is still maturing and
  Tailwind's responsive utilities are sufficient for the layout needs.
- _JavaScript-based breakpoint detection_: Rejected because CSS media queries
  are more performant and don't cause layout shifts.
- _Single responsive layout without Sidebar/MobileNav_: Rejected because the
  desktop sidebar provides valuable category navigation and the mobile bottom
  nav is a standard mobile UX pattern that improves discoverability.

### Decision: Playwright with local nak relay for E2E

**Choice**: Use Playwright for E2E tests with a local Nostr relay started via
`nak serve`, a mock NIP-07 signer injected via `page.addInitScript()`, and a
mock Cashu mint via route interception or a lightweight test server.

**Rationale**: Playwright provides cross-browser testing, excellent async
handling, and built-in support for script injection and network interception —
all essential for testing a Nostr + Cashu application. The `nak serve` command
(installed via mise) provides a lightweight, in-memory Nostr relay that requires
no Docker or external dependencies, making it ideal for CI environments. Mock
NIP-07 via `addInitScript()` is the standard approach for testing browser
extension-dependent flows. Mock Cashu mint via route interception avoids the
need for a real mint in tests.

**Alternatives considered**:

- _Real public relays for E2E_: Rejected because tests would be
  non-deterministic, slow, and could pollute public relays with test data.
- _Docker-based relay (e.g., strfry)_: Rejected because `nak serve` is simpler,
  faster to start, and already available via mise tooling.
- _Cypress_: Rejected because Playwright has better support for modern web APIs,
  cross-browser testing, and the `addInitScript()` pattern needed for NIP-07
  mocking.

## Risks / Trade-offs

### Risk: NIP-50 search relay availability

**Severity**: Medium

**Description**: The default search relay (`wss://relay.nostr.band`) may
experience downtime, rate-limit requests, or change its NIP-50 support. If the
search relay is unavailable, search degrades to client-side filtering which only
covers locally cached events — a significantly reduced search scope.

**Mitigation**: The client-side fallback ensures search never completely breaks.
The search relay URL is configurable via environment variable, allowing
operators to point to alternative NIP-50 relays. A future enhancement could
query multiple search relays in parallel. The UI clearly indicates when
operating in fallback mode.

### Risk: localStorage size limits and data loss

**Severity**: Low

**Description**: localStorage has a ~5MB limit per origin in most browsers.
While settings data is small (well under 1KB), a bug or future feature could
inadvertently store large amounts of data. Additionally, users can clear
localStorage at any time, losing their settings.

**Mitigation**: The application enforces a 100KB soft limit on settings data and
gracefully handles `QuotaExceededError`. Settings are non-critical — the app
falls back to defaults if localStorage is empty or cleared. A future enhancement
could back up settings to a Nostr event (Kind 30078).

### Risk: Mobile performance with large bounty lists

**Severity**: Medium

**Description**: Rendering a large number of bounty cards on mobile devices with
limited CPU and memory could cause jank, especially when combined with real-time
relay subscriptions updating the list. The MobileNav and search overlay add
additional DOM elements.

**Mitigation**: The bounty list filter defaults to `limit: 50` events, capping
the initial render. Svelte 5's fine-grained reactivity minimizes unnecessary
re-renders. Virtual scrolling can be added as a future optimization if
performance degrades. The `prefers-reduced-motion` media query disables
animations on devices that request it.

### Risk: Theme flash on page load

**Severity**: Low

**Description**: If the theme preference is read asynchronously (e.g., in a
Svelte component's `$effect`), there may be a brief flash of the wrong theme on
page load before the correct theme class is applied.

**Mitigation**: The theme preference is read synchronously from localStorage in
a `<script>` block in `app.html`, before any framework JavaScript executes. This
ensures the correct theme class is applied to `<html>` before first paint.

### Risk: E2E test flakiness with relay timing

**Severity**: Medium

**Description**: E2E tests depend on events being published to and received from
the local relay within expected timeframes. Network timing, relay processing
delays, or race conditions between event publishing and subscription could cause
intermittent test failures.

**Mitigation**: Tests use explicit `waitFor` assertions with reasonable timeouts
(up to 10 seconds for relay round-trips). The local `nak serve` relay is
in-memory and extremely fast, minimizing timing issues. Playwright's
auto-waiting for DOM elements reduces race conditions. Tests are configured with
1 retry in CI to handle rare flakes.

### Risk: Mock Cashu mint fidelity

**Severity**: Low

**Description**: The mock Cashu mint may not perfectly replicate real mint
behavior, potentially masking bugs in token creation, P2PK locking, or swap
operations that would only surface with a real mint.

**Mitigation**: Unit and integration tests for Cashu operations (in Phase 3)
test against the real `@cashu/cashu-ts` library logic. E2E tests focus on the UI
flow and event publishing, not Cashu protocol correctness. Manual testing
against a real testnet mint is recommended before production deployment (Phase
5).
