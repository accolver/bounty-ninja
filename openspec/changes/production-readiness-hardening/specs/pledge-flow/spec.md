## MODIFIED Requirements

### Requirement: Cashu Token Creation with P2PK Lock

When a pledge is submitted, `src/lib/cashu/escrow.ts` and `src/lib/cashu/p2pk.ts` SHALL swap user-provided value into proofs controlled by the pledger's Cashu payment signer with explicit safe refund semantics. Token creation SHALL persist recovery intent before consuming input proofs and SHALL return recoverable output data on every post-spend failure.

#### Scenario: Successful token creation and locking
- **WHEN** a user confirms a valid pledge of N sats
- **THEN** the output proof sum SHALL equal N sats minus disclosed mint fees
- **AND** every proof SHALL satisfy the bounty mint and configured P2PK/refund policy
- **AND** the operation journal SHALL contain the output before event publication

#### Scenario: Mint failure before spend
- **WHEN** token creation fails before input proofs are consumed
- **THEN** no pledge event SHALL be published
- **AND** the UI SHALL report that the original token remains authoritative

#### Scenario: Failure after spend
- **WHEN** input proofs are consumed but pledge publication does not complete
- **THEN** the application SHALL surface durable retry and recovery actions
- **AND** SHALL NOT clear the form or report pledge success

## ADDED Requirements

### Requirement: Confirmed Pledge Publication

A pledge SHALL be presented as submitted only after at least one relay accepts the exact signed Kind 73002 event. Relay-rejected optimistic events SHALL remain local recovery records and SHALL not contribute financial state.

#### Scenario: All relays reject pledge
- **WHEN** every configured relay rejects or fails to receive a pledge event
- **THEN** the pledge SHALL be marked unpublished
- **AND** its value SHALL not affect funding or voting
