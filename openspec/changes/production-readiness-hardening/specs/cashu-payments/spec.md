## MODIFIED Requirements

### Requirement: P2PK Locking for Escrow (NUT-11)

The system SHALL implement P2PK locking in `src/lib/cashu/p2pk.ts` per NUT-11 using a Cashu payment key controlled by the pledger, never the user's Nostr identity private key. Public pledge proofs MUST remain spendable only by an explicitly authorized key before and after locktime; omitting refund keys MUST NOT create an anyone-spendable expiration path. Payout proofs SHALL be locked directly to the winning solver's declared compatible payment key.

#### Scenario: Create self-custodial pledge
- **WHEN** a funder creates a pledge
- **THEN** every proof SHALL require the funder's Cashu payment signer before expiration
- **AND** the configured refund condition SHALL explicitly preserve authorized recovery after expiration

#### Scenario: Lock payout to solver
- **WHEN** a validated pledger releases one source pledge
- **THEN** the mint outputs SHALL be created directly with the solver payment key condition where supported
- **AND** intermediate unlocked proofs SHALL not exist without durable recovery handling

#### Scenario: Unsupported lock policy
- **WHEN** the mint or wallet cannot prove support for the required lock and refund conditions
- **THEN** the payment operation SHALL be blocked before consuming proofs

## ADDED Requirements

### Requirement: Payment Key Capability Boundary

Cashu modules SHALL accept a typed payment-signing capability and MUST NOT accept raw Nostr secret-key strings or bytes from UI components.

#### Scenario: Component requests proof signing
- **WHEN** a release or reclaim component needs NUT-11 authorization
- **THEN** it SHALL invoke the payment capability interface
- **AND** no identity secret SHALL enter component state
