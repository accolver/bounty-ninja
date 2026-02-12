## ADDED Requirements

### Requirement: Singleton EventStore

`src/lib/nostr/event-store.ts` MUST export a singleton `EventStore` instance
from `applesauce-core`. This instance SHALL be the single source of truth for
all Nostr events in the application. The module MUST export the instance as a
named export `eventStore`.

#### Scenario: EventStore is a singleton

- **WHEN** `eventStore` is imported from two different modules
- **THEN** both imports reference the same `EventStore` instance

#### Scenario: Events can be added to the store

- **WHEN** a valid `NostrEvent` (from `nostr-tools`) is added to `eventStore`
- **THEN** the event is stored in memory and retrievable via the EventStore
  query API

### Requirement: Singleton RelayPool

`src/lib/nostr/relay-pool.ts` MUST export a singleton `RelayPool` instance from
`applesauce-relay` as a named export `pool`. The module MUST also export a
`connectDefaultRelays()` function that reads the `PUBLIC_DEFAULT_RELAYS`
environment variable, splits it by comma, and calls `pool.relay(url)` for each
relay URL.

#### Scenario: Default relays are connected on initialization

- **WHEN** `connectDefaultRelays()` is called
- **THEN** the `RelayPool` opens WebSocket connections to each URL in
  `PUBLIC_DEFAULT_RELAYS`
- **AND** at least 2 relay connections are attempted (matching the default env
  value)

#### Scenario: RelayPool is a singleton

- **WHEN** `pool` is imported from two different modules
- **THEN** both imports reference the same `RelayPool` instance

#### Scenario: Relay URLs are parsed from environment

- **WHEN** `PUBLIC_DEFAULT_RELAYS` is set to
  `"wss://relay.damus.io,wss://nos.lol,wss://relay.primal.net"`
- **THEN** `connectDefaultRelays()` attempts connections to all three relay URLs
- **AND** empty strings from trailing commas are filtered out

### Requirement: IndexedDB Event Cache

`src/lib/nostr/cache.ts` MUST set up `nostr-idb` as an IndexedDB-backed event
cache. The cache MUST persist events across page reloads. The module MUST export
a function to initialize the cache and wire it to the `EventStore` so that
events added to the store are also persisted to IndexedDB, and events from
IndexedDB are loaded into the store on startup.

#### Scenario: Events persist across page reloads

- **WHEN** events are received from relays and added to the `EventStore`
- **AND** the page is reloaded
- **THEN** previously cached events are loaded from IndexedDB into the
  `EventStore` before new relay subscriptions begin

#### Scenario: IndexedDB database is created

- **WHEN** the cache is initialized
- **THEN** an IndexedDB database is created (inspectable via browser DevTools >
  Application > IndexedDB)

#### Scenario: Cache handles empty state

- **WHEN** the cache is initialized for the first time (no prior data)
- **THEN** the `EventStore` starts empty without errors
- **AND** the application proceeds to fetch events from relays

### Requirement: Relay Subscription Infrastructure

The relay pool MUST support creating RxJS Observable-based subscriptions using
Nostr `Filter` objects (from `nostr-tools`). Events received from relay
subscriptions MUST be added to the `EventStore`. The subscription pattern MUST
follow the Applesauce convention:
`pool.relay(url).subscription(filter).pipe(onlyEvents()).subscribe(event => eventStore.add(event))`.

#### Scenario: Subscription receives events from relays

- **WHEN** a subscription is created with a filter `{ kinds: [1], limit: 10 }`
- **AND** the connected relay has matching events
- **THEN** events flow through the RxJS Observable into the `EventStore`

#### Scenario: Subscription teardown on unsubscribe

- **WHEN** an RxJS subscription is unsubscribed
- **THEN** the relay CLOSE message is sent
- **AND** no further events are delivered from that subscription

### Requirement: Proof-of-Concept Event Display

The home page (`src/routes/+page.svelte`) MUST display raw events received from
connected relays as a proof of connectivity. This is a temporary implementation
that will be replaced with task cards in Phase 2. The page MUST subscribe to
recent events (e.g., Kind 1 text notes with a reasonable limit) and render them
in a list showing the event `id` (truncated), `kind`, `created_at` (formatted),
and `content` (truncated).

#### Scenario: Home page displays events from relays

- **WHEN** the home page loads and relays are connected
- **AND** the relays have events matching the subscription filter
- **THEN** events are displayed in a list on the page

#### Scenario: Home page shows empty state when no events

- **WHEN** the home page loads and no events match the subscription
- **THEN** an appropriate empty state message is displayed (e.g., "No events
  found. Connecting to relays...")

#### Scenario: Events are visible in EventStore via console

- **WHEN** the application is running and connected to relays
- **THEN** the `eventStore` is accessible from the browser console for debugging
- **AND** events can be verified as present in the store

### Requirement: Relay Connection Error Handling

The relay connection layer MUST handle connection failures gracefully. If a
relay WebSocket connection fails, the application MUST NOT crash. The
`RelayPool` from Applesauce handles reconnection internally. The application
MUST surface connection status to the UI via the `RelayStatus` component
(specified in the `app-layout` capability).

#### Scenario: Application survives relay connection failure

- **WHEN** a relay URL is unreachable (e.g., `wss://nonexistent.relay.example`)
- **THEN** the application continues to function with remaining connected relays
- **AND** no unhandled exceptions are thrown

#### Scenario: Application works with partial relay connectivity

- **WHEN** 2 of 4 configured relays are reachable
- **THEN** events are received from the 2 connected relays
- **AND** the UI indicates which relays are connected and which are not
