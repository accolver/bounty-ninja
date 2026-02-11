## Context

Phase 1 (Foundation) is complete. The application has a working SvelteKit 2
scaffold with Svelte 5 runes, connects to Nostr relays via Applesauce's
`RelayPool`, persists events to IndexedDB via `nostr-idb`, and supports NIP-07
authentication. The singleton `EventStore` and `RelayPool` are initialized in
the root layout. Tokyo Night theming and shadcn-svelte primitives are in place.

Phase 2 introduces all bounty-specific data models, domain logic, reactive
stores, and the complete read-only UI. After Phase 2, users can browse bounties,
view details with pledges/solutions/votes, and navigate profiles — but cannot
yet create, fund, or interact with bounties (write operations are deferred to
Phase 3).

## Goals

- Define TypeScript interfaces for all five bounty event kinds (37300, 73001,
  73002, 1018, 73004) plus aggregate types (`BountyDetail`, `BountySummary`)
- Implement pure-function tag parsing that extracts typed data from raw
  `NostrEvent` tags
- Implement the bounty lifecycle state machine that derives status from related
  events at read time
- Implement linear weighted voting calculation with quorum logic
- Build Nostr filter functions for all bounty-related queries
- Create Applesauce loader instances for each event kind
- Build class-based Svelte 5 rune stores that bridge RxJS Observables from
  `EventStore` to reactive UI state
- Build all read-only UI components: bounty cards, detail view, status badges,
  tags, timer, pledge/solution lists, vote progress
- Build shared display components: `SatAmount`, `TimeAgo`, `Markdown`
  (sanitized), `EmptyState`, `LoadingSpinner`
- Implement the home page with a bounty card grid sorted by total pledged sats
- Implement the bounty detail page with naddr NIP-19 routing
- Implement the profile page with npub NIP-19 routing
- Write unit tests for voting, state machine, helpers, and filters

## Non-Goals

- **Write operations** — creating bounties, pledging, submitting solutions,
  voting, and payout are all deferred to Phase 3
- **Cashu token handling** — mint interaction, P2PK locking/unlocking, escrow
  logic are Phase 3
- **Search** — NIP-50 search bar and search results page are Phase 4
- **Settings page** — relay management, mint selection, theme toggle are Phase 4
- **Event publishing** — `EventFactory`, blueprints, and the publish flow are
  Phase 3
- **Interactive components** — `BountyForm`, `PledgeForm`, `PledgeButton`,
  `SolutionForm`, `VoteButton` are Phase 3
- **Toast notifications** — `toast.svelte.ts` and `Toaster.svelte` are Phase 3
- **Error boundaries** — `ErrorBoundary.svelte` is Phase 3
- **E2E tests** — Playwright tests are Phase 4

## Decisions

### D1: Class-based stores bridging RxJS to Svelte 5 runes

Applesauce's `EventStore` exposes RxJS Observables (via `.timeline()`,
`.event()`, etc.). Svelte 5 uses runes (`$state`, `$derived`) for reactivity. We
bridge these with class-based `.svelte.ts` stores that subscribe to Observables
in the constructor and update `$state` fields on emission.

**Why class-based:** Classes provide encapsulation for private reactive state
(`#items = $state(...)`) and clean getter-based public APIs. They naturally
support the singleton pattern needed for global stores. The `.svelte.ts`
extension enables rune syntax in non-component files.

**Alternative considered:** Wrapping Observables in `$effect` inside components.
Rejected because it scatters subscription logic across components and makes
cleanup harder.

### D2: EventStore.timeline() for reactive bounty queries

The `BountyListStore` subscribes to
`eventStore.timeline({ kinds: [BOUNTY_KIND] })` which returns an Observable that
emits whenever the set of matching events changes. This provides automatic
reactivity — when new bounty events arrive from relays, the store updates
without manual polling.

For the `BountyDetailStore`, we use multiple timeline subscriptions (one per
related event kind, filtered by bounty address via `#a` tag) and compose them
into a single `BountyDetail` object.

### D3: Tag-based parsing from raw NostrEvent

All bounty data is extracted from raw `NostrEvent` tags using pure helper
functions (`parseBountySummary()`, `parsePledge()`, etc.). This keeps the domain
logic decoupled from Applesauce internals and makes it trivially testable.

**Tag extraction is defensive:** missing tags produce sensible defaults (empty
string, 0, null) rather than throwing. This is critical because Nostr events
from the wild may be malformed or use unexpected tag formats.

### D4: Status is derived, never stored

`BountyStatus` is computed by `deriveBountyStatus()` from the bounty event and
its related events (pledges, solutions, payouts, deletes). It is never stored as
a tag on the bounty event. This ensures the displayed status always reflects the
current state of the world, even if events arrive out of order.

