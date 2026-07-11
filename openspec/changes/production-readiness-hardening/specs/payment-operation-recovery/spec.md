## ADDED Requirements

### Requirement: Payment Signer Separation

The application MUST NOT request, receive, store, or process a Nostr identity private key. NIP-07 or NIP-46 SHALL sign Nostr events, while NUT-11 proof operations SHALL use a Cashu wallet capability or dedicated payment signer that does not expose secret bytes to UI components.

#### Scenario: NIP-07 user releases funds
- **WHEN** a NIP-07-authenticated pledger starts a release
- **THEN** the application SHALL request the required operation from the configured Cashu payment signer
- **AND** SHALL NOT render an `nsec`, hex private-key, or generic secret-key input

### Requirement: Durable Operation Journal

Before any mint call can consume proofs, the application SHALL persist a versioned operation record containing intent, source event IDs, safe status metadata, and recoverable output handling. State transitions SHALL include `prepared`, `spending`, `outputs-created`, `event-signed`, `published`, `confirmed`, `recovery-required`, and `failed`.

#### Scenario: Browser closes after mint swap
- **WHEN** a mint creates replacement proofs and the browser closes before relay publication
- **THEN** reopening the application SHALL surface the pending operation
- **AND** the user SHALL be able to resume publication or export recovery material

#### Scenario: All relays reject publication
- **WHEN** replacement proofs exist but no relay accepts the exact signed event
- **THEN** the operation SHALL enter `recovery-required`
- **AND** the application SHALL preserve retry and recovery data without reporting success

### Requirement: Idempotent Publication and Completion

Publication retries SHALL reuse the exact signed event, and an operation SHALL be complete only after at least one relay acknowledgement and any required wallet handoff confirmation.

#### Scenario: Retry after partial failure
- **WHEN** an operation is resumed after a failed publication
- **THEN** it SHALL NOT repeat the mint spend
- **AND** it SHALL retry the previously signed event
