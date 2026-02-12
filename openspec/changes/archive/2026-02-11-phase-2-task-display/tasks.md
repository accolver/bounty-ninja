# Phase 2 — Task Display: Tasks

## 1. Data Models & Constants

- [x] 1.1 Verify/extend `src/lib/task/kinds.ts` — export `TASK_KIND`
      (37300), `SOLUTION_KIND` (73001), `PLEDGE_KIND` (73002), `VOTE_KIND`
      (1018), `PAYOUT_KIND` (73004) as named numeric constants
- [x] 1.2 Create `src/lib/task/types.ts` — define `TaskStatus` union type
      (`"draft" | "open" | "in_review" | "completed" | "expired" | "cancelled"`)
- [x] 1.3 In `src/lib/task/types.ts` — define `Task` interface with fields:
      `event` (NostrEvent), `id`, `dTag`, `pubkey`, `title`, `description`,
      `rewardAmount`, `rewardCurrency`, `tags` (string[]), `deadline` (number |
      null), `status`, `totalPledged`, `solutionCount`, `createdAt`, `mintUrl`
      (string | null), `submissionFee`
- [x] 1.4 In `src/lib/task/types.ts` — define `Pledge` interface with fields:
      `event`, `id`, `pubkey`, `taskAddress`, `amount`, `cashuToken`,
      `mintUrl`, `createdAt`, `message`
- [x] 1.5 In `src/lib/task/types.ts` — define `Solution` interface with
      fields: `event`, `id`, `pubkey`, `taskAddress`, `description`,
      `antiSpamToken`, `antiSpamAmount`, `deliverableUrl` (string | null),
      `createdAt`, `voteWeight`
- [x] 1.6 In `src/lib/task/types.ts` — define `Vote` interface with fields:
      `event`, `id`, `pubkey`, `taskAddress`, `solutionId`, `choice`
      (`"approve" | "reject"`), `pledgeAmount`, `weight`, `createdAt`
- [x] 1.7 In `src/lib/task/types.ts` — define `Payout` interface with fields:
      `event`, `id`, `pubkey`, `taskAddress`, `solutionId`, `solverPubkey`,
      `amount`, `cashuToken`, `createdAt`
- [x] 1.8 In `src/lib/task/types.ts` — define `TaskDetail` interface
      extending `Task` with `pledges`, `solutions`, `votesBySolution`
      (Map<string, Vote[]>), `payout` (Payout | null), `creatorProfile` (object
      | null)
- [x] 1.9 In `src/lib/task/types.ts` — define `TaskSummary` interface with
      `id`, `dTag`, `pubkey`, `title`, `tags`, `rewardAmount`, `totalPledged`,
      `solutionCount`, `status`, `createdAt`, `deadline` (must NOT include
      `event`, `description`, `mintUrl`, `submissionFee`)
- [x] 1.10 In `src/lib/task/types.ts` — define `VoteTally` interface with
      `approveWeight`, `rejectWeight`, `quorum`, `isApproved`, `isRejected`,
      `quorumPercent`

## 2. Tag Parsing Helpers

- [x] 2.1 Create `src/lib/task/helpers.ts` — implement
      `parseTaskSummary(event: NostrEvent): TaskSummary` extracting `d`,
      `title`/`subject`/content-first-line fallback, `reward`, `t` tags,
      `expiration`, and constructing NIP-33 address as
      `${pubkey}:${kind}:${dTag}`
- [x] 2.2 In `src/lib/task/helpers.ts` — implement
      `parsePledge(event: NostrEvent): Pledge` extracting `a` tag (task
      address), `amount`, `cashu`, `mint`, `p` tag, and `content` as message
- [x] 2.3 In `src/lib/task/helpers.ts` — implement
      `parseSolution(event: NostrEvent): Solution` extracting `a` tag,
      `cashu`/`fee` (anti-spam), `r` tag (deliverable URL), and `content` as
      description
- [x] 2.4 In `src/lib/task/helpers.ts` — implement
      `parseVote(event: NostrEvent): Vote` extracting `a` tag, `e` tag (solution
      ID), `vote` tag (choice), and looking up pledge amount
