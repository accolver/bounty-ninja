## ADDED Requirements

### Requirement: Task Timeline Loader

The module at `src/lib/nostr/loaders/task-loader.ts` SHALL export a function
or factory that creates an Applesauce `TimelineLoader` instance for Kind 37300
task events. The loader MUST use the singleton `RelayPool` from
`src/lib/nostr/relay-pool.ts` and add received events to the singleton
`EventStore` from `src/lib/nostr/event-store.ts`.

The loader MUST subscribe to all connected relays using the filter
`{ kinds: [37300], limit: N }` where N is configurable.

#### Scenario: Task loader fetches Kind 37300 events

- **WHEN** the task loader is started with connected relays
- **THEN** it MUST issue a subscription with `kinds: [37300]` to each connected
  relay

#### Scenario: Received events are added to EventStore

- **WHEN** the task loader receives a Kind 37300 event from a relay
- **THEN** the event MUST be added to the singleton `EventStore` instance

#### Scenario: Loader is unsubscribable

- **WHEN** the task loader subscription is torn down (e.g., via RxJS
  unsubscribe)
- **THEN** the relay subscription MUST be closed and no further events processed

---

### Requirement: Pledge Loader

The module at `src/lib/nostr/loaders/pledge-loader.ts` SHALL export a function
that creates a loader for Kind 73002 pledge events filtered by a specific task
address (`#a` tag). The loader MUST add received events to the singleton
`EventStore`.

```typescript
function createPledgeLoader(taskAddress: string): Subscription;
```

#### Scenario: Pledge loader filters by task address

- **WHEN** `createPledgeLoader("37300:pubkey:task-1")` is called
- **THEN** the subscription filter MUST include `kinds: [73002]` and
  `"#a": ["37300:pubkey:task-1"]`

#### Scenario: Pledge events are added to EventStore

- **WHEN** a Kind 73002 event is received matching the task address
- **THEN** it MUST be added to the singleton `EventStore`

---

### Requirement: Solution Loader

The module at `src/lib/nostr/loaders/solution-loader.ts` SHALL export a function
that creates a loader for Kind 73001 solution events filtered by task address.

```typescript
function createSolutionLoader(taskAddress: string): Subscription;
```

#### Scenario: Solution loader filters by task address

- **WHEN** `createSolutionLoader("37300:pubkey:task-1")` is called
- **THEN** the subscription filter MUST include `kinds: [73001]` and
  `"#a": ["37300:pubkey:task-1"]`

#### Scenario: Solution events are added to EventStore

- **WHEN** a Kind 73001 event is received matching the task address
- **THEN** it MUST be added to the singleton `EventStore`

---

### Requirement: Vote Loader

The module at `src/lib/nostr/loaders/vote-loader.ts` SHALL export a function
that creates a loader for Kind 1018 vote events filtered by task address.

```typescript
function createVoteLoader(taskAddress: string): Subscription;
```

#### Scenario: Vote loader filters by task address

- **WHEN** `createVoteLoader("37300:pubkey:task-1")` is called
- **THEN** the subscription filter MUST include `kinds: [1018]` and
  `"#a": ["37300:pubkey:task-1"]`

#### Scenario: Vote events are added to EventStore

- **WHEN** a Kind 1018 event is received matching the task address
- **THEN** it MUST be added to the singleton `EventStore`

---

### Requirement: Profile Loader

The module at `src/lib/nostr/loaders/profile-loader.ts` SHALL export a function
that creates a loader for Kind 0 profile metadata events for one or more
pubkeys.

```typescript
function createProfileLoader(pubkeys: string[]): Subscription;
```

#### Scenario: Profile loader fetches Kind 0 for given pubkeys

- **WHEN** `createProfileLoader(["pubkey1", "pubkey2"])` is called
- **THEN** the subscription filter MUST include `kinds: [0]` and
  `authors: ["pubkey1", "pubkey2"]`

#### Scenario: Profile events are added to EventStore

- **WHEN** a Kind 0 event is received for a requested pubkey
- **THEN** it MUST be added to the singleton `EventStore`

---

### Requirement: Loader Lifecycle Management

All loaders MUST return an object or RxJS `Subscription` that can be
unsubscribed to clean up relay connections. Loaders MUST NOT leak subscriptions
— when the consumer unsubscribes, the underlying relay subscription MUST be
closed.

#### Scenario: Cleanup on unsubscribe

- **WHEN** a loader subscription is unsubscribed
- **THEN** no further events from that subscription MUST be added to the
  `EventStore`
- **AND** the relay-level subscription MUST be closed

#### Scenario: Multiple loaders for same task

- **WHEN** pledge, solution, and vote loaders are all created for the same
  task address
- **THEN** each MUST operate independently and each MUST be independently
  unsubscribable
