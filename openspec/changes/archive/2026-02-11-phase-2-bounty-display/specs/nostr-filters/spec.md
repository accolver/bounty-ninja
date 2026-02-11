## ADDED Requirements

### Requirement: Bounty List Filter

The module at `src/lib/bounty/filters.ts` SHALL export a function
`bountyListFilter()` that returns a `Filter` (from `nostr-tools`) matching all
Kind 37300 bounty events, ordered most-recent-first.

```typescript
function bountyListFilter(limit?: number): Filter;
```

The `limit` parameter MUST default to `50`. The returned filter MUST have
`kinds: [37300]`.

#### Scenario: Default bounty list filter

- **WHEN** `bountyListFilter()` is called with no arguments
- **THEN** the returned filter MUST be `{ kinds: [37300], limit: 50 }`

#### Scenario: Custom limit

- **WHEN** `bountyListFilter(100)` is called
- **THEN** the returned filter MUST be `{ kinds: [37300], limit: 100 }`

---

### Requirement: Pledges For Bounty Filter

The module SHALL export a function `pledgesForBountyFilter()` that returns a
`Filter` matching all Kind 73002 pledge events referencing a specific bounty
address via the `#a` tag.

```typescript
function pledgesForBountyFilter(bountyAddress: string): Filter;
```

#### Scenario: Pledges filter uses #a tag

- **WHEN** `pledgesForBountyFilter("37300:pubkey123:bounty-1")` is called
- **THEN** the returned filter MUST be
  `{ kinds: [73002], "#a": ["37300:pubkey123:bounty-1"] }`

---

### Requirement: Solutions For Bounty Filter

The module SHALL export a function `solutionsForBountyFilter()` that returns a
`Filter` matching all Kind 73001 solution events referencing a specific bounty
address.

```typescript
function solutionsForBountyFilter(bountyAddress: string): Filter;
```

#### Scenario: Solutions filter uses #a tag

- **WHEN** `solutionsForBountyFilter("37300:pubkey123:bounty-1")` is called
- **THEN** the returned filter MUST be
  `{ kinds: [73001], "#a": ["37300:pubkey123:bounty-1"] }`

---

### Requirement: Votes For Bounty Filter

The module SHALL export a function `votesForBountyFilter()` that returns a
`Filter` matching all Kind 1018 vote events referencing a specific bounty
address.

```typescript
function votesForBountyFilter(bountyAddress: string): Filter;
```

#### Scenario: Votes filter uses #a tag

- **WHEN** `votesForBountyFilter("37300:pubkey123:bounty-1")` is called
- **THEN** the returned filter MUST be
  `{ kinds: [1018], "#a": ["37300:pubkey123:bounty-1"] }`

---

### Requirement: Payout For Bounty Filter

The module SHALL export a function `payoutForBountyFilter()` that returns a
`Filter` matching Kind 73004 payout events referencing a specific bounty
address.

```typescript
function payoutForBountyFilter(bountyAddress: string): Filter;
```

#### Scenario: Payout filter uses #a tag

- **WHEN** `payoutForBountyFilter("37300:pubkey123:bounty-1")` is called
- **THEN** the returned filter MUST be
  `{ kinds: [73004], "#a": ["37300:pubkey123:bounty-1"] }`

---

### Requirement: Bounty By Author Filter

The module SHALL export a function `bountyByAuthorFilter()` that returns a
`Filter` matching all Kind 37300 bounty events authored by a specific pubkey.

```typescript
function bountyByAuthorFilter(pubkey: string): Filter;
```

#### Scenario: Author filter uses authors array

- **WHEN** `bountyByAuthorFilter("abc123hex")` is called
- **THEN** the returned filter MUST be
  `{ kinds: [37300], authors: ["abc123hex"] }`

---

### Requirement: NIP-50 Search Filter

The module SHALL export a function `searchBountiesFilter()` that returns a
`Filter` with the NIP-50 `search` field for full-text bounty search on
compatible relays.

```typescript
function searchBountiesFilter(query: string, limit?: number): Filter;
```

The `limit` parameter MUST default to `20`.

#### Scenario: Search filter includes search field

- **WHEN** `searchBountiesFilter("lightning")` is called
- **THEN** the returned filter MUST be
  `{ kinds: [37300], search: "lightning", limit: 20 }`

#### Scenario: Search filter with custom limit

- **WHEN** `searchBountiesFilter("design", 10)` is called
- **THEN** the returned filter MUST be
  `{ kinds: [37300], search: "design", limit: 10 }`

---

### Requirement: All Filters Use nostr-tools Types

All filter functions MUST return the `Filter` type imported from `nostr-tools`.
The module MUST NOT import filter types from NDK or any other library. All event
kind values MUST be referenced via the constants from `src/lib/bounty/kinds.ts`.

#### Scenario: Filter type compatibility

- **WHEN** any filter function is called
- **THEN** the returned object MUST satisfy the `Filter` type from `nostr-tools`

#### Scenario: Kind constants are used (not literals)

- **WHEN** the `filters.ts` source code is inspected
- **THEN** it MUST import and use `BOUNTY_KIND`, `PLEDGE_KIND`, `SOLUTION_KIND`,
  `VOTE_KIND`, `PAYOUT_KIND` from `./kinds` rather than hardcoded numeric
  literals
