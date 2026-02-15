# Retraction & Reputation — Tasks

## 1. Type Foundation

- [ ] 1.1 Add `RETRACTION_KIND = 73005` and `REPUTATION_KIND = 73006` to
      `src/lib/bounty/kinds.ts`.
- [ ] 1.2 Add `Retraction` interface to `src/lib/bounty/types.ts` — fields:
      `event`, `id`, `pubkey`, `taskAddress`, `type` (`"bounty" | "pledge"`),
      `pledgeEventId` (string | null), `reason` (string), `createdAt` (number),
      `hasSolutions` (boolean).
- [ ] 1.3 Add `ReputationEvent` interface to `src/lib/bounty/types.ts` — fields:
      `event`, `id`, `pubkey`, `offenderPubkey`, `taskAddress`, `type`
      (`"bounty_retraction" | "pledge_retraction"`), `retractionEventId`,
      `description`, `createdAt`.
- [ ] 1.4 Add `ReputationScore` interface to new file
      `src/lib/reputation/score.ts` — fields: `bountiesCompleted`,
      `pledgesReleased`, `totalPledges`, `releaseRate`, `solutionsAccepted`,
      `bountyRetractions`, `pledgeRetractions`, `tier`
      (`"new" | "emerging" | "established" | "trusted" | "flagged"`).

## 2. Parsing & Blueprints

- [ ] 2.1 Add `parseRetraction` to `src/lib/bounty/helpers.ts` — extract `a`
      tag (taskAddress), `type` tag, `e` tag (pledgeEventId, nullable), content
      (reason). Return `Retraction` or null on invalid.
- [ ] 2.2 Add `parseReputationEvent` to `src/lib/bounty/helpers.ts` — extract
      `p` tag (offenderPubkey), `a` tag (taskAddress), `type` tag, `e` tag
      (retractionEventId). Return `ReputationEvent` or null on invalid.
- [ ] 2.3 Add `retractionBlueprint` to `src/lib/bounty/blueprints.ts` — creates
      Kind 73005 event with tags: `["a", taskAddress]`,
      `["type", "bounty" | "pledge"]`, `["e", pledgeEventId]` (conditional),
      `["p", creatorPubkey]`, `["client", "bounty.ninja"]`. Content: reason.
- [ ] 2.4 Add `reputationBlueprint` to `src/lib/bounty/blueprints.ts` — creates
      Kind 73006 event with tags: `["p", offenderPubkey]`,
      `["a", taskAddress]`, `["type", "bounty_retraction" | "pledge_retraction"]`,
      `["e", retractionEventId]`, `["client", "bounty.ninja"]`. Content:
      human-readable description.
- [ ] 2.5 Add filter builders to `src/lib/bounty/filters.ts` —
      `retractionFilter(taskAddress)` returns `{ kinds: [73005], "#a": [taskAddress] }`.
      `reputationFilter(pubkey)` returns `{ kinds: [73006], authors: [pubkey] }`.
      `reputationByTargetFilter(pubkey)` returns `{ kinds: [73006], "#p": [pubkey] }`.

## 3. State Machine Update

- [ ] 3.1 Update `deriveBountyStatus` in `src/lib/bounty/state-machine.ts` —
      add `retractions: NostrEvent[]` parameter (default `[]`). Check for Kind
      73005 with `type=bounty` tag → return `"cancelled"`. Keep legacy Kind 5
      check as fallback. Priority: bounty retraction > Kind 5 delete > completed
      > expired > in_review > open > draft.
- [ ] 3.2 Update `src/tests/unit/state-machine.test.ts` — add tests: Kind 73005
      type=bounty triggers `cancelled`, Kind 73005 type=pledge does NOT trigger
      `cancelled`, legacy Kind 5 still works, retraction overrides other states.
      Update existing test calls to pass `retractions: []`.

## 4. Reputation Scoring

- [ ] 4.1 Implement `deriveReputation` in `src/lib/reputation/score.ts` —
      accepts `pubkey`, arrays of Kind 73004 (payouts), Kind 73006 (reputation
      events), Kind 73002 (pledges). Count: bounties completed (payouts where
      pubkey created the bounty), pledges released (payouts where pubkey is a
      pledger), solutions accepted (payouts where pubkey is solver),
      bounty/pledge retractions (Kind 73006 by type). Compute `releaseRate` =
      released / total pledges. Derive tier: `flagged` if retractions dominate
      (retractions > completions), `trusted` if ≥25 interactions and
      releaseRate > 0.95 and 0 bounty retractions, `established` if ≥10
      interactions and releaseRate > 0.90, `emerging` if ≥3 interactions and 0
      retractions, `new` otherwise.
- [ ] 4.2 Create `src/tests/unit/reputation.test.ts` — test cases: new user (0
      events) → `new` tier, user with 5 completions and 0 retractions →
      `emerging`, user with 15 completions → `established`, user with 30
      completions and perfect release rate → `trusted`, user with retraction
      after solutions → `flagged`, mixed history tiers correctly.

## 5. Reputation Store

- [ ] 5.1 Create `src/lib/stores/reputation.svelte.ts` — `ReputationStore`
      class with `#cache: Map<string, ReputationScore>`. Method:
      `getReputation(pubkey): ReputationScore | null` — returns cached score or
      triggers lazy fetch. On first access: subscribe to Kind 73006 and Kind
      73004 for the pubkey via relay pool. Recompute on new events. Export
      singleton `reputationStore`.

