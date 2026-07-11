## ADDED Requirements

### Requirement: Validated Financial Projection

The system SHALL derive funding, voting power, consensus, release progress, completion, and reputation from a single projection in `src/lib/bounty/`. Kind constants SHALL remain `37300`, `73001`, `73002`, `1018`, `73004`, `73005`, and `73006` as defined in PRD Section 6.1. An event that is only structurally parsed MUST NOT contribute financial value.

#### Scenario: Unverified pledge is excluded
- **WHEN** a Kind 73002 pledge has no current valid verification record
- **THEN** its declared `amount` SHALL contribute zero to funded value and vote weight
- **AND** it SHALL be displayed separately as pending, unavailable, or invalid

#### Scenario: Duplicate proofs are excluded
- **WHEN** two active pledge events contain any identical proof identifier
- **THEN** the projection SHALL deterministically accept at most one proof owner
- **AND** duplicated value SHALL NOT be counted twice

### Requirement: Pledge Verification Contract

A valid pledge SHALL have a decodable sat-denominated token whose normalized mint equals the bounty mint and event mint, whose proof sum equals the declared amount, whose proofs are currently unspent under the supported mint guarantee, and whose NUT-11 conditions target the pledge owner's payment key with the configured refund policy.

#### Scenario: Amount mismatch
- **WHEN** the decoded proof sum differs from the Kind 73002 `amount` tag
- **THEN** the pledge SHALL be invalid
- **AND** it SHALL have no financial or voting effect

#### Scenario: Mint unavailable
- **WHEN** required mint validation cannot complete
- **THEN** the pledge SHALL be unavailable rather than valid
- **AND** financial actions SHALL fail closed

### Requirement: Deterministic Consensus Winner

Only validated active pledge value SHALL vote. Vote replacement SHALL order by `(created_at, id)`, and release SHALL require exactly one consensus-approved solution belonging to the bounty.

#### Scenario: Multiple approved solutions
- **WHEN** more than one solution satisfies the configured quorum
- **THEN** the projection SHALL report ambiguous consensus
- **AND** all release actions SHALL remain disabled

### Requirement: Source-Bound Payout Validation

A Kind 73004 payout SHALL be valid only when it references an exact active pledge, is authored by that pledge owner, references the unique consensus winner, targets the winning solution author, and contains matching value locked to that recipient. A payout SHALL NOT determine the winner.

#### Scenario: Payout references a non-winning solution
- **WHEN** a payout references any solution other than the projected winner
- **THEN** the payout SHALL be invalid
- **AND** it SHALL NOT change release progress, winner, lifecycle, or reputation

### Requirement: Authorized Retractions

A Kind 73005 bounty retraction SHALL be accepted only from the bounty creator. A pledge retraction SHALL be accepted only from the referenced pledge author and only when both events reference the same bounty.

#### Scenario: Third-party pledge retraction
- **WHEN** a retraction references another user's pledge
- **THEN** the retraction SHALL be ignored by the projection
- **AND** the pledge SHALL remain active unless another valid state transition applies
