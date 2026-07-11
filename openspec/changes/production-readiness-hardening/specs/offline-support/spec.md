## ADDED Requirements

### Requirement: Cache-First Bounty Queries

Home and detail routes SHALL load verified cached bounty and related events before relay revalidation. Direct detail queries SHALL include payouts and retractions and SHALL merge validated `naddr` relay hints with configured relays.

#### Scenario: Offline deep link
- **WHEN** a previously visited bounty detail URL is opened without network access
- **THEN** the service worker SHALL serve the SPA shell
- **AND** the route SHALL render verified cached state marked stale

### Requirement: Distinct Availability States

The UI SHALL distinguish browser offline, all relays unavailable, partial relay coverage, mint unavailable, stale cache, and verified empty results. Financial actions SHALL require the relevant relay and mint readiness.

#### Scenario: Browser online but relays unavailable
- **WHEN** `navigator.onLine` is true and no writable relay is available
- **THEN** publish actions SHALL be disabled or queued explicitly
- **AND** the UI SHALL not report an empty marketplace as confirmed

### Requirement: Payment Recovery Across Updates

Service-worker activation and application upgrades MUST NOT discard pending payment journal records. A critical update SHALL block new irreversible operations until the active client is compatible.

#### Scenario: Update with pending operation
- **WHEN** a new service worker is available while a payment operation is incomplete
- **THEN** the user SHALL retain recovery access
- **AND** activation SHALL not silently lose or repeat the operation
