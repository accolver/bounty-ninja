## ADDED Requirements

### Requirement: IndexedDB LRU Cache Eviction Policy

An LRU (Least Recently Used) cache eviction policy SHALL be implemented for the
`nostr-idb` IndexedDB event cache to prevent unbounded storage growth. The
eviction policy MUST be configurable with a maximum event count and a maximum
event age. Default limits SHALL be 10,000 events maximum and 30 days maximum
age.

#### Scenario: Cache exceeds maximum event count

- **WHEN** the IndexedDB cache contains more than the configured maximum event
  count (default: 10,000)
- **THEN** the eviction process SHALL remove the least recently accessed events
  until the count is at or below 90% of the maximum (9,000 events)
- **AND** events SHALL be evicted in order of least recent access time

#### Scenario: Cache contains events older than maximum age

- **WHEN** the eviction process runs and finds events with `created_at`
  timestamps older than the configured maximum age (default: 30 days)
- **THEN** those events SHALL be removed from IndexedDB regardless of access
  recency
- **AND** the removal SHALL happen before the count-based eviction

#### Scenario: Eviction preserves user's own events

- **WHEN** the eviction process selects events for removal
- **THEN** events authored by the currently logged-in user's pubkey SHALL NOT be
  evicted regardless of age or access recency
- **AND** events that are part of an active bounty the user created or pledged
  to SHALL NOT be evicted

### Requirement: Cache Eviction Scheduling

The cache eviction process MUST run automatically on application startup (after
initial data load) and periodically every 30 minutes while the application is
active. The eviction process MUST NOT block the main thread — it SHALL use
`requestIdleCallback` or equivalent scheduling to run during idle periods.

#### Scenario: Eviction runs on startup

- **WHEN** the application initializes and loads cached events from IndexedDB
- **THEN** the eviction process SHALL run after the initial event load completes
- **AND** the eviction SHALL NOT delay the initial render of cached data

#### Scenario: Eviction runs periodically

- **WHEN** the application has been running for 30 minutes
- **THEN** the eviction process SHALL run again
- **AND** this cycle SHALL repeat every 30 minutes

#### Scenario: Eviction does not block UI

- **WHEN** the eviction process is running and deleting old events from
  IndexedDB
- **THEN** the UI SHALL remain responsive
- **AND** the user SHALL not perceive any jank or delay

### Requirement: Cache Size Monitoring

A `CacheMonitor` utility SHALL expose the current cache size (event count and
estimated storage bytes) as reactive state. This information MUST be available
on the Settings page so users can see their local storage usage.

#### Scenario: Settings page displays cache statistics

- **WHEN** a user navigates to the Settings page
- **THEN** the page SHALL display the current number of cached events
- **AND** the estimated storage size in human-readable format (e.g., "2.3 MB")

#### Scenario: Manual cache clear

- **WHEN** a user clicks a "Clear Cache" button on the Settings page
- **THEN** all events SHALL be removed from IndexedDB
- **AND** the `EventStore` in-memory state SHALL be cleared
- **AND** the application SHALL re-fetch events from relays
- **AND** a confirmation toast SHALL appear: "Cache cleared. Refreshing data..."

### Requirement: Configurable Cache Limits

Cache eviction limits (maximum event count, maximum age) MUST be configurable
via the Settings page. Changed values MUST be persisted to `localStorage` and
applied on the next eviction cycle.

#### Scenario: User increases maximum event count

- **WHEN** a user changes the maximum event count from 10,000 to 20,000 on the
  Settings page
- **THEN** the new limit SHALL be persisted to `localStorage`
- **AND** the next eviction cycle SHALL use the updated limit

#### Scenario: User decreases maximum age

- **WHEN** a user changes the maximum age from 30 days to 7 days
- **THEN** the next eviction cycle SHALL remove events older than 7 days
