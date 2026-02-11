## ADDED Requirements

### Requirement: Bounty Lifecycle State Derivation

The module at `src/lib/bounty/state-machine.ts` SHALL export a pure function
`deriveBountyStatus()` that computes the current `BountyStatus` from a bounty
event and its related events. Status MUST be derived at read time — it is NEVER
stored as a tag on the bounty event itself.

```typescript
function deriveBountyStatus(
  bountyEvent: NostrEvent,
  pledges: NostrEvent[],
  solutions: NostrEvent[],
  payouts: NostrEvent[],
  deleteEvents: NostrEvent[],
  now?: number,
): BountyStatus;
```

The `now` parameter MUST default to `Math.floor(Date.now() / 1000)` (current
Unix timestamp) to enable deterministic testing.

All parameter types MUST use `NostrEvent` from `nostr-tools`.

#### Scenario: Draft status — no pledges

- **WHEN** a Kind 37300 bounty event exists with zero Kind 73002 pledges, zero
  solutions, zero payouts, and zero delete events
- **THEN** `deriveBountyStatus()` MUST return `"draft"`

#### Scenario: Open status — has pledges, no solutions

- **WHEN** a bounty has at least one Kind 73002 pledge but zero Kind 73001
  solutions
- **THEN** `deriveBountyStatus()` MUST return `"open"`

#### Scenario: In-review status — has solutions

- **WHEN** a bounty has at least one Kind 73001 solution (and at least one
  pledge)
- **THEN** `deriveBountyStatus()` MUST return `"in_review"`

#### Scenario: Completed status — payout exists

- **WHEN** a bounty has at least one Kind 73004 payout event
- **THEN** `deriveBountyStatus()` MUST return `"completed"` regardless of pledge
  or solution count

---

### Requirement: Side Transition — Expiration

The `deriveBountyStatus()` function MUST check the `expiration` tag (NIP-40) on
the bounty event. If the current time (`now`) exceeds the expiration timestamp
and no payout exists, the status MUST be `"expired"`.

Expiration MUST be checked AFTER cancellation and completion but BEFORE the
normal draft→open→in_review progression.

#### Scenario: Expired bounty — past deadline with no payout

- **WHEN** a bounty has tag `["expiration", "1700000000"]` and `now` is
  `1700000001` and no payout exists
- **THEN** `deriveBountyStatus()` MUST return `"expired"`

#### Scenario: Completed bounty is not expired

- **WHEN** a bounty has tag `["expiration", "1700000000"]` and `now` is
  `1700000001` but a Kind 73004 payout exists
- **THEN** `deriveBountyStatus()` MUST return `"completed"` (completion takes
  precedence over expiration)

#### Scenario: No expiration tag — never expires

- **WHEN** a bounty has no `expiration` tag
- **THEN** the bounty MUST NOT transition to `"expired"` regardless of the
  current time

#### Scenario: Malformed expiration tag

- **WHEN** a bounty has tag `["expiration", "not-a-number"]`
- **THEN** the bounty MUST NOT transition to `"expired"` (treat as no deadline)

---

### Requirement: Side Transition — Cancellation

The `deriveBountyStatus()` function MUST check for Kind 5 delete events
referencing the bounty. If any delete event exists in the `deleteEvents` array,
the status MUST be `"cancelled"`.

Cancellation MUST be checked FIRST — it takes highest priority over all other
states.

#### Scenario: Cancelled bounty — delete event exists

- **WHEN** `deleteEvents` contains at least one event
- **THEN** `deriveBountyStatus()` MUST return `"cancelled"` regardless of
  pledges, solutions, or payouts

#### Scenario: Cancelled bounty with existing pledges and solutions

- **WHEN** a bounty has 3 pledges, 2 solutions, and 1 delete event
- **THEN** `deriveBountyStatus()` MUST return `"cancelled"`

---

### Requirement: State Priority Order

The function MUST evaluate states in this exact priority order:

1. `"cancelled"` — if `deleteEvents.length > 0`
2. `"completed"` — if `payouts.length > 0`
3. `"expired"` — if expiration tag exists and `now > deadline`
4. `"in_review"` — if `solutions.length > 0`
5. `"open"` — if `pledges.length > 0`
6. `"draft"` — default fallback

#### Scenario: Priority — completed beats expired

- **WHEN** a bounty is past its deadline but has a payout
- **THEN** status MUST be `"completed"`

#### Scenario: Priority — cancelled beats completed

- **WHEN** a bounty has both a payout and a delete event
- **THEN** status MUST be `"cancelled"`

#### Scenario: Priority — expired beats in_review

- **WHEN** a bounty is past its deadline, has solutions, but no payout
- **THEN** status MUST be `"expired"`