The state machine evaluates in strict priority order: cancelled > completed >
expired > in_review > open > draft.

### D5: naddr/npub NIP-19 routing

Bounty detail pages use `/bounty/[naddr]` where `naddr` is a NIP-19 encoded
address containing kind, pubkey, d-tag, and optional relay hints. Profile pages
use `/profile/[npub]`. Both are decoded in `+page.ts` load functions using
`nip19.decode()` from `nostr-tools`.

**Why naddr:** NIP-33 parameterized replaceable events (Kind 37300) are
identified by the triple `(kind, pubkey, d-tag)`. The `naddr` encoding captures
all three plus relay hints, making bounty URLs self-contained and shareable.

### D6: Sanitized markdown rendering

Bounty descriptions and solution content are markdown. We render them via a
markdown parser and then sanitize the HTML output to strip `<script>` tags,
event handlers (`onerror`, `onclick`, etc.), `javascript:` URLs, and `<iframe>`
elements. The sanitized HTML is rendered using Svelte's `{@html}` directive.

**Library choice:** A lightweight markdown parser (e.g., `marked` or
`markdown-it`) combined with a sanitizer (e.g., `DOMPurify` or `sanitize-html`).
The exact libraries are an implementation detail — the requirement is that XSS
vectors are eliminated.

### D7: Linear voting for Sybil resistance

Vote weight = `pledgeAmountInSats` (1 sat pledged = 1 unit of vote weight). This
was chosen over square-root weighting because sub-linear functions (like √x) are
vulnerable to Sybil attacks: an attacker can multiply their voting power by
splitting the same capital across many pseudonymous Nostr identities (since
`√a + √b > √(a+b)`). With linear weighting, splitting provides zero mathematical
advantage — total weight is identical regardless of how many identities the
funds are spread across. The pledge itself (locking real Cashu tokens) serves as
proof of stake.

Quorum is `totalPledgedSats * 0.5`, meaning the majority of pledged capital must
agree for a decision to be binding.

## Risks and Trade-offs

### R1: Applesauce API specifics

**Risk:** Applesauce v5 is actively developed. The exact API for
`EventStore.timeline()`, subscription patterns, and event filtering may differ
from what's documented or assumed in this design.

**Mitigation:** The store layer (`bounties.svelte.ts`,
`bounty-detail.svelte.ts`) acts as an adapter between Applesauce and the UI. If
the Applesauce API changes, only the store constructors need updating —
components consume stable getter interfaces.

### R2: Tag format assumptions

**Risk:** Nostr events from the wild may use unexpected tag formats. For
example, the `reward` tag might be `["reward", "50000"]` (2 elements) instead of
`["reward", "50000", "sat"]` (3 elements). Other clients may use different tag
names for the same concept.

**Mitigation:** Tag parsing helpers are defensive — they handle missing
elements, non-numeric values, and absent tags gracefully. The `client` tag
(`["client", "tasks.fyi"]`) can be used to filter for events created by our app,
but we display all valid bounty events regardless of origin.

### R3: Markdown XSS

**Risk:** User-supplied markdown content could contain XSS payloads if not
properly sanitized. The `{@html}` directive in Svelte renders raw HTML,
bypassing Svelte's built-in escaping.

**Mitigation:** All markdown is rendered through a sanitization pipeline that
strips dangerous elements and attributes. This is a hard requirement — the
`Markdown` component MUST sanitize before rendering. Unit tests with known XSS
payloads validate the sanitization.

### R4: Large event volumes

**Risk:** Popular bounties could accumulate hundreds of pledges, solutions, and
votes. Loading all related events on the detail page could be slow.

**Mitigation:** Applesauce loaders support pagination via the `limit` filter
parameter. For Phase 2 (read-only), we load all events without pagination. If
performance becomes an issue, pagination can be added to the loaders without
changing the store or component interfaces.

### R5: Stale derived status

**Risk:** If related events (pledges, solutions) arrive after the bounty event,
the derived status may briefly show an incorrect state (e.g., "draft" when
pledges exist but haven't been fetched yet).

**Mitigation:** The `BountyDetailStore` re-derives status whenever any related
event subscription emits. The `BountyListStore` shows `totalPledged: 0` and
`status: "draft"` until pledge events are correlated. This is acceptable for
Phase 2 — the status self-corrects as events arrive. A brief loading state
covers the initial fetch window.

### R6: NIP-19 encoding/decoding edge cases

**Risk:** Malformed or unsupported NIP-19 strings in URLs could crash the load
function.

**Mitigation:** Load functions wrap `nip19.decode()` in try/catch and throw
appropriate SvelteKit errors (400 for wrong type, 404 for decode failure). The
UI never receives invalid data.
