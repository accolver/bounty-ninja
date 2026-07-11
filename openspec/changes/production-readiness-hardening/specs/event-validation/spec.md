## ADDED Requirements

### Requirement: Unified Event Ingestion Validation

All relay, search, cache-revalidation, profile, and reputation ingestion paths SHALL verify event ID/signature and per-kind resource limits before insertion into the Applesauce `EventStore` or IndexedDB. Financial kinds SHALL also require the `client` namespace and supported schema.

#### Scenario: Invalid live relay signature
- **WHEN** any loader receives an event with an invalid signature
- **THEN** the event SHALL not enter the EventStore, cache, projection, or UI

#### Scenario: Oversized financial event
- **WHEN** an event exceeds the configured content, tag, tag-value, or token limits
- **THEN** it SHALL be rejected before token decoding or persistence

### Requirement: Relationship and Ownership Validation

Payouts, votes, retractions, solutions, and reputation events SHALL be validated against existing same-bounty target events before affecting derived state.

#### Scenario: Unauthorized retraction
- **WHEN** a retraction author does not own the referenced bounty or pledge
- **THEN** the retraction SHALL have no derived effect

### Requirement: Safe Event URLs

Every event-derived URL SHALL be normalized through one helper that permits only explicitly supported schemes. Deliverable and prose links SHALL permit `https:` by default; invalid links SHALL render as text.

#### Scenario: JavaScript deliverable URL
- **WHEN** a solution contains an `r` tag using `javascript:`
- **THEN** no clickable link SHALL be rendered
