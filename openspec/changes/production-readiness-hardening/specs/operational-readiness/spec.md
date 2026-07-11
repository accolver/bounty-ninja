## ADDED Requirements

### Requirement: Payment Safety Control

Production builds SHALL support a reviewed configuration that disables new payment writes without disabling read-only bounty access. Payment actions SHALL default disabled until all payment release gates are satisfied.

#### Scenario: Payments disabled
- **WHEN** the production payment flag is disabled
- **THEN** pledge, fee, release, and reclaim controls SHALL not execute mint operations
- **AND** the UI SHALL explain that payments are temporarily unavailable

### Requirement: Privacy-Preserving Diagnostics

Operational diagnostics SHALL include release identity, route category, browser family, relay result category, mint operation category, and sanitized errors. They MUST NOT include pubkeys, event content, event tags, Cashu tokens, proofs, private keys, or secret-bearing URLs.

#### Scenario: Payment error is recorded
- **WHEN** a mint operation fails
- **THEN** diagnostics SHALL record only the operation category, release ID, and sanitized failure class
- **AND** no bearer or identity material SHALL leave the client

### Requirement: Incident and Rollback Procedures

The repository SHALL contain reviewed runbooks for payment incidents, compromised releases, credential rotation, relay or mint outages, Cloudflare rollback, and security disclosure. A production deployment SHALL identify the exact artifact and commit.

#### Scenario: Bad payment release
- **WHEN** a production release causes unsafe payment behavior
- **THEN** an operator SHALL be able to disable payments or roll back to a known artifact using the documented procedure
- **AND** the procedure SHALL define verification and communication steps
