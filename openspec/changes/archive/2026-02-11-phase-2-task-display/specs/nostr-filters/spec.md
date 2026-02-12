## ADDED Requirements

### Requirement: Task List Filter

The module at `src/lib/task/filters.ts` SHALL export a function
`taskListFilter()` that returns a `Filter` (from `nostr-tools`) matching all
Kind 37300 task events, ordered most-recent-first.

```typescript
function taskListFilter(limit?: number): Filter;
```

The `limit` parameter MUST default to `50`. The returned filter MUST have
`kinds: [37300]`.

#### Scenario: Default task list filter

- **WHEN** `taskListFilter()` is called with no arguments
- **THEN** the returned filter MUST be `{ kinds: [37300], limit: 50 }`

#### Scenario: Custom limit

- **WHEN** `taskListFilter(100)` is called
- **THEN** the returned filter MUST be `{ kinds: [37300], limit: 100 }`

---

### Requirement: Pledges For Task Filter

The module SHALL export a function `pledgesForTaskFilter()` that returns a
`Filter` matching all Kind 73002 pledge events referencing a specific task
address via the `#a` tag.

```typescript
function pledgesForTaskFilter(taskAddress: string): Filter;
```

#### Scenario: Pledges filter uses #a tag

- **WHEN** `pledgesForTaskFilter("37300:pubkey123:task-1")` is called
- **THEN** the returned filter MUST be
  `{ kinds: [73002], "#a": ["37300:pubkey123:task-1"] }`

---

### Requirement: Solutions For Task Filter

The module SHALL export a function `solutionsForTaskFilter()` that returns a
`Filter` matching all Kind 73001 solution events referencing a specific task
address.

```typescript
function solutionsForTaskFilter(taskAddress: string): Filter;
```

#### Scenario: Solutions filter uses #a tag

- **WHEN** `solutionsForTaskFilter("37300:pubkey123:task-1")` is called
- **THEN** the returned filter MUST be
  `{ kinds: [73001], "#a": ["37300:pubkey123:task-1"] }`

---

### Requirement: Votes For Task Filter

The module SHALL export a function `votesForTaskFilter()` that returns a
`Filter` matching all Kind 1018 vote events referencing a specific task
address.

```typescript
function votesForTaskFilter(taskAddress: string): Filter;
```

#### Scenario: Votes filter uses #a tag

- **WHEN** `votesForTaskFilter("37300:pubkey123:task-1")` is called
- **THEN** the returned filter MUST be
  `{ kinds: [1018], "#a": ["37300:pubkey123:task-1"] }`

---

### Requirement: Payout For Task Filter

The module SHALL export a function `payoutForTaskFilter()` that returns a
`Filter` matching Kind 73004 payout events referencing a specific task
address.

```typescript
function payoutForTaskFilter(taskAddress: string): Filter;
```

#### Scenario: Payout filter uses #a tag

- **WHEN** `payoutForTaskFilter("37300:pubkey123:task-1")` is called
- **THEN** the returned filter MUST be
  `{ kinds: [73004], "#a": ["37300:pubkey123:task-1"] }`

---

### Requirement: Task By Author Filter

The module SHALL export a function `taskByAuthorFilter()` that returns a
`Filter` matching all Kind 37300 task events authored by a specific pubkey.

```typescript
function taskByAuthorFilter(pubkey: string): Filter;
```

#### Scenario: Author filter uses authors array

- **WHEN** `taskByAuthorFilter("abc123hex")` is called
- **THEN** the returned filter MUST be
  `{ kinds: [37300], authors: ["abc123hex"] }`

---

### Requirement: NIP-50 Search Filter

The module SHALL export a function `searchTasksFilter()` that returns a
`Filter` with the NIP-50 `search` field for full-text task search on
compatible relays.

```typescript
function searchTasksFilter(query: string, limit?: number): Filter;
```

The `limit` parameter MUST default to `20`.

#### Scenario: Search filter includes search field

- **WHEN** `searchTasksFilter("lightning")` is called
- **THEN** the returned filter MUST be
  `{ kinds: [37300], search: "lightning", limit: 20 }`

#### Scenario: Search filter with custom limit

- **WHEN** `searchTasksFilter("design", 10)` is called
- **THEN** the returned filter MUST be
  `{ kinds: [37300], search: "design", limit: 10 }`

---

### Requirement: All Filters Use nostr-tools Types

All filter functions MUST return the `Filter` type imported from `nostr-tools`.
The module MUST NOT import filter types from NDK or any other library. All event
kind values MUST be referenced via the constants from `src/lib/task/kinds.ts`.

#### Scenario: Filter type compatibility

- **WHEN** any filter function is called
- **THEN** the returned object MUST satisfy the `Filter` type from `nostr-tools`

#### Scenario: Kind constants are used (not literals)

- **WHEN** the `filters.ts` source code is inspected
- **THEN** it MUST import and use `TASK_KIND`, `PLEDGE_KIND`, `SOLUTION_KIND`,
  `VOTE_KIND`, `PAYOUT_KIND` from `./kinds` rather than hardcoded numeric
  literals
