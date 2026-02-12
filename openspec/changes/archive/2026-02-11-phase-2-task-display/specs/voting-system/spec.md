## ADDED Requirements

### Requirement: Vote Weight Calculation

The module at `src/lib/task/voting.ts` SHALL export a pure function
`calculateVoteWeight()` that computes a single voter's weight as their total
pledge amount in sats (linear weighting: 1 sat = 1 vote weight).

```typescript
function calculateVoteWeight(pledgeAmountSats: number): number;
```

The function MUST return `0` for zero or negative pledge amounts. The function
MUST return the pledge amount directly for positive values.

#### Scenario: Standard vote weight

- **WHEN** `calculateVoteWeight(10000)` is called
- **THEN** the result MUST be `10000`

#### Scenario: Single sat pledge

- **WHEN** `calculateVoteWeight(1)` is called
- **THEN** the result MUST be `1`

#### Scenario: Zero pledge amount

- **WHEN** `calculateVoteWeight(0)` is called
- **THEN** the result MUST be `0`

#### Scenario: Negative pledge amount

- **WHEN** `calculateVoteWeight(-100)` is called
- **THEN** the result MUST be `0`

#### Scenario: Arbitrary pledge amount

- **WHEN** `calculateVoteWeight(2)` is called
- **THEN** the result MUST be `2`

---

### Requirement: VoteTally Interface

The module SHALL export a `VoteTally` interface with the following fields:

```typescript
interface VoteTally {
  approveWeight: number;
  rejectWeight: number;
  quorum: number;
  isApproved: boolean;
  isRejected: boolean;
  quorumPercent: number;
}
```

#### Scenario: VoteTally fields are present

- **WHEN** a `VoteTally` object is returned from `tallyVotes()`
- **THEN** it MUST contain all six fields: `approveWeight`, `rejectWeight`,
  `quorum`, `isApproved`, `isRejected`, `quorumPercent`

---

### Requirement: Vote Tallying

The module SHALL export a pure function `tallyVotes()` that aggregates votes for
a specific solution, applying linear weighting and quorum logic.

```typescript
function tallyVotes(
  votes: Array<{ pubkey: string; choice: "approve" | "reject" }>,
  pledgesByPubkey: Map<string, number>,
  totalPledgedSats: number,
): VoteTally;
```

The function MUST:

1. Deduplicate votes by pubkey — only the LATEST vote per pubkey counts (last
   entry in the array wins)
2. Ignore votes from pubkeys NOT present in `pledgesByPubkey` (non-pledgers
   cannot vote)
3. Calculate each voter's weight as their pledge amount (linear)
4. Sum approve weights and reject weights separately
5. Calculate quorum as `totalPledgedSats * 0.5`
6. Set `isApproved` to `true` only when `approveWeight > rejectWeight` AND
   `approveWeight >= quorum`
7. Set `isRejected` to `true` only when `rejectWeight > approveWeight` AND
   `rejectWeight >= quorum`
8. Calculate `quorumPercent` as
   `(Math.max(approveWeight, rejectWeight) / quorum) * 100`

#### Scenario: Unanimous approval meets quorum

- **WHEN** a task has `totalPledgedSats: 10000` and one voter with 10000 sats
  pledged votes `"approve"`
- **THEN** `approveWeight` MUST be `10000`, `rejectWeight` MUST be `0`, `quorum`
  MUST be `5000`, `isApproved` MUST be `true`, `isRejected` MUST be `false`

#### Scenario: Approval does not meet quorum

- **WHEN** a task has `totalPledgedSats: 10000` (quorum = 5000) and one voter
  with 1 sat pledged votes `"approve"`
- **THEN** `approveWeight` MUST be `1`, `isApproved` MUST be `false` (1 < 5000
  quorum)

#### Scenario: Reject outweighs approve and meets quorum

- **WHEN** two voters exist — voter A pledged 9000 sats and votes `"reject"`,
  voter B pledged 1000 sats and votes `"approve"` — with
  `totalPledgedSats: 10000`
- **THEN** `rejectWeight` MUST be `9000`, `approveWeight` MUST be `1000`,
  `isRejected` MUST be `true`

#### Scenario: Non-pledger votes are ignored

- **WHEN** a vote has `pubkey: "non-pledger"` and `pledgesByPubkey` does NOT
  contain `"non-pledger"`
- **THEN** the vote MUST NOT contribute to `approveWeight` or `rejectWeight`

#### Scenario: Duplicate votes — latest wins

- **WHEN** voter A submits `["approve", "reject", "approve"]` (three votes in
  order)
- **THEN** only the last vote (`"approve"`) MUST be counted

#### Scenario: Zero total pledged sats

- **WHEN** `totalPledgedSats` is `0`
- **THEN** `quorum` MUST be `0` and `quorumPercent` MUST be `0`

#### Scenario: Single funder is sole voter

- **WHEN** one funder pledges 100 sats and votes `"approve"` with
  `totalPledgedSats: 100`
- **THEN** `approveWeight` MUST be `100`, `quorum` MUST be `50` (100 * 0.5),
  `isApproved` MUST be `true`

#### Scenario: Tie between approve and reject

- **WHEN** two voters each pledge 100 sats — one votes `"approve"`, one votes
  `"reject"`
- **THEN** `approveWeight` MUST equal `rejectWeight` (both `100`), `isApproved`
  MUST be `false`, `isRejected` MUST be `false` (neither strictly greater)

#### Scenario: Quorum percent calculation

- **WHEN** `approveWeight` is `2500`, `rejectWeight` is `1000`, and `quorum` is
  `5000`
- **THEN** `quorumPercent` MUST be `50` (2500/5000 * 100)
