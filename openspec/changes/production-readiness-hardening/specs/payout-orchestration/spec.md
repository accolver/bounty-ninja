## MODIFIED Requirements

### Requirement: Creator-Initiated Payout Flow

The system SHALL implement a pledger-controlled release flow. After one unique solution reaches consensus, each validated pledge owner SHALL release only their own source pledge through a Cashu payment signer. The bounty creator SHALL have no authority to spend other pledgers' proofs, and no participant SHALL provide a Nostr identity private key to the application.

#### Scenario: Release trigger visibility
- **WHEN** exactly one solution has validated consensus and the current user owns an unreleased validated pledge
- **THEN** a release action SHALL be displayed for that user's pledge

#### Scenario: Non-owner cannot release pledge
- **WHEN** the current user does not own a source pledge
- **THEN** no release action for that pledge SHALL be available

#### Scenario: Ambiguous or incomplete consensus
- **WHEN** consensus has multiple winners or required related-event loading is incomplete
- **THEN** all release actions SHALL be blocked

## ADDED Requirements

### Requirement: Source Pledge References

Every new Kind 73004 payout SHALL reference the exact Kind 73002 source pledge event and SHALL represent no more than that validated source value. MVP releases SHALL publish one payout event per source pledge and mint.

#### Scenario: Valid release event
- **WHEN** a pledger releases a source pledge to the winner
- **THEN** the payout SHALL include the bounty address, source pledge ID, winning solution ID, solver pubkey, amount, mint, token, and `client` tag

#### Scenario: Duplicate release
- **WHEN** a second payout attempts to reference an already validly released source pledge
- **THEN** it SHALL be ignored for release progress and reputation
