## Why

The current cancellation mechanism uses Kind 5 delete events, which have two
critical problems: (1) relays can silently drop Kind 5 events, leaving no audit
trail, and (2) there is no distinction between bounty cancellation and pledge
retraction — both are invisible. Additionally, the system has no reputation
mechanism to disincentivize bad behavior like cancelling bounties or retracting
pledges after solvers have already submitted work.

The solution is a dedicated retraction event kind (73005) for explicit audit
trail, an automatic reputation event kind (73006) published when retractions
occur after solutions exist, and a client-side credibility system that derives
reputation from on-chain events.

## What Changes

- Add Kind 73005 (Retraction Event) to `src/lib/bounty/kinds.ts` — used for
  both bounty cancellation by creator and pledge retraction by pledger. Tags
  include `["type", "bounty" | "pledge"]` to distinguish.
- Add Kind 73006 (Reputation Event) to `src/lib/bounty/kinds.ts` — published
  automatically when retraction occurs after solutions exist. Self-attestation
  model: signed by the retracting user's key.
- Add `Retraction` and `ReputationEvent` interfaces to
  `src/lib/bounty/types.ts`.
- Add `parseRetraction` and `parseReputationEvent` to
  `src/lib/bounty/helpers.ts`.
- Add `retractionBlueprint` and `reputationBlueprint` to
  `src/lib/bounty/blueprints.ts`.
- Update `deriveBountyStatus` in `src/lib/bounty/state-machine.ts` to accept
  `retractions: NostrEvent[]` parameter and check for Kind 73005 type=bounty
  retractions (alongside legacy Kind 5 support).
- Add `src/lib/bounty/filters.ts` — new filter builders for Kind 73005 and
  73006 queries.
- Create `src/lib/reputation/score.ts` — `deriveReputation()` function that
  computes `ReputationScore` from on-chain events (Kind 73004, 73006, 73002).
  Returns credibility tier: new, emerging, established, trusted, flagged.
- Create `src/lib/stores/reputation.svelte.ts` — reactive store that caches
  reputation scores per pubkey with lazy relay fetching.
- Update `src/lib/stores/bounty-detail.svelte.ts` — subscribe to Kind 73005
  events for the bounty, pass retractions to `deriveBountyStatus`, filter out
  retracted pledges from active pledge list.
- Create `src/lib/components/reputation/CredibilityBadge.svelte` — visual badge
  component showing tier icon (🌱/✅/⭐/⚠️) next to user identity.
- Update `src/lib/components/common/ProfileLink.svelte` — integrate
  `CredibilityBadge` to show reputation next to every pubkey display.
- Add `src/lib/components/bounty/RetractButton.svelte` — bounty cancellation
  button for creator, with confirmation dialog that warns about reputation
  impact when solutions exist.
- Add `src/lib/components/pledge/RetractPledgeButton.svelte` — pledge retraction
  button for pledger, with reputation impact warning.
- Update `src/lib/components/bounty/BountyDetailView.svelte` — show retraction
  UI for creator, show credibility badges on all user identities.
- Update `src/lib/components/pledge/PledgeItem.svelte` — show pledger
  credibility badge and retraction status.
- Update `src/lib/components/solution/SolutionItem.svelte` — show solver
  credibility badge.
- Update `src/lib/components/bounty/BountyCard.svelte` — show creator
  credibility badge.
- Add profile reputation section to profile page — full reputation breakdown.

## Capabilities

### New Capabilities

- `retraction-events`: Kind 73005 retraction event creation, parsing, and relay
  querying. Supports both bounty cancellation and pledge retraction with
  explicit type discrimination. PRD Section 6.7, 10.6.
- `reputation-events`: Kind 73006 reputation attestation event creation and
  parsing. Self-attestation model — published by the retracting user's own
  client. PRD Section 6.8, 10.7.
- `reputation-scoring`: Client-side reputation derivation from on-chain events.
  `deriveReputation()` computes scores and credibility tiers. Reactive store
  with lazy fetching. PRD Section 10.7.
- `credibility-ui`: Visual credibility indicators (badges/tiers) displayed
  throughout the application next to every pubkey. PRD Section 10.7.4.

### Modified Capabilities

- `bounty-state-machine`: `deriveBountyStatus` gains `retractions` parameter.
  Kind 73005 type=bounty triggers `cancelled`. Legacy Kind 5 still supported.
  PRD Section 10.1.
- `bounty-detail`: Store subscribes to Kind 73005 and 73006 events. Retracted
  pledges filtered from active list. Retraction history visible on detail page.
- `bounty-components`: BountyCard, BountyDetailView, PledgeItem, SolutionItem
  all gain credibility badge integration. New retraction buttons added.
- `profile-link`: ProfileLink extended with optional CredibilityBadge.
- `bounty-filters`: New filter builders for Kind 73005 and 73006.

## Impact

- **New files (~7)**: `src/lib/reputation/score.ts`,
  `src/lib/stores/reputation.svelte.ts`,
  `src/lib/components/reputation/CredibilityBadge.svelte`,
  `src/lib/components/bounty/RetractButton.svelte`,
  `src/lib/components/pledge/RetractPledgeButton.svelte`,
  `src/tests/unit/reputation.test.ts`,
  `src/tests/unit/retraction.test.ts`
- **Significantly modified files (~8)**: `src/lib/bounty/kinds.ts`,
  `src/lib/bounty/types.ts`, `src/lib/bounty/helpers.ts`,
  `src/lib/bounty/blueprints.ts`, `src/lib/bounty/state-machine.ts`,
  `src/lib/bounty/filters.ts`,
  `src/lib/stores/bounty-detail.svelte.ts`,
  `src/lib/components/common/ProfileLink.svelte`
- **Minor modifications (~6)**: `src/lib/components/bounty/BountyCard.svelte`,
  `src/lib/components/bounty/BountyDetailView.svelte`,
  `src/lib/components/pledge/PledgeItem.svelte`,
  `src/lib/components/solution/SolutionItem.svelte`,
  `src/tests/unit/state-machine.test.ts`,
  `src/tests/unit/helpers.test.ts`
- **Unchanged files**: `src/lib/cashu/escrow.ts`, `src/lib/cashu/p2pk.ts`,
  `src/lib/bounty/voting.ts`, `src/lib/components/voting/PayoutTrigger.svelte`,
  `src/lib/components/voting/VoteButton.svelte`
- **Acceptance criteria**: Kind 73005 retraction events published for bounty
  cancellation and pledge retraction. Kind 73006 reputation events auto-published
  when retracting with solutions present. Free retraction (no penalty) when no
  solutions exist. Credibility badges visible on bounty cards, detail page,
  pledge items, solution items, and profile pages. Reputation store lazily
  fetches and caches scores. State machine recognizes Kind 73005 for cancelled
  status. All existing tests updated, new tests for retraction parsing,
  reputation scoring, and credibility tier derivation.
