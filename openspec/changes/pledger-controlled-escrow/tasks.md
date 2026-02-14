# Pledger-Controlled Escrow — Tasks

## 1. Type Foundation

- [ ] 1.1 Update `BountyStatus` type in `src/lib/bounty/types.ts` — add
      `'consensus_reached'` and `'releasing'` to the union type. Full type:
      `'open' | 'in_review' | 'consensus_reached' | 'releasing' | 'completed' | 'expired' | 'cancelled'`.
- [ ] 1.2 Update `BountyDetail` interface in `src/lib/bounty/types.ts` — replace
      `payout: Payout | null` with `payouts: Payout[]`. Empty array means no
      payouts.
- [ ] 1.3 Update `EscrowState` type in `src/lib/cashu/types.ts` — change from
      `'locked' | 'claimed' | 'refunded' | 'expired'` to
      `'locked' | 'released' | 'reclaimed' | 'expired'`. Update JSDoc to reflect
      pledger-controlled semantics.
- [ ] 1.4 Remove unused types from `src/lib/cashu/types.ts` — remove
      `MultiMintPayoutResult` and `MintPayoutEntry` (used by the removed
      multi-mint orchestration functions). Keep `DecodedPledge`, `MintResult`,
      `SwapResult`, `TokenInfo`, `P2PKLockParams`, `DoubleSpendError`,
      `MintConnectionError`.

## 2. State Machine

- [ ] 2.1 Update `deriveBountyStatus` in `src/lib/bounty/state-machine.ts` — add
      `hasConsensus: boolean` parameter. New priority chain: cancelled >
      completed > expired > releasing > consensus_reached > in_review > open.
      `releasing` = payouts exist AND hasConsensus. `consensus_reached` =
      hasConsensus AND no payouts AND not expired. `completed` = payouts exist
      AND (NOT hasConsensus OR deadline passed). Note: for simplicity, any
      payout events = `releasing` when consensus active, `completed` when
      consensus not computable.
- [ ] 2.2 Update `src/tests/unit/state-machine.test.ts` — add tests for:
      `consensus_reached` status (hasConsensus=true, no payouts, not expired),
      `releasing` status (hasConsensus=true, some payouts exist), `completed`
      status (payouts exist), expired overrides consensus_reached (deadline
      passed, no payouts), cancelled still highest priority. Update all existing
      test calls to pass `hasConsensus: false` (backward compat).

## 3. Escrow Layer Rewrite

- [ ] 3.1 Rewrite `createPledgeToken` in `src/lib/cashu/escrow.ts` — rename
      `creatorPubkey` parameter to `pledgerPubkey`. Lock target is now the
      pledger's own pubkey. Remove `refundPubkey` parameter (no refund key
      needed — pledger is the primary key). Keep `locktime` parameter (bounty
      deadline). Update JSDoc to reflect pledger-controlled semantics.
- [ ] 3.2 Add `releasePledgeToSolver` function in `src/lib/cashu/escrow.ts` —
      new function that takes a `DecodedPledge`, `pledgerPrivkey: string`, and
      `solverPubkey: string`. Steps: (1) get wallet for pledge mint, (2) sign
      P2PK proofs with pledger's privkey, (3) swap at mint for fresh proofs, (4)
      re-lock fresh proofs to solver pubkey via P2PK, (5) return `MintResult`
      with solver-locked proofs. Handle `DoubleSpendError`. Handle fee
      deduction.
- [ ] 3.3 Simplify `reclaimExpiredPledge` → rename to `reclaimPledge` in
      `src/lib/cashu/escrow.ts` — remove refund path logic. Pledger already
      holds the primary P2PK key, so reclaim is a simple swap: sign proofs with
      pledger privkey, swap at mint for unlocked proofs. Update JSDoc.
- [ ] 3.4 Remove deprecated functions from `src/lib/cashu/escrow.ts` — delete:
      `swapPledgeTokens`, `processMultiMintPayout`,
      `encodeMultiMintPayoutTokens`, `checkPledgeProofsSpendable`,
      `groupPledgesByMint`. Keep: `createPledgeToken`, `releasePledgeToSolver`,
      `reclaimPledge`, `collectPledgeTokens`, `encodePayoutToken`.