- [x] 2.5 In `src/lib/task/helpers.ts` — implement
      `parsePayout(event: NostrEvent): Payout` extracting `a` tag, `e` tag
      (solution ID), `p` tag (solver pubkey), `amount`, `cashu` token
- [x] 2.6 In `src/lib/task/helpers.ts` — implement
      `parseTaskDetail(event, pledges, solutions, votes, payouts, deleteEvents): TaskDetail`
      composing all parsed sub-events, grouping votes by solution ID into
      `Map<string, Vote[]>`, and calling `deriveTaskStatus()` for status
- [x] 2.7 Ensure all parsers handle missing/malformed tags defensively — return
      defaults (empty string, 0, null, []) instead of throwing

## 3. Task State Machine

- [x] 3.1 Create `src/lib/task/state-machine.ts` — implement
      `deriveTaskStatus(taskEvent, pledges, solutions, payouts, deleteEvents, now?): TaskStatus`
      with `now` defaulting to `Math.floor(Date.now() / 1000)`
- [x] 3.2 Implement priority order: cancelled (deleteEvents.length > 0) →
      completed (payouts.length > 0) → expired (expiration tag past `now`) →
      in_review (solutions.length > 0) → open (pledges.length > 0) → draft
      (fallback)
- [x] 3.3 Handle expiration edge cases: missing tag = never expires, malformed
      tag = never expires, completed task past deadline = still completed (not
      expired)

## 4. Voting System

- [x] 4.1 Create `src/lib/task/voting.ts` — implement
      `calculateVoteWeight(pledgeAmountSats: number): number` returning the
      pledge amount directly for positive values, `0` for zero/negative (linear
      weighting: 1 sat = 1 vote weight)
- [x] 4.2 In `src/lib/task/voting.ts` — implement
      `tallyVotes(votes, pledgesByPubkey, totalPledgedSats): VoteTally` with
      vote deduplication (latest per pubkey wins), non-pledger exclusion, linear
      weighting, quorum = `totalPledgedSats * 0.5`
- [x] 4.3 Implement `isApproved` (approveWeight > rejectWeight AND approveWeight
      >= quorum), `isRejected` (rejectWeight > approveWeight AND rejectWeight >=
      quorum), `quorumPercent` = `(max(approve, reject) / quorum) * 100`
- [x] 4.4 Handle edge cases: zero totalPledgedSats (quorum = 0, quorumPercent =
      0), tie (neither approved nor rejected), single funder as sole voter

## 5. Filter Builders

- [x] 5.1 Create `src/lib/task/filters.ts` — implement
      `taskListFilter(limit?: number): Filter` returning
      `{ kinds: [TASK_KIND], limit: limit ?? 50 }` using kind constants from
      `./kinds`
- [x] 5.2 In `src/lib/task/filters.ts` — implement
      `pledgesForTaskFilter(taskAddress: string): Filter` returning
      `{ kinds: [PLEDGE_KIND], "#a": [taskAddress] }`
- [x] 5.3 In `src/lib/task/filters.ts` — implement
      `solutionsForTaskFilter(taskAddress: string): Filter` returning
      `{ kinds: [SOLUTION_KIND], "#a": [taskAddress] }`
- [x] 5.4 In `src/lib/task/filters.ts` — implement
      `votesForTaskFilter(taskAddress: string): Filter` returning
      `{ kinds: [VOTE_KIND], "#a": [taskAddress] }`
- [x] 5.5 In `src/lib/task/filters.ts` — implement
      `payoutForTaskFilter(taskAddress: string): Filter` returning
      `{ kinds: [PAYOUT_KIND], "#a": [taskAddress] }`
- [x] 5.6 In `src/lib/task/filters.ts` — implement
      `taskByAuthorFilter(pubkey: string): Filter` returning
      `{ kinds: [TASK_KIND], authors: [pubkey] }`
- [x] 5.7 In `src/lib/task/filters.ts` — implement
      `searchTasksFilter(query: string, limit?: number): Filter` returning
      `{ kinds: [TASK_KIND], search: query, limit: limit ?? 20 }`
