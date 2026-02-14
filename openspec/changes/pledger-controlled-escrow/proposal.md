## Why

The current escrow model locks pledge tokens (NUT-11 P2PK) to the bounty
creator's pubkey. This creates a critical rug-pull vulnerability: the creator
can swap pledged tokens at the mint at any time, bypassing the voting process
entirely. The Cashu mint only enforces P2PK signatures — it has no knowledge of
bounty logic, voting outcomes, or solver identity.

NUT-11 multisig cannot solve this without a trusted arbiter, because:

1. The solver is unknown at pledge time — they cannot be included in the
   multisig.
2. Each pledger is different — a single multisig config cannot represent all
   pledgers.
3. P2PK spending conditions are fixed per-proof at creation time and cannot be
   modified retroactively.

The solution is pledger-controlled escrow: each pledger locks tokens to their
**own** pubkey (self-custody). After 66% vote consensus, each pledger
individually releases their portion directly to the solver. The creator never
controls pledge funds.

## What Changes

- Rewrite `src/lib/cashu/escrow.ts` to lock pledge tokens to the pledger's own
  pubkey instead of the creator's pubkey. The `createPledgeToken` function's
  lock target changes from `creatorPubkey` to `pledgerPubkey`.
- Add new escrow function `releasePledgeToSolver` for pledger-initiated release
  after consensus: swap self-locked proofs for solver-locked proofs.
- Simplify `reclaimExpiredPledge` — pledger already owns the key, so reclaim
  becomes a simple swap without needing a refund path.
- Remove `swapPledgeTokens` (creator-initiated swap) and
  `processMultiMintPayout` (creator-initiated multi-mint payout) — these are
  replaced by per-pledger release functions.
- Add new bounty statuses `consensus_reached` and `releasing` to
  `src/lib/bounty/types.ts` and `src/lib/bounty/state-machine.ts`.
- Update `parseBountyDetail` in `src/lib/bounty/helpers.ts` to support multiple
  payout events (one per pledger) instead of a single payout.
- Update `BountyDetail.payout: Payout | null` to
  `BountyDetail.payouts: Payout[]`.
- Update `parsePayout` to accept payouts from any pledger (not just the
  creator).
- Redesign `PayoutTrigger.svelte` from a creator-controlled payout dialog to a
  pledger-controlled "Release Funds" prompt shown to each pledger after
  consensus.
- Update `PledgeForm.svelte` to lock tokens to the current user's pubkey instead
  of the creator's pubkey.
- Update `SolverClaim.svelte` to aggregate multiple payout events.
- Update `VoteResults.svelte` to show release progress (X/Y pledgers released).
- Add pledger release status tracking to `BountyDetailView.svelte`.
- Rewrite all escrow tests and the payment pipeline integration test.
- Update `BountyStatusBadge.svelte` with new status configs.
- Update `blueprints.ts` — payoutBlueprint now used by pledgers (not creators).

## Capabilities

### Modified Capabilities

- `cashu-escrow`: Pledge tokens locked to pledger (self-custody) instead of
  creator. New `releasePledgeToSolver` function. Removal of creator-centric swap
  functions. Simplified reclaim (pledger already has key). PRD Section 14.5.
- `bounty-state-machine`: New statuses `consensus_reached` (vote quorum met,
  awaiting pledger releases) and `releasing` (at least one release in progress).
  `deriveBountyStatus` extended with vote tally awareness. PRD Section 14.5.4.
- `payout-flow`: Changed from single creator-initiated payout to per-pledger
  release. Multiple Kind 73004 events per bounty (one per releasing pledger).
  Total payout aggregated across events. PRD Section 6.6.
- `pledge-flow`: P2PK lock target changes from creator pubkey to pledger pubkey.
  PledgeForm UI updated. PRD Section 6.3.
- `bounty-detail`: `BountyDetail.payout` becomes `BountyDetail.payouts` (array).
  Multi-payout aggregation in UI. Release progress tracking.
- `bounty-components`: PayoutTrigger redesigned as pledger release prompt.
  SolverClaim handles multiple payouts. VoteResults shows release progress.
  BountyStatusBadge extended for new statuses.

### Removed Capabilities

- `creator-payout-orchestration`: The entire flow of creator collecting,
  swapping, and re-locking pledge tokens is removed. Functions:
  `swapPledgeTokens`, `processMultiMintPayout`, `encodeMultiMintPayoutTokens`,
  `checkPledgeProofsSpendable`.

## Impact

- **Rewritten files (~7)**: `src/lib/cashu/escrow.ts`,
  `src/lib/components/voting/PayoutTrigger.svelte`,
  `src/tests/unit/escrow.test.ts`,
  `src/tests/integration/payment-pipeline.test.ts`,
  `src/lib/bounty/state-machine.ts`, `src/lib/bounty/helpers.ts`,
  `src/lib/stores/bounty-detail.svelte.ts`
- **Significantly modified files (~8)**: `src/lib/bounty/types.ts`,
  `src/lib/cashu/types.ts`, `src/lib/bounty/blueprints.ts`,
  `src/lib/components/pledge/PledgeForm.svelte`,
  `src/lib/components/voting/SolverClaim.svelte`,
  `src/lib/components/voting/VoteResults.svelte`,
  `src/lib/components/bounty/BountyDetailView.svelte`,
  `src/lib/components/bounty/BountyStatusBadge.svelte`
- **Minor modifications (~8)**: `src/lib/components/pledge/ReclaimAlert.svelte`,
  `src/tests/unit/state-machine.test.ts`, `src/tests/unit/helpers.test.ts`,
  `src/tests/unit/blueprints.test.ts`,
  `src/tests/integration/pledge-flow.test.ts`,
  `src/tests/integration/bounty-store.test.ts`,
  `src/lib/stores/bounties.svelte.ts`,
  `src/lib/components/pledge/PledgeItem.svelte`
- **Unchanged files**: `src/lib/cashu/p2pk.ts`, `src/lib/bounty/voting.ts`,
  `src/lib/bounty/kinds.ts`, `src/lib/bounty/filters.ts`,
  `src/lib/components/pledge/PledgeButton.svelte`,
  `src/lib/components/voting/VoteButton.svelte`,
  `src/lib/components/voting/VoteProgress.svelte`,
  `src/lib/components/solution/SolutionForm.svelte`,
  `src/tests/unit/p2pk.test.ts`, `src/tests/unit/voting.test.ts`
- **Acceptance criteria**: Pledge tokens locked to pledger pubkey (never
  creator). After 66% vote consensus, pledgers can individually release funds to
  solver. Multiple Kind 73004 events aggregate to total payout. Pledgers who
  don't release suffer reputation impact but retain funds. Solver can claim
  tokens from each payout event. All existing tests updated, new tests for
  consensus/releasing statuses and per-pledger release flow.