## 6. Bounty Detail Store Update

- [ ] 6.1 Update `src/lib/stores/bounty-detail.svelte.ts` — add subscription
      for Kind 73005 events referencing the bounty's `a` tag. Parse retractions
      via `parseRetraction`. Pass parsed retractions to `deriveBountyStatus`.
      Filter retracted pledges (Kind 73005 type=pledge with matching `e` tag)
      from the active pledge list. Expose `retractions` and `retractedPledgeIds`
      as derived state.

## 7. UI Components — Reputation

- [ ] 7.1 Create `src/lib/components/reputation/CredibilityBadge.svelte` —
      props: `pubkey: string`, `size: "sm" | "md"` (default "sm"). Reads from
      `reputationStore.getReputation(pubkey)`. Renders tier icon: `new` → no
      badge, `emerging` → 🌱, `established` → ✅, `trusted` → ⭐, `flagged` →
      ⚠️. Tooltip on hover shows tier name and key stats (e.g., "Established —
      12 completed, 95% release rate"). Use shadcn-svelte Tooltip component.
- [ ] 7.2 Update `src/lib/components/common/ProfileLink.svelte` — add optional
      `showReputation: boolean` prop (default `true`). When enabled, render
      `<CredibilityBadge pubkey={pubkey} />` inline after the display name.

## 8. UI Components — Retraction

- [ ] 8.1 Create `src/lib/components/bounty/RetractButton.svelte` — props:
      `taskAddress: string`, `hasSolutions: boolean`. Shows "Cancel Bounty"
      button. On click: if `hasSolutions`, show confirmation dialog warning
      about reputation impact ("This will publish a reputation event visible to
      all users. X solutions have been submitted."). On confirm: publish Kind
      73005 via `retractionBlueprint`, then if `hasSolutions` publish Kind 73006
      via `reputationBlueprint`. Only visible to bounty creator.
- [ ] 8.2 Create `src/lib/components/pledge/RetractPledgeButton.svelte` — props:
      `taskAddress: string`, `pledgeEventId: string`, `hasSolutions: boolean`.
      Shows "Retract Pledge" button. Same confirmation flow as RetractButton
      when solutions exist. On confirm: publish Kind 73005, optionally Kind
      73006, then call `reclaimPledge()` to reclaim tokens. Only visible to
      the pledge author.
- [ ] 8.3 Update `src/lib/components/bounty/BountyDetailView.svelte` — show
      `RetractButton` for bounty creator when status is not `completed` or
      `cancelled`. Show retraction history if retractions exist (list of Kind
      73005 events with timestamps and reasons). Integrate `CredibilityBadge`
      on creator identity in header.
- [ ] 8.4 Update `src/lib/components/pledge/PledgeItem.svelte` — show
      `RetractPledgeButton` for the pledge author. Show `CredibilityBadge` next
      to pledger name. Show "Retracted" badge if this pledge has a matching Kind
      73005 event.
- [ ] 8.5 Update `src/lib/components/solution/SolutionItem.svelte` — show
      `CredibilityBadge` next to solver name.
- [ ] 8.6 Update `src/lib/components/bounty/BountyCard.svelte` — show
      `CredibilityBadge` next to creator name in card header.

## 9. Profile Page Reputation

- [ ] 9.1 Add reputation section to profile page — query Kind 73006, Kind 73004,
      Kind 73002 for the profile pubkey. Display full `ReputationScore`
      breakdown: tier badge, bounties completed, pledges released, release rate,
      solutions accepted, retractions count. Show recent retraction history (if
      any) with links to the bounties involved.

## 10. Tests

- [ ] 10.1 Create `src/tests/unit/retraction.test.ts` — test `parseRetraction`:
      valid bounty retraction, valid pledge retraction, missing type tag
      rejected, missing `a` tag rejected, pledge retraction without `e` tag
      rejected. Test `retractionBlueprint`: correct kind, tags, content. Test
      `reputationBlueprint`: correct kind, tags, content.
- [ ] 10.2 Update `src/tests/unit/helpers.test.ts` — add tests for
      `parseRetraction` and `parseReputationEvent` integration with existing
      helper tests.
- [ ] 10.3 Update `src/tests/unit/state-machine.test.ts` — pass `retractions`
      parameter to all existing `deriveBountyStatus` calls (default `[]`). Add
      new tests per 3.2.
- [ ] 10.4 Create `src/tests/integration/retraction-flow.test.ts` — end-to-end
      retraction flow: (a) Create bounty, retract with no solutions → no Kind
      73006 published, status = cancelled. (b) Create bounty, submit solution,
      retract → Kind 73006 published, status = cancelled. (c) Create bounty,
      pledge, retract pledge with no solutions → pledge removed, no Kind 73006.
      (d) Create bounty, pledge, submit solution, retract pledge → Kind 73006
      published, pledge removed.

## 11. Final Verification

- [ ] 11.1 Run `bun run test` — all unit and integration tests pass.
- [ ] 11.2 Run `bunx svelte-check --threshold error` — zero errors.
- [ ] 11.3 Run `bun run build` — production build succeeds.
- [ ] 11.4 Manually verify: create bounty → retract (no solutions) → no
      reputation badge. Create bounty → submit solution → retract → reputation
      badge visible on profile. Credibility badges visible on bounty cards,
      detail page, pledge items, solution items.
