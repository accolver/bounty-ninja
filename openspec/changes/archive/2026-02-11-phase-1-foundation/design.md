## Context

Tasks.fyi is a greenfield project — no application code exists yet. The goal is
to build a decentralized, censorship-resistant task board powered by Nostr
(for event storage and identity) and Cashu ecash (for trustless payments). The
application is a client-side-only static SPA with zero backend infrastructure:
all state is derived from Nostr relay subscriptions and cached locally in
IndexedDB.

Phase 1 (Foundation) establishes the project skeleton and proves that the core
integration works: SvelteKit 2 serving a static SPA, Applesauce libraries
connecting to Nostr relays, events flowing into a reactive store, NIP-07
authentication via browser extensions, and the Tokyo Night visual theme applied
globally. No task-specific business logic is implemented in this phase — the
focus is entirely on infrastructure, connectivity, and the layout shell.

The technology stack is prescribed by the PRD and is non-negotiable: SvelteKit 2
with Svelte 5 runes for the framework, Applesauce libraries (not NDK) for Nostr
protocol interaction, nostr-idb for IndexedDB caching, Tailwind CSS 4 with the
`@theme` directive for styling, shadcn-svelte (next) for accessible UI
primitives, and Bun as the sole package manager and runtime.

## Goals / Non-Goals

### Goals

- **Initialize a fully configured SvelteKit 2 project** with TypeScript strict
  mode, static adapter, Vite 6, and all production/dev dependencies installed
  via Bun
- **Establish Nostr relay connectivity** using Applesauce's `EventStore` and
  `RelayPool` as singletons, with events flowing from relays into the in-memory
  store
- **Persist events to IndexedDB** via nostr-idb so that cached data survives
  page reloads
- **Implement NIP-07 authentication** with reactive account state using Svelte 5
  runes — login, logout, session persistence, and error handling
- **Apply the Tokyo Night theme** using Tailwind CSS 4 `@theme` semantic color
  tokens with dark mode as default and light mode via `.light` class
- **Initialize shadcn-svelte** with Button, Card, Badge, Input, and Dialog base
  components
- **Build the root layout shell** with Header (logo + login), Footer (relay
  status), and responsive structure
- **Display a proof-of-concept home page** showing raw events from connected
  relays to verify end-to-end data flow
- **Define event kind constants** (37300, 73001, 73002, 1018, 73004) and utility
  modules (constants, env, format) for use in later phases
- **Configure tooling** via mise.toml for reproducible tool versions and task
  running

### Non-Goals

- **Task data models and types** — `Task`, `Pledge`, `Solution`, `Vote`,
  `Payout` interfaces are Phase 2
- **Task-specific Nostr filters** — filter builders for Kind
  37300/73001/73002/1018/73004 are Phase 2
- **Reactive task stores** — `TaskListStore`, `TaskDetailStore` bridging
  EventStore to runes are Phase 2
- **Task UI components** — `TaskCard`, `TaskDetail`, `TaskStatusBadge`,
  etc. are Phase 2
- **Write operations** — creating tasks, pledging, submitting solutions,
  voting, and payouts are Phase 3
- **Cashu integration** — mint connection, token creation, P2PK locking are
  Phase 3
- **Search and discovery** — NIP-50 search, category filtering are Phase 4
- **Settings page** — relay management, mint selection, theme toggle are Phase 4
- **Security hardening** — event signature validation, markdown sanitization,
  bundle optimization are Phase 5
- **DVM/ContextVM integration** — AI solver support is post-MVP (Phase 6)

## Decisions

### Singleton Pattern for Core Services

The `EventStore` (from `applesauce-core`) and `RelayPool` (from
`applesauce-relay`) are instantiated as module-level singletons in
`src/lib/nostr/event-store.ts` and `src/lib/nostr/relay-pool.ts` respectively.
This ensures a single source of truth for all Nostr events and relay connections
across the entire application. Every component and store imports the same
instance.

