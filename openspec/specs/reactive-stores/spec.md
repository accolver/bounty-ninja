## ADDED Requirements

### Requirement: BountyListStore — Class-Based Svelte 5 Rune Store

The module at `src/lib/stores/bounties.svelte.ts` SHALL export a singleton
`BountyListStore` class that bridges Applesauce `EventStore` RxJS Observables to
Svelte 5 runes. The file MUST use the `.svelte.ts` extension to enable rune
syntax.

The store MUST use `$state` for mutable reactive fields and MUST NOT use legacy
Svelte stores (`writable()`, `readable()`, `derived()`).

```typescript
class BountyListStore {
  #items: BountySummary[]; // $state
  #loading: boolean; // $state
  #error: string | null; // $state

  get items(): BountySummary[];
  get loading(): boolean;
  get error(): string | null;
  get popular(): BountySummary[]; // sorted by totalPledged descending
}

export const bountyList: BountyListStore;
```

#### Scenario: Store initializes with loading state

- **WHEN** the `BountyListStore` is first instantiated
- **THEN** `loading` MUST be `true`, `items` MUST be `[]`, and `error` MUST be
  `null`

#### Scenario: Store receives events from EventStore timeline

- **WHEN** the `EventStore.timeline()` Observable emits an array of Kind 37300
  events
- **THEN** `items` MUST be updated with `BountySummary` objects parsed via
  `parseBountySummary()`
- **AND** `loading` MUST transition to `false`

#### Scenario: Store handles subscription errors

- **WHEN** the `EventStore.timeline()` Observable emits an error
- **THEN** `error` MUST be set to the error message string
- **AND** `loading` MUST transition to `false`

#### Scenario: Popular bounties sorted by total pledged

- **WHEN** `popular` is accessed
- **THEN** it MUST return a copy of `items` sorted by `totalPledged` in
  descending order (highest first)

#### Scenario: Singleton export

- **WHEN** `bountyList` is imported from multiple modules
- **THEN** the same instance MUST be returned (singleton pattern)

---

### Requirement: BountyDetailStore — Class-Based Svelte 5 Rune Store

The module at `src/lib/stores/bounty-detail.svelte.ts` SHALL export a class
`BountyDetailStore` that manages the full detail view for a single bounty,
including its pledges, solutions, votes, and payout. The file MUST use the
`.svelte.ts` extension.

The store MUST subscribe to multiple EventStore queries (one per related event
kind) and compose them into a `BountyDetail` object. The store MUST use `$state`
for all reactive fields.

```typescript
class BountyDetailStore {
  #bounty: BountyDetail | null; // $state
  #loading: boolean; // $state
  #error: string | null; // $state

  get bounty(): BountyDetail | null;
  get loading(): boolean;
  get error(): string | null;

  load(bountyAddress: string, kind: number, pubkey: string, dTag: string): void;
  destroy(): void;
}
```

#### Scenario: Store loads bounty by address

- **WHEN** `load("37300:pubkey:bounty-1", 37300, "pubkey", "bounty-1")` is
  called
- **THEN** the store MUST initiate subscriptions for the bounty event, its
  pledges (Kind 73002), solutions (Kind 73001), votes (Kind 1018), and payouts
  (Kind 73004) filtered by the bounty address

#### Scenario: Store composes BountyDetail from related events

- **WHEN** events arrive for a bounty and its pledges, solutions, and votes
- **THEN** `bounty` MUST be a `BountyDetail` object with `pledges`, `solutions`,
  `votesBySolution`, and `payout` populated from the received events

#### Scenario: Status is derived, not stored

- **WHEN** the `BountyDetail` is composed
- **THEN** `status` MUST be computed by calling `deriveBountyStatus()` with the
  raw events — it MUST NOT be read from a tag on the bounty event

#### Scenario: Store cleans up on destroy

- **WHEN** `destroy()` is called
- **THEN** all relay subscriptions initiated by `load()` MUST be unsubscribed
- **AND** no further state updates MUST occur

#### Scenario: Loading a new bounty replaces the previous

- **WHEN** `load()` is called while a previous bounty is loaded
- **THEN** the previous subscriptions MUST be destroyed before new ones are
  created
- **AND** `loading` MUST reset to `true`

#### Scenario: VotesBySolution grouping

- **WHEN** votes arrive for multiple solutions of the same bounty
- **THEN** `votesBySolution` MUST be a `Map<string, Vote[]>` keyed by solution
  event ID

---

### Requirement: No Legacy Svelte Stores

All reactive store files in `src/lib/stores/` MUST use Svelte 5 runes (`$state`,
`$derived`, `$effect`) exclusively. The following patterns MUST NOT appear in
any store file:

- `import { writable } from 'svelte/store'`
- `import { readable } from 'svelte/store'`
- `import { derived } from 'svelte/store'`
- `$:` reactive declarations
- `$$props` or `$$restProps`

#### Scenario: No legacy imports in store files

- **WHEN** any `.svelte.ts` file in `src/lib/stores/` is inspected
- **THEN** it MUST NOT contain imports from `'svelte/store'`

#### Scenario: Rune syntax is used for reactivity

- **WHEN** a store class declares a reactive field
- **THEN** it MUST use `$state()` or `$derived()` rune syntax