- [ ] 3.5 Rewrite `src/tests/unit/escrow.test.ts` — full rewrite for
      pledger-controlled model. Test cases: - `createPledgeToken` locks to
      pledger pubkey (not creator) - `createPledgeToken` sets locktime from
      deadline - `createPledgeToken` rejects empty proofs, zero amount -
      `createPledgeToken` deducts fees correctly - `releasePledgeToSolver` swaps
      and re-locks to solver - `releasePledgeToSolver` handles double-spend -
      `releasePledgeToSolver` deducts mint fees - `reclaimPledge` returns
      unlocked proofs - `reclaimPledge` handles already-spent proofs -
      `collectPledgeTokens` extracts tokens from events - `collectPledgeTokens`
      skips invalid/missing tokens Remove all tests for deleted functions
      (swapPledgeTokens, processMultiMintPayout, etc.).

## 4. Helpers and Parsers

- [ ] 4.1 Update `parsePayout` in `src/lib/bounty/helpers.ts` — change
      authorization check from `taskCreatorPubkey?: string` to
      `pledgerPubkeys?: string[]`. Validate that `event.pubkey` is in the
      `pledgerPubkeys` set. If `pledgerPubkeys` is not provided, skip
      authorization (backward compat for loose parsing).
- [ ] 4.2 Update `parseBountyDetail` in `src/lib/bounty/helpers.ts` — (a)
      Extract pledger pubkeys from parsed pledges for payout authorization. (b)
      Pass `pledgerPubkeys` to `parsePayout` instead of `event.pubkey`. (c)
      Collect all valid payouts into `payouts: Payout[]` (not just first). (d)
      Compute `hasConsensus` from vote tally (import `computeVoteTally` from
      voting.ts) and pass to `deriveBountyStatus`. (e) Set `payouts` field on
      returned `BountyDetail`.
- [ ] 4.3 Update `src/tests/unit/helpers.test.ts` — update `parsePayout` tests:
      payout from pledger pubkey is valid, payout from non-pledger is rejected,
      payout without authorization check still parses. Update
      `parseBountyDetail` tests: multiple payouts aggregated, payouts array
      populated, status derived with consensus awareness.

## 5. Stores

- [ ] 5.1 Update `src/lib/stores/bounty-detail.svelte.ts` — change `payout`
      references to `payouts` array. Add derived `totalReleased` (sum of all
      payout amounts), `releasedPledgerCount` (unique pubkeys in payouts),
      `releaseProgress` (released / totalPledged as percentage). Update any
      status-dependent logic for new statuses.
- [ ] 5.2 Update `src/lib/stores/bounties.svelte.ts` — handle
      `consensus_reached` and `releasing` in any status filtering or display
      logic. Ensure list view shows appropriate status labels.

## 6. Component Updates — Pledge Side

- [ ] 6.1 Update `src/lib/components/pledge/PledgeForm.svelte` — change
      `createPledgeToken` call: pass `accountState.pubkey` (pledger's own
      pubkey) instead of `creatorPubkey` as the lock target. Pass bounty
      deadline as locktime. Remove `refundPubkey` argument. Update bearer
      instrument warning text: "Your tokens will be locked to your own key until
      the bounty deadline. After vote consensus, you will be asked to release
      them to the winning solver."
- [ ] 6.2 Update `src/lib/components/pledge/ReclaimAlert.svelte` — import
      `reclaimPledge` instead of `reclaimExpiredPledge` (renamed). Simplify
      messaging: pledger already owns the key, so reclaim is straightforward.
      Remove any refund key references.
- [ ] 6.3 Update `src/lib/components/pledge/PledgeItem.svelte` — optionally show
      release status per pledge (if this pledger has a corresponding Kind 73004
      event). Show "Released" badge next to pledges that have been released.

## 7. Component Updates — Payout Side