- [x] 5.8 Verify all filter functions import and use kind constants from
      `src/lib/task/kinds.ts` — no hardcoded numeric literals

## 6. Unit Tests — Domain Logic

- [x] 6.1 Create `src/tests/unit/helpers.test.ts` — test `parseTaskSummary`
      with all tags present, missing optional tags, title fallback chain (title
      → subject → content first line), malformed reward tag defaults to 0,
      NIP-33 address construction
- [x] 6.2 In `src/tests/unit/helpers.test.ts` — test `parsePledge` extracts
      task address from `a` tag, `parseSolution` extracts deliverable URL from
      `r` tag, `parseVote` extracts choice and solution reference
- [x] 6.3 In `src/tests/unit/helpers.test.ts` — test `parseTaskDetail`
      composes all sub-events, groups votes by solution ID, calls
      `deriveTaskStatus`
- [x] 6.4 Create `src/tests/unit/state-machine.test.ts` — test all six status
      values: draft (no pledges), open (pledges, no solutions), in_review (has
      solutions), completed (has payout), expired (past deadline, no payout),
      cancelled (delete event exists)
- [x] 6.5 In `src/tests/unit/state-machine.test.ts` — test priority order:
      cancelled beats completed, completed beats expired, expired beats
      in_review; test malformed expiration tag = never expires; test no
      expiration tag = never expires
- [x] 6.6 Create `src/tests/unit/voting.test.ts` — test `calculateVoteWeight`:
      10000 → 10000, 1 → 1, 0 → 0, negative → 0, arbitrary value returns same
      value
- [x] 6.7 In `src/tests/unit/voting.test.ts` — test `tallyVotes`: unanimous
      approval meets quorum, approval below quorum, reject outweighs approve,
      non-pledger votes ignored, duplicate votes (latest wins), zero
      totalPledgedSats, single funder sole voter, tie (neither approved nor
      rejected), quorumPercent calculation
- [x] 6.8 Create `src/tests/unit/filters.test.ts` — test all seven filter
      functions return correct `Filter` objects with proper kinds, `#a` tags,
      `authors`, `search` fields, and default/custom limits

## 7. Event Loaders

- [x] 7.1 Create `src/lib/nostr/loaders/task-loader.ts` — export a
      function/factory creating an Applesauce `TimelineLoader` for Kind 37300
      events using the singleton `RelayPool` and `EventStore`; must be
      unsubscribable
- [x] 7.2 Create `src/lib/nostr/loaders/pledge-loader.ts` — export
      `createPledgeLoader(taskAddress: string): Subscription` for Kind 73002
      events filtered by `#a` tag; adds events to singleton `EventStore`
- [x] 7.3 Create `src/lib/nostr/loaders/solution-loader.ts` — export
      `createSolutionLoader(taskAddress: string): Subscription` for Kind 73001
      events filtered by `#a` tag; adds events to singleton `EventStore`
- [x] 7.4 Create `src/lib/nostr/loaders/vote-loader.ts` — export
      `createVoteLoader(taskAddress: string): Subscription` for Kind 1018
      events filtered by `#a` tag; adds events to singleton `EventStore`
- [x] 7.5 Create `src/lib/nostr/loaders/profile-loader.ts` — export
      `createProfileLoader(pubkeys: string[]): Subscription` for Kind 0 events
      filtered by `authors`; adds events to singleton `EventStore`
- [x] 7.6 Ensure all loaders return unsubscribable objects; verify no
      subscription leaks on cleanup

## 8. Reactive Stores

- [x] 8.1 Create `src/lib/stores/tasks.svelte.ts` — implement
      `TaskListStore` class with `$state` fields (`#items`, `#loading`,
      `#error`), getters (`items`, `loading`, `error`, `popular`), subscribing
      to `EventStore.timeline()` for Kind 37300 events
- [x] 8.2 In `TaskListStore` — parse incoming events via
      `parseTaskSummary()`, set `loading = false` on first emission, set
      `error` on Observable error
