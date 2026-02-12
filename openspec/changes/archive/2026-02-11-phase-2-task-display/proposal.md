## Why

With the foundation in place (Phase 1), the application can connect to Nostr
relays but has no task-specific logic. Phase 2 (PRD Section 18) implements all
data models, tag parsing, state derivation, reactive stores, and the complete
read-only UI — the home page with task cards, task detail page, profile
page, and all shared display components. This makes the app useful for discovery
even before write operations exist.

## What Changes

- Define all TypeScript interfaces for task event kinds: Task, Pledge,
  Solution, Vote, Payout, TaskDetail, TaskSummary (PRD Section 6)
- Implement tag parsing helpers to extract typed data from raw Nostr event tags
- Implement task lifecycle state machine: `deriveTaskStatus()` with all
  state transitions (draft → open → in_review → completed, plus
  expired/cancelled side transitions)
- Implement linear weighted voting calculation: `calculateVoteWeight()`,
  `tallyVotes()` with quorum logic
- Build all Nostr filter functions for task queries (list, by-author,
  pledges/solutions/votes/payout by task address, NIP-50 search)
- Create Applesauce TimelineLoader and EventLoader instances for all event kinds
  (task, pledge, solution, vote, profile)
- Build reactive Svelte 5 class-based stores bridging RxJS Observables to runes:
  `TaskListStore`, `TaskDetailStore`
- Build all read-only UI components: TaskCard, TaskStatusBadge, TaskTags,
  TaskDetail, TaskTimer, PledgeList/PledgeItem, SolutionList/SolutionItem,
  VoteProgress, VoteResults
- Build shared components: SatAmount, TimeAgo, Markdown (sanitized), EmptyState,
  LoadingSpinner
- Implement home page with task card grid sorted by total pledged sats
- Implement task detail page at `/task/[naddr]` with naddr NIP-19 decoding
- Implement profile page at `/profile/[npub]` showing user's tasks and
  solutions
- Write unit tests for voting, state machine, helpers, and filters

## Capabilities

### New Capabilities

- `task-data-models`: TypeScript interfaces, event kind constants, tag parsing
  helpers for all 5 task event types (PRD Section 6)
- `task-state-machine`: Lifecycle state derivation from related events —
  draft/open/in_review/completed/expired/cancelled transitions (PRD Section
  10.1)
- `voting-system`: Linear weighted voting calculation with quorum threshold,
  vote deduplication, and tally aggregation (PRD Section 10.2)
- `nostr-filters`: Filter builder functions for all task-related queries
  including NIP-50 search (PRD Section 10.3)
- `event-loaders`: Applesauce TimelineLoader/EventLoader instances for task,
  pledge, solution, vote, and profile events (PRD Section 7)
- `reactive-stores`: Class-based Svelte 5 rune stores bridging Applesauce RxJS
  Observables — TaskListStore, TaskDetailStore (PRD Section 7.3)
- `task-display-components`: Read-only UI components for task cards, detail
  view, status badges, tags, timer, pledge/solution lists, vote progress (PRD
  Section 9)
- `shared-components`: SatAmount, TimeAgo, Markdown renderer, EmptyState,
  LoadingSpinner (PRD Section 9)
- `task-routes`: Home page with sorted task grid, task detail page with
  naddr routing, profile page with npub routing (PRD Section 8)

### Modified Capabilities

- `app-layout`: Header updated with navigation links to task pages
- `nostr-connectivity`: EventStore now receives task-specific event kinds via
  loader subscriptions

## Impact

- **New files**: ~40 files across `src/lib/task/`, `src/lib/nostr/loaders/`,
  `src/lib/stores/`, `src/lib/components/task/`, `src/lib/components/pledge/`,
  `src/lib/components/solution/`, `src/lib/components/voting/`,
  `src/lib/components/shared/`, `src/routes/task/`, `src/routes/profile/`,
  `src/tests/unit/`
- **Modified files**: Home page (`+page.svelte`), root layout, Header component
- **Acceptance criteria** (from PRD Phase 2): Home page displays task cards
  sorted by pledged sats, task cards show
  title/status/tags/amount/solutions/time, clicking navigates to
  `/task/naddr1...`, detail page shows rendered markdown + pledges +
  solutions + votes, TaskStatusBadge reflects derived state, VoteProgress
  shows weighted tally, profile page works, all unit tests pass, loading/empty
  states shown