- [ ] 7.1 Redesign `src/lib/components/voting/PayoutTrigger.svelte` — full
      rewrite from creator-centric payout dialog to pledger-centric release
      prompt. New behavior: (a) Only visible when `consensus_reached` or
      `releasing` status. (b) For pledgers who haven't released: show "Release
      Funds to Solver" button with solver npub, pledge amount, irreversibility
      warning. (c) On click: nsec entry step (same UX pattern as current), then
      call `releasePledgeToSolver`, then publish Kind 73004 via
      `payoutBlueprint` + `publishEvent`. (d) For pledgers who have released:
      show "You have released X sats" confirmation. (e) For non-pledgers: show
      read-only release progress. (f) Remove all creator-centric logic:
      `processMultiMintPayout`, multi-mint summary, creator nsec flow.
- [ ] 7.2 Update `src/lib/components/voting/SolverClaim.svelte` — handle
      multiple payout events. Display aggregate total, list individual payouts
      with releasing pledger identity and amount. Show "X of Y pledgers released
      (Z% of funds)" progress. Provide claim instructions for each token.
- [ ] 7.3 Update `src/lib/components/voting/VoteResults.svelte` — after
      consensus is reached, show release progress below vote results: "Consensus
      reached — X of Y pledgers have released funds (Z%)". Aggregate payout
      amounts across Kind 73004 events.
- [ ] 7.4 Update `src/lib/components/bounty/BountyStatusBadge.svelte` — add
      configurations for `consensus_reached` (label: "Consensus Reached", Tokyo
      Night cyan) and `releasing` (label: "Releasing Funds", Tokyo Night
      yellow).

## 8. Bounty Detail View

- [ ] 8.1 Update `src/lib/components/bounty/BountyDetailView.svelte` — (a)
      Replace `payout` references with `payouts` array. (b) Show release
      progress section when status is `consensus_reached` or `releasing`. (c)
      Pass updated props to `PayoutTrigger` (pledger's own pledge, solver
      pubkey, release status). (d) Update payout summary to show aggregate of
      all releases. (e) Show per-pledger release breakdown if multiple pledgers.

## 9. Integration Tests

- [ ] 9.1 Rewrite `src/tests/integration/payment-pipeline.test.ts` — full
      rewrite for pledger-controlled pipeline. Test the complete flow: (a)
      Create bounty with deadline. (b) Pledger creates self-locked pledge token.
      (c) Verify token is locked to pledger pubkey (not creator). (d) Submit
      solution, cast votes to reach 66% consensus. (e) Pledger releases to
      solver via `releasePledgeToSolver`. (f) Verify Kind 73004 event published
      by pledger. (g) Verify solver can claim tokens. (h) Test multiple pledgers
      releasing independently. (i) Test partial release (some pledgers ghost).
      Remove all creator-centric pipeline tests.
- [ ] 9.2 Update `src/tests/integration/pledge-flow.test.ts` — update lock
      target assertions: verify pledge token is locked to pledger pubkey (not
      creator). Verify locktime matches bounty deadline. Remove refundPubkey
      assertions.
- [ ] 9.3 Update `src/tests/integration/bounty-store.test.ts` — add tests for
      `consensus_reached` and `releasing` status derivation in the store. Verify
      `payouts` array aggregation. Verify release progress computation.

## 10. Unit Test Updates

- [ ] 10.1 Update `src/tests/unit/blueprints.test.ts` — verify `payoutBlueprint`
      produces correct event structure (unchanged shape, but add a test that the
      pubkey in the event is a pledger pubkey, not necessarily the creator).
      Update test descriptions to reflect pledger-controlled semantics.
- [ ] 10.2 Update `src/tests/unit/tag-validator.test.ts` — minor description
      updates if any test descriptions reference creator-controlled payout.
      Verify Kind 73004 tag validation still works with pledger pubkeys.

## 11. Final Verification

- [ ] 11.1 Run `bun run test` — all unit and integration tests must pass (expect
      ~578+ tests with updates). Fix any regressions.
- [ ] 11.2 Run `bunx svelte-check --threshold error` — zero TypeScript or Svelte
      compilation errors.
- [ ] 11.3 Run `bun run build` — production build succeeds with no errors.
- [ ] 11.4 Manually verify the complete lifecycle in the UI: create bounty →
      pledge (self-locked) → submit solution → vote to consensus → pledger
      releases → solver sees payout. Verify all status badges display correctly.