- [x] 8.3 In `TaskListStore` — implement `popular` getter returning items
      sorted by `totalPledged` descending
- [x] 8.4 Export singleton `taskList` instance from
      `src/lib/stores/tasks.svelte.ts`
- [x] 8.5 Create `src/lib/stores/task-detail.svelte.ts` — implement
      `TaskDetailStore` class with `$state` fields (`#task`, `#loading`,
      `#error`), getters (`task`, `loading`, `error`)
- [x] 8.6 In `TaskDetailStore` — implement
      `load(taskAddress, kind, pubkey, dTag)` that initiates subscriptions for
      task, pledges, solutions, votes, and payouts; composes `TaskDetail`
      via `parseTaskDetail()`
- [x] 8.7 In `TaskDetailStore` — implement `destroy()` that unsubscribes all
      relay subscriptions; ensure `load()` calls `destroy()` first if a previous
      task was loaded
- [x] 8.8 Verify no legacy Svelte store imports (`writable`, `readable`,
      `derived`) or `$:` syntax in any `.svelte.ts` store file

## 9. Shared Components

- [x] 9.1 Create `src/lib/components/shared/LoadingSpinner.svelte` — accept
      optional `size: "sm" | "md" | "lg"` prop via `$props()` defaulting to
      `"md"`; include `role="status"` and `aria-label="Loading"`; respect
      `prefers-reduced-motion`
- [x] 9.2 Create `src/lib/components/shared/EmptyState.svelte` — accept
      `message: string` and optional `icon`/`action` props via `$props()`; use
      `--muted-foreground` color; render action button/link if provided
- [x] 9.3 Create `src/lib/components/shared/SatAmount.svelte` — accept
      `amount: number` via `$props()`; format with locale-aware thousand
      separators (`Intl.NumberFormat` or equivalent); append "sats" label; use
      `--accent` color token
