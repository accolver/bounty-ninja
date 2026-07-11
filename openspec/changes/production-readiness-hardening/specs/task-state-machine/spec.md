## MODIFIED Requirements

### Requirement: Task Lifecycle State Derivation

`src/lib/bounty/state-machine.ts` SHALL derive bounty status only from the trusted financial projection: authorized retractions, validated active pledges, same-bounty solutions, deterministic consensus, and valid source-bound payouts. The same derivation SHALL be used by list, detail, search, profile, and reputation views.

#### Scenario: Draft status
- **WHEN** a bounty has zero validated active pledge value
- **THEN** its status SHALL be `draft` even if unverified pledge events exist

#### Scenario: Releasing status
- **WHEN** exactly one solution has consensus and some but not all validated active pledge value has a valid payout
- **THEN** status SHALL be `releasing`

#### Scenario: Completed status
- **WHEN** every validated active source pledge has one valid payout to the consensus winner
- **THEN** status SHALL be `completed`

#### Scenario: Authorized cancellation
- **WHEN** the bounty creator publishes a valid Kind 73005 bounty retraction
- **THEN** status SHALL be `cancelled`

#### Scenario: Unauthorized cancellation
- **WHEN** any other author publishes a bounty retraction
- **THEN** status SHALL remain unchanged
