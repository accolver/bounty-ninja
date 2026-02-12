## ADDED Requirements

### Requirement: Event Kind Constants

The module at `src/lib/task/kinds.ts` SHALL export named constants for all
five task-related Nostr event kinds. Each constant MUST be a `number` literal
matching the protocol specification.

```typescript
export const TASK_KIND = 37300;
export const SOLUTION_KIND = 73001;
export const PLEDGE_KIND = 73002;
export const VOTE_KIND = 1018;
export const PAYOUT_KIND = 73004;
```

#### Scenario: Constants match protocol values

- **WHEN** the module is imported
- **THEN** `TASK_KIND` equals `37300`, `SOLUTION_KIND` equals `73001`,
  `PLEDGE_KIND` equals `73002`, `VOTE_KIND` equals `1018`, and `PAYOUT_KIND`
  equals `73004`

#### Scenario: Constants are used as filter kinds

- **WHEN** a Nostr `Filter` object is constructed with `kinds: [TASK_KIND]`
- **THEN** the filter matches only Kind 37300 events

---

### Requirement: Task Type Definitions

The module at `src/lib/task/types.ts` SHALL export TypeScript interfaces for
all parsed task event types. All interfaces MUST reference `NostrEvent` from
`nostr-tools` (NOT from NDK or any other library). The `event` field on each
interface MUST hold the raw `NostrEvent` for signature verification and relay
publishing.

The following types MUST be exported:

- `TaskStatus` — a union type:
  `"draft" | "open" | "in_review" | "completed" | "expired" | "cancelled"`
- `Task` — parsed Kind 37300 with fields: `event`, `id` (NIP-33 address
  `${pubkey}:${kind}:${dTag}`), `dTag`, `pubkey`, `title`, `description`,
  `rewardAmount`, `rewardCurrency` (`"sat"`), `tags` (string[]), `deadline`
  (number | null), `status`, `totalPledged`, `solutionCount`, `createdAt`,
  `mintUrl` (string | null), `submissionFee`
- `Pledge` — parsed Kind 73002 with fields: `event`, `id`, `pubkey`,
  `taskAddress`, `amount`, `cashuToken`, `mintUrl`, `createdAt`, `message`
- `Solution` — parsed Kind 73001 with fields: `event`, `id`, `pubkey`,
  `taskAddress`, `description`, `antiSpamToken`, `antiSpamAmount`,
  `deliverableUrl` (string | null), `createdAt`, `voteWeight`
- `Vote` — parsed Kind 1018 with fields: `event`, `id`, `pubkey`,
  `taskAddress`, `solutionId`, `choice` (`"approve" | "reject"`),
  `pledgeAmount`, `weight`, `createdAt`
- `Payout` — parsed Kind 73004 with fields: `event`, `id`, `pubkey`,
  `taskAddress`, `solutionId`, `solverPubkey`, `amount`, `cashuToken`,
  `createdAt`
- `TaskDetail` — extends `Task` with `pledges`, `solutions`,
  `votesBySolution` (Map<string, Vote[]>), `payout` (Payout | null),
  `creatorProfile` (object | null)
- `TaskSummary` — lightweight type with `id`, `dTag`, `pubkey`, `title`,
  `tags`, `rewardAmount`, `totalPledged`, `solutionCount`, `status`,
  `createdAt`, `deadline`

#### Scenario: Task interface includes raw event

- **WHEN** a `Task` object is constructed
- **THEN** the `event` field MUST be a valid `NostrEvent` with `kind === 37300`

#### Scenario: TaskStatus is a closed union

- **WHEN** a value is assigned to a `TaskStatus` variable
- **THEN** TypeScript MUST reject any value not in
  `"draft" | "open" | "in_review" | "completed" | "expired" | "cancelled"`

#### Scenario: TaskDetail extends Task

- **WHEN** a `TaskDetail` object is constructed
- **THEN** it MUST include all fields from `Task` plus `pledges`, `solutions`,
  `votesBySolution`, `payout`, and `creatorProfile`

#### Scenario: TaskSummary is a lightweight projection

- **WHEN** a `TaskSummary` is used in a list view
- **THEN** it MUST NOT include `event`, `description`, `mintUrl`, or
  `submissionFee` fields

---

### Requirement: Tag Parsing Helpers