- [x] 9.4 Create `src/lib/components/shared/TimeAgo.svelte` — accept
      `timestamp: number` via `$props()`; render relative time string ("just
      now", "2 hours ago", "3 days ago"); wrap in `<time datetime="...">`
      element with ISO 8601 string
- [x] 9.5 Create `src/lib/components/shared/Markdown.svelte` — accept
      `content: string` via `$props()`; install markdown parser (e.g., `marked`)
      and sanitizer (e.g., `DOMPurify`); parse → sanitize → render via
      `{@html}`; strip `<script>`, event handlers, `javascript:` URLs,
      `<iframe>`; add `target="_blank" rel="noopener noreferrer"` to links

## 10. Task Display Components

- [x] 10.1 Create `src/lib/components/task/TaskStatusBadge.svelte` — accept
      `status: TaskStatus` via `$props()`; map to colors (draft→`--muted`,
      open→`--success`, in_review→`--warning`, completed→`--primary`,
      expired→`--destructive`, cancelled→`--destructive`); display
      human-readable text ("In Review" not "in_review"); include `aria-label`
- [x] 10.2 Create `src/lib/components/task/TaskTags.svelte` — accept
      `tags: string[]` via `$props()`; render horizontal list of tag pills;
      render nothing when array is empty
- [x] 10.3 Create `src/lib/components/task/TaskTimer.svelte` — accept
      `deadline: number | null` via `$props()`; show countdown ("Xd Xh Xm") for
      future deadlines, "Expired" with `--destructive` for past deadlines,
      nothing/no-deadline text for null; update at least every 60 seconds
- [x] 10.4 Create `src/lib/components/task/TaskCard.svelte` — accept
      `TaskSummary` via `$props()`; compose `TaskStatusBadge`, `TaskTags`,
      `SatAmount`, `TimeAgo`; display title (2-line clamp), solution count,
      reward amount; wrap in `<a>` linking to `/task/{naddr}` (encode via
      `nip19.naddrEncode()`); ensure keyboard accessibility with visible focus
      ring
- [x] 10.5 Create `src/lib/components/task/TaskDetail.svelte` — accept
      `TaskDetail` via `$props()`; compose `TaskStatusBadge`, `Markdown`
      (description), `TaskTags`, `TaskTimer`, `SatAmount` (pledged +
      reward), creator profile link to `/profile/{npub}`, `PledgeList`,
      `SolutionList`, `VoteResults` (if completed); show `EmptyState` for empty
      pledges/solutions

## 11. Pledge Components

- [x] 11.1 Create `src/lib/components/pledge/PledgeItem.svelte` — accept
      `Pledge` via `$props()`; display funder pubkey (truncated npub or profile
      name), `SatAmount` for pledge amount, `TimeAgo` for creation time,
      optional message
- [x] 11.2 Create `src/lib/components/pledge/PledgeList.svelte` — accept
      `pledges: Pledge[]` via `$props()`; render each pledge as `PledgeItem`;
      show `EmptyState` when array is empty

## 12. Solution Components

- [x] 12.1 Create `src/lib/components/solution/SolutionItem.svelte` — accept
      `Solution` and `votes: Vote[]` via `$props()`; display solver pubkey,
      `Markdown` (description, sanitized), deliverable URL as `target="_blank"`
      link, `TimeAgo`, `VoteProgress` with computed tally
- [x] 12.2 Create `src/lib/components/solution/SolutionList.svelte` — accept
      `solutions: Solution[]` and `votesBySolution: Map<string, Vote[]>` via
      `$props()`; render each solution as `SolutionItem` passing its votes; show
      `EmptyState` when empty

## 13. Voting Components

- [x] 13.1 Create `src/lib/components/voting/VoteProgress.svelte` — accept
      `VoteTally` via `$props()`; render progress bar (approve vs reject weight
      ratio), weight numbers, quorum threshold indicator,
      approved/rejected/pending status text with appropriate color tokens
- [x] 13.2 Create `src/lib/components/voting/VoteResults.svelte` — accept
      winning solution and payout info via `$props()`; display which solution
      won, solver pubkey/name, payout amount

## 14. Home Page Route

- [x] 14.1 Update `src/routes/+page.ts` — ensure `export const ssr = false` and
      `export const prerender = false`
- [x] 14.2 Update `src/routes/+page.svelte` — import and consume singleton
      `taskList` from `src/lib/stores/tasks.svelte.ts`; show
      `LoadingSpinner` while `taskList.loading`, `EmptyState` when items
      empty, responsive grid of `TaskCard` components (1 col mobile, 2 col
      tablet, 3 col desktop) sorted by `totalPledged` descending via
      `taskList.popular`

## 15. Task Detail Route

- [x] 15.1 Create `src/routes/task/[naddr]/+page.ts` — decode `params.naddr`
      via `nip19.decode()`, validate type is `"naddr"`, extract
      kind/pubkey/identifier/relays, return task address; throw 400 for wrong
      NIP-19 type, 404 for decode failure; set `ssr = false`,
      `prerender = false`
- [x] 15.2 Create `src/routes/task/[naddr]/+page.svelte` — instantiate
      `TaskDetailStore`, call `load()` with decoded data from load function;
      show `LoadingSpinner` while loading, error message on error,
      `TaskDetail` component when data available; call `destroy()` on
      component teardown (via `$effect` cleanup or `onDestroy`)

## 16. Profile Route

- [x] 16.1 Create `src/routes/profile/[npub]/+page.ts` — decode `params.npub`
      via `nip19.decode()`, validate type is `"npub"`, extract hex pubkey; throw
      400 for wrong type; set `ssr = false`, `prerender = false`
- [x] 16.2 Create `src/routes/profile/[npub]/+page.svelte` — fetch Kind 0
      profile metadata and Kind 37300 tasks by author; display avatar, name
      (fallback to truncated npub), list of `TaskCard` components; show
      loading and empty states

## 17. Navigation & Layout Updates

- [x] 17.1 Update `src/lib/components/layout/Header.svelte` — add navigation
      links to home page and any relevant task pages
- [x] 17.2 Install markdown parser and sanitizer dependencies —
      `bun add marked dompurify` (or chosen alternatives); add
      `@types/dompurify` if needed
