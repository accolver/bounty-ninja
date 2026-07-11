## ADDED Requirements

### Requirement: Hermetic Financial Lifecycle Coverage

Playwright SHALL run against a clean local relay and deterministic mock mint, block public relay/mint/price traffic, and test create, pledge validation, solution, vote, consensus, release, claim, retraction, and reload persistence. Tests MUST NOT conditionally pass when expected UI is absent.

#### Scenario: Full source-bound lifecycle
- **WHEN** the lifecycle suite runs with two pledgers and one solver
- **THEN** only validated pledge value SHALL vote
- **AND** each source pledge SHALL release exactly once to the unique winner
- **AND** the bounty SHALL complete only after all valid releases

### Requirement: Adversarial and Recovery Coverage

Automated tests SHALL cover fictitious amounts, duplicate proofs, spent proofs, unauthorized retractions, malicious payout redirection, unsafe URLs, invalid signatures, mint outage, relay rejection, crash after swap, and resume without double spend.

#### Scenario: Swap succeeds and publish fails
- **WHEN** the mock mint consumes a source pledge and all relays reject the payout
- **THEN** reload SHALL expose the same recoverable output and signed event
- **AND** retry SHALL not call the mint spend again

### Requirement: Browser and Accessibility Matrix

Release E2E SHALL run Chromium, Firefox, WebKit, and a 375px mobile viewport, with keyboard, landmark, label, focus, and automated accessibility checks on critical routes.

#### Scenario: Mobile payment containment
- **WHEN** a mobile user opens a disabled or recovery-required payment flow
- **THEN** the status and recovery actions SHALL remain visible and keyboard accessible