**Rationale:** Applesauce's architecture is designed around a single EventStore
that accumulates events from all sources. Multiple EventStore instances would
fragment the event graph and break cross-referencing (e.g., looking up a
task's pledges). The singleton pattern is the simplest way to guarantee this
in a client-side SPA where there is exactly one user session.

### Svelte 5 Runes for All Reactive State

All reactive state uses Svelte 5 runes exclusively: `$state` for mutable state,
`$derived` for computed values, `$effect` for side effects, and `$props` for
component inputs. Class-based `.svelte.ts` modules bridge RxJS Observables (from
Applesauce) to runes by subscribing to Observables in the constructor and
writing to `$state` fields.

**Rationale:** Svelte 5 runes provide fine-grained reactivity that is more
predictable and performant than Svelte 3/4 stores. The class-based pattern keeps
reactive state co-located with its subscription logic and avoids the pitfalls of
mixing paradigms. Legacy stores (`writable`, `readable`) and reactive
declarations (`$:`) are explicitly prohibited to maintain a single reactivity
model.

### nostr-idb for IndexedDB Caching

Events received from relays are persisted to IndexedDB via `nostr-idb`. On
application startup, cached events are loaded into the EventStore before new
relay subscriptions begin. This provides instant UI rendering from cache while
fresh data loads in the background.

**Rationale:** Nostr relays are the source of truth, but relay round-trips add
latency. IndexedDB caching gives the application offline resilience and faster
subsequent loads. `nostr-idb` is purpose-built for Nostr events with indexed
queries by kind, pubkey, and tags — it is the natural complement to Applesauce's
EventStore.

### Tailwind CSS 4 @theme for Tokyo Night Tokens

Semantic color tokens are defined using Tailwind CSS 4's `@theme` directive in
`src/app.css`. Dark mode (Tokyo Night Storm) is the default; light mode (Tokyo
Night Day) is activated by adding a `.light` class to the root element. Tokens
follow the shadcn-svelte naming convention (`--color-primary`,
`--color-background`, etc.) so that shadcn components consume them
automatically.

**Rationale:** Tailwind CSS 4's `@theme` directive replaces the older
`tailwind.config.ts` theme extension approach with a CSS-native solution. This
keeps all theme tokens in a single CSS file, makes them available to both
Tailwind utilities and raw CSS, and aligns with shadcn-svelte's expected token
structure. The `.light` class approach (rather than `prefers-color-scheme` media
query) gives users explicit control via a future settings toggle.

### Applesauce RxJS-to-Runes Bridge Pattern

Applesauce emits events via RxJS Observables. These are bridged to Svelte 5
runes in class-based stores: the class constructor subscribes to the Observable
and writes incoming data to `$state` fields. Components read these fields
reactively. Subscription cleanup happens in the class destructor or via
`$effect` teardown.

**Rationale:** Applesauce is built on RxJS and its API returns Observables.
Svelte 5 components cannot directly consume Observables. The bridge pattern is a
thin adapter layer that preserves Applesauce's streaming semantics while
exposing data through Svelte's native reactivity. This avoids pulling in
additional libraries (like svelte-rxjs adapters) and keeps the integration
explicit.

### NIP-07 Only Authentication (No Private Key Handling)

Authentication uses exclusively NIP-07 browser extension signing. The
application calls `window.nostr.getPublicKey()` for login and
`window.nostr.signEvent()` for event signing (in later phases). The app never
asks for, stores, or transmits private keys. Session persistence stores only the
hex pubkey in `localStorage`.

**Rationale:** Private key handling in a web application is a security
liability. NIP-07 delegates all cryptographic operations to a trusted browser
extension (nos2x, Alby, etc.) that the user controls. This is the standard
approach for Nostr web clients and aligns with the project's privacy-first
principles. The trade-off is that users must install an extension, but this is
acceptable for the target audience of Nostr-native users.

### Static SPA with No Server-Side Logic

The application is built as a static SPA using `@sveltejs/adapter-static` with
`ssr: false`, `prerender: false`, and `fallback: "index.html"`. There are no
server routes, API endpoints, or server-side rendering. All data comes from
client-side Nostr relay WebSocket connections.

**Rationale:** A static SPA can be deployed to any CDN (Cloudflare Pages,
Vercel, GitHub Pages) with zero server infrastructure. This aligns with the
decentralized ethos — the application itself has no backend that could be
censored or taken down. The trade-off is no SSR for SEO, but the target audience
discovers tasks through Nostr clients, not search engines.

### Vite optimizeDeps Exclusions for Noble Libraries

`@noble/curves` and `@noble/hashes` are excluded from Vite's dependency
optimization. These libraries use WASM and have specific module resolution
requirements that conflict with Vite's pre-bundling.

**Rationale:** Both `nostr-tools` and `@cashu/cashu-ts` depend on `@noble/*`
libraries for cryptographic operations. Vite's `optimizeDeps` pre-bundling can
break these libraries' WASM loading. Excluding them ensures they are loaded
as-is, preserving their internal module resolution.

## Risks / Trade-offs

### Applesauce API Stability (Medium Risk)

Applesauce is actively developed and recently released v5 with significant API
changes. The API surface may continue to evolve, potentially requiring migration
effort in future phases.

**Mitigation:** Pin Applesauce package versions in `package.json`. Wrap
Applesauce calls in thin adapter modules (`event-store.ts`, `relay-pool.ts`) so
that API changes are isolated to a few files rather than spread across the
codebase. Monitor the Applesauce changelog and GitHub releases.

### Relay Connectivity and Availability (Medium Risk)

The application depends entirely on public Nostr relays for data. Relays can be
unreachable, rate-limit connections, refuse to store custom event kinds, or go
offline permanently. The default relay list may not be optimal for all users.

**Mitigation:** Connect to multiple relays (4 defaults) so that the application
functions if some are unavailable. Use IndexedDB caching so that previously
loaded data is available even when relays are unreachable. The `RelayStatus`
component gives users visibility into connection health. Future phases will add
user-configurable relay lists.

### NIP-07 Extension Availability (Low-Medium Risk)

NIP-07 authentication requires users to have a browser extension installed.
Users without an extension cannot perform any write operations. The extension
may load asynchronously after the page, causing a brief period where the signer
appears unavailable.

**Mitigation:** Detect `window.nostr` with retry/polling to handle late-loading
extensions. Display a clear install prompt with links to nos2x and Alby when no
extension is detected. Read-only browsing (viewing tasks, relay status) works
without authentication. The target audience (Nostr users) is likely to already
have an extension installed.

### IndexedDB Storage Limits (Low Risk)

IndexedDB has browser-imposed storage limits (typically 50-80% of available disk
space, with per-origin limits). A large volume of cached events could approach
these limits over time.

**Mitigation:** For Phase 1, this is not a concern — the volume of events is
small. Phase 5 will implement LRU cache eviction for old events. The application
can function without the cache (it just loses the performance benefit of cached
data on reload).

### Tailwind CSS 4 @theme Maturity (Low Risk)

Tailwind CSS 4 is relatively new and the `@theme` directive is a different
approach from the traditional `tailwind.config.ts` theme extension. Some edge
cases or interactions with shadcn-svelte may not be well-documented yet.

**Mitigation:** The token naming convention follows shadcn-svelte's expected
pattern, which is well-tested. The `@theme` approach is simpler than the
config-based approach and is the recommended path for Tailwind CSS 4. If issues
arise, the tokens can be defined as plain CSS custom properties as a fallback.

### Bundle Size with Full Applesauce Ecosystem (Low Risk)

Installing the entire Applesauce ecosystem (8 packages) plus RxJS, nostr-tools,
and @cashu/cashu-ts adds significant dependency weight. The target is < 200KB
gzipped.

**Mitigation:** Tree-shaking in Vite's production build removes unused exports.
Cashu modules (not used until Phase 3) can be dynamically imported to keep the
initial bundle small. Phase 5 will audit bundle size and apply code splitting as
needed. Phase 1's actual bundle will be smaller since most Applesauce features
are not yet used.