The module at `src/lib/task/helpers.ts` SHALL export pure functions that
extract typed data from raw `NostrEvent` tags. Each parser MUST handle missing
or malformed tags gracefully by returning sensible defaults (empty string, 0,
null) rather than throwing.

The following functions MUST be exported:

```typescript
function parseTaskSummary(event: NostrEvent): TaskSummary;
function parseTaskDetail(
  event: NostrEvent,
  pledges: NostrEvent[],
  solutions: NostrEvent[],
  votes: NostrEvent[],
  payouts: NostrEvent[],
  deleteEvents: NostrEvent[],
): TaskDetail;
function parsePledge(event: NostrEvent): Pledge;
function parseSolution(event: NostrEvent): Solution;
function parseVote(event: NostrEvent): Vote;
function parsePayout(event: NostrEvent): Payout;
```

Tag extraction rules:

- `title`: first `["title", ...]` tag, fallback to first `["subject", ...]` tag,
  fallback to first line of `content`
- `reward`: `["reward", "<amount>", "sat"]` — parse amount as integer, default
  `0`
- `d` tag: `["d", "<identifier>"]` — REQUIRED for Kind 37300 (NIP-33)
- `a` tag: `["a", "37300:<pubkey>:<d-tag>", "<relay-hint>"]` — task address
  reference
- `e` tag: `["e", "<event-id>", "<relay-hint>"]` — solution reference in votes
- `t` tags: all `["t", "<tag>"]` entries collected into `string[]`
- `expiration`: `["expiration", "<unix-timestamp>"]` — parsed as integer, null
  if absent
- `mint`: `["mint", "<url>"]` — string or null
- `fee`: `["fee", "<sats>"]` — parsed as integer, default `0`
- `amount`: `["amount", "<sats>"]` — parsed as integer for pledges/payouts
- `cashu`: `["cashu", "<token>"]` — raw token string
- `vote`: `["vote", "approve" | "reject"]` — vote choice
- `r`: `["r", "<url>"]` — deliverable URL for solutions
- `p`: `["p", "<pubkey>"]` — referenced pubkey

#### Scenario: Parse task with all tags present

- **WHEN** `parseTaskSummary()` receives a Kind 37300 event with `d`, `title`,
  `reward`, `t`, `expiration` tags
- **THEN** the returned `TaskSummary` MUST have `dTag`, `title`,
  `rewardAmount`, `tags`, and `deadline` populated correctly

#### Scenario: Parse task with missing optional tags

- **WHEN** `parseTaskSummary()` receives a Kind 37300 event with only `d` and
  `title` tags
- **THEN** `rewardAmount` MUST be `0`, `tags` MUST be `[]`, `deadline` MUST be
  `null`

#### Scenario: Parse task title fallback chain

- **WHEN** a Kind 37300 event has no `title` tag but has a `subject` tag with
  value `"My Task"`
- **THEN** `parseTaskSummary()` MUST return `title: "My Task"`
- **WHEN** neither `title` nor `subject` tags exist and `content` starts with
  `"First line\nSecond line"`
- **THEN** `parseTaskSummary()` MUST return `title: "First line"`

#### Scenario: Parse pledge extracts task address

- **WHEN** `parsePledge()` receives a Kind 73002 event with tag
  `["a", "37300:abc123:task-1", "wss://relay.example"]`
- **THEN** the returned `Pledge` MUST have
  `taskAddress: "37300:abc123:task-1"`

#### Scenario: Parse vote extracts choice and solution reference

- **WHEN** `parseVote()` receives a Kind 1018 event with tags
  `["vote", "approve"]` and `["e", "solution-event-id-hex"]`
- **THEN** the returned `Vote` MUST have `choice: "approve"` and
  `solutionId: "solution-event-id-hex"`

#### Scenario: Malformed reward tag defaults to zero

- **WHEN** `parseTaskSummary()` receives an event with tag
  `["reward", "not-a-number"]`
- **THEN** `rewardAmount` MUST be `0`

#### Scenario: NIP-33 address construction

- **WHEN** `parseTaskSummary()` processes a Kind 37300 event with
  `pubkey: "abc"` and `d` tag `"task-1"`
- **THEN** `id` MUST equal `"abc:37300:task-1"`
