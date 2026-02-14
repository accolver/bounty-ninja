# Pledger-Controlled Escrow — Design Document

## Context

The current escrow model (implemented in Phase 3) locks pledge tokens to the
bounty creator's pubkey. The creator acts as a trusted escrow agent: they
collect all pledge tokens, swap them at the mint, and re-lock to the solver.
This model works but has a critical trust flaw — the creator can rug-pull by
spending pledge tokens at any time.

NUT-11 multisig was explored as a solution but cannot work for open bounties
with dynamic participants: the solver is unknown at pledge time, each pledger is
different, and P2PK spending conditions are immutable per-proof.

This change redesigns the escrow model so that pledgers lock tokens to **their
own pubkey** (self-custody). After vote consensus, each pledger individually
releases their portion to the solver. The creator never controls pledge funds.

## Goals

- Eliminate the rug-pull attack vector where a bounty creator can steal pledged
  funds by spending them at the mint.
- Maintain the 66% vote consensus mechanism as the coordination signal that
  triggers the release phase.
- Support per-pledger release flow: each pledger independently swaps their
  self-locked tokens for solver-locked tokens after consensus.
- Track release progress transparently: "X of Y pledgers released (Z% of
  funds)".
- Impose reputation consequences on pledgers who ghost after consensus.
- Simplify the reclaim flow: since pledgers own the P2PK key, reclaim after
  deadline is a straightforward swap with no refund path needed.
- Maintain multi-mint support (different pledges from different mints).

## Non-Goals

- **Automatic release on consensus**: This would require the pledger's private
  key to be available at the moment consensus is reached, which is impossible in
  a client-side app (the pledger may not have the page open). Future
  enhancement: pre-authorized release via signed swap instructions.
- **Reputation persistence**: Reputation scores are derived client-side from
  Kind 73004 events. No custom reputation event kind is introduced in this
  change. Post-MVP: consider a dedicated reputation event kind.
- **Push notifications**: Notifying pledgers via NIP-04 DMs when consensus is
  reached is deferred. For now, pledgers see the release prompt when they visit
  the bounty detail page.
- **Partial release approval**: A pledger releases all or none of their pledge.
  No mechanism for releasing a fraction of their locked tokens.

## Decisions

### 1. Pledge Tokens Locked to Pledger's Own Pubkey

**Decision**: When creating a pledge, the Cashu token is P2PK-locked to the
pledger's own hex pubkey — not the creator's. The pledger retains full custody
of their funds throughout the bounty lifecycle.

**Rationale**: Self-custody eliminates the rug-pull attack. No single party
(creator, other pledgers, platform) can spend the tokens without the pledger's
active cooperation. The trade-off (payout requires pledger participation) is
acceptable given the alternative (creator can steal funds).

**Flow**:

1. Pledger mints/receives Cashu proofs.
2. Pledger swaps proofs at mint for new proofs P2PK-locked to their own pubkey.
3. Locktime set to bounty deadline (from expiration tag).
4. Encoded token published in Kind 73002 `cashu` tag.
5. After consensus: pledger swaps self-locked proofs for solver-locked proofs.

**Alternative rejected**: Locking to creator with refund keys for pledger. Still
allows creator to spend before locktime expires.

### 2. Per-Pledger Release via Kind 73004

**Decision**: After vote consensus, each pledger publishes their own Kind 73004
payout event containing tokens P2PK-locked to the solver. Multiple Kind 73004
events exist per bounty — one for each releasing pledger.

**Rationale**: This is the natural consequence of pledger-controlled custody.
Each pledger signs their own swap at the mint, creating solver-locked tokens,
and publishes the result. The total payout is the aggregate of all Kind 73004
events.

**Change from previous model**: Previously, a single Kind 73004 was published by
the creator containing the full payout. Now, N Kind 73004 events are published
(one per pledger who releases).

**Impact on `parsePayout`**: The authorization check changes from "pubkey must
match bounty creator" to "pubkey must match a pledger for this bounty". The
`BountyDetail.payout` field becomes `BountyDetail.payouts: Payout[]`.

### 3. New Bounty Statuses: `consensus_reached` and `releasing`

**Decision**: Extend `BountyStatus` with two new statuses that sit between
`in_review` and `completed`:

- `consensus_reached`: Vote quorum (66%) met, no Kind 73004 events yet. All
  pledgers are prompted to release.
- `releasing`: At least one Kind 73004 payout event exists, but not all pledgers
  have released. Shows release progress.
- `completed`: Any payout events exist (conservative — we can't force all
  pledgers to release).

**Rationale**: The new statuses give users visibility into the post-vote phase.
Without them, the bounty would jump from `in_review` to `completed` with no
indication of the release process.

**Impact on `deriveBountyStatus`**: The function now needs access to the vote
tally to determine if consensus has been reached. New parameter:
`hasConsensus: boolean`. The priority chain becomes: cancelled > completed >
expired > releasing > consensus_reached > in_review > open.

**Decision on `completed` threshold**: A bounty transitions to `completed` when
any payout events exist. We cannot require all pledgers to release because some
may ghost. The "releasing" status shows progress. The UI displays "X% of funds
released" so the solver knows what to expect.

### 4. Simplified Reclaim Flow

**Decision**: Since pledgers lock tokens to their own pubkey, reclaim after the
bounty deadline is trivial — the pledger simply swaps their proofs at the mint
(they already hold the P2PK key). No refund path is needed.

**Rationale**: In the old model, the refund key was the pledger's key set as a
NUT-11 refund condition that activates after locktime. In the new model, the
pledger IS the primary key holder. After locktime, the proofs are still
spendable by the pledger (locktime doesn't restrict the primary key, only refund
keys). The pledger can reclaim at any time — the locktime merely serves as a
social signal ("this pledge is committed until deadline X").

**Simplification**: `reclaimExpiredPledge` no longer needs a `pledgerPrivkey`
parameter for signing refund paths. Instead, it's a standard swap using the
pledger's primary key.

### 5. Escrow Function Restructuring

**Decision**: Major restructuring of `src/lib/cashu/escrow.ts`:

| Old Function                                       | New Function                                                  | Change                                      |
| -------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------- |
| `createPledgeToken(proofs, creatorPubkey, ...)`    | `createPledgeToken(proofs, pledgerPubkey, ...)`               | Lock target: creator → pledger              |
| `swapPledgeTokens(pledges, wallet, privkey)`       | **REMOVED**                                                   | Creator no longer swaps                     |
| `processMultiMintPayout(pledges, privkey, solver)` | **REMOVED**                                                   | Creator no longer orchestrates              |
| `encodeMultiMintPayoutTokens(entries)`             | **REMOVED**                                                   | Single-pledger release instead              |
| `checkPledgeProofsSpendable(pledges, wallet)`      | **REMOVED**                                                   | Not needed for per-pledger flow             |
| —                                                  | `releasePledgeToSolver(pledge, pledgerPrivkey, solverPubkey)` | **NEW**: Per-pledger release                |
| `reclaimExpiredPledge(pledge, privkey)`            | `reclaimPledge(pledge, pledgerPrivkey)`                       | Simplified: no refund path needed           |
| `collectPledgeTokens(events)`                      | `collectPledgeTokens(events)`                                 | Unchanged                                   |
| `groupPledgesByMint(pledges)`                      | **REMOVED**                                                   | Not needed without multi-mint orchestration |
| `encodePayoutToken(proofs, mint)`                  | `encodePayoutToken(proofs, mint)`                             | Unchanged                                   |

### 6. PayoutTrigger Redesign

**Decision**: The `PayoutTrigger.svelte` component is redesigned from a
creator-only payout orchestration dialog to a pledger-facing "Release Funds"
prompt.

**Current behavior**: Only visible to the bounty creator. Creator enters nsec,
app collects all pledge tokens, swaps at mint, re-locks to solver, publishes
single Kind 73004.

**New behavior**: Visible to each pledger who has pledged to the bounty. After
consensus is reached, each pledger sees a "Release Funds to Solver" button.
Clicking it triggers: (1) swap self-locked proofs for solver-locked proofs at
the mint (using NIP-07 signing or nsec entry), (2) publish Kind 73004 with that
pledger's portion.

**Key UI changes**:

- No longer requires nsec entry if NIP-07 can sign P2PK proofs
- Shows release progress: "3 of 5 pledgers have released (72% of funds)"
- Non-pledgers and the creator see read-only release status
- Solver sees aggregate claim instructions

### 7. Vote Tally Awareness in State Machine

**Decision**: `deriveBountyStatus` gains a `hasConsensus` parameter to determine
whether vote quorum has been reached.

**Rationale**: The state machine previously didn't need to know about votes (it
only checked for solutions, payouts, deletes). With the new `consensus_reached`
and `releasing` statuses, it must know whether consensus exists.

**Implementation**: The caller (typically `parseBountyDetail` or the store)
computes the vote tally using existing `computeVoteTally` and passes
`hasConsensus = tally.isApproved` to `deriveBountyStatus`.

## Risks / Trade-offs

### 1. Payout Requires Active Pledger Participation

**Risk**: If pledgers don't visit the bounty page after consensus, the solver
doesn't get paid. Pledgers may ghost, go offline, or lose interest.

**Mitigation**: Prominent "Release Funds" UI prompt. Reputation scoring (release
rate displayed on profiles). Future: NIP-04 DM notifications to pledgers when
consensus is reached, and pre-authorized release (pledger signs a swap
instruction at pledge time that can be executed after consensus).

### 2. Solver May Not Receive 100% of Pledged Funds

**Risk**: If some pledgers ghost, the solver receives only the released portion.
This is worse UX than the old model where 100% payout was guaranteed (assuming
an honest creator).

**Mitigation**: Transparent "X% released" indicator visible to the solver.
Solver can see expected vs. actual payout before claiming. Reputation system
incentivizes pledgers to follow through. The bounty is marked `completed` with
partial payout rather than remaining in limbo.

### 3. More Complex UX

**Risk**: The release flow requires more user interaction than the old
single-click creator payout. Each pledger must take action.

**Mitigation**: Clear step-by-step release flow in the UI. Auto-dismiss prompts
once the pledger has released. Show the pledger their specific amount and the
solver's identity. Future: one-click pre-authorized release.

### 4. Multiple Kind 73004 Events Per Bounty

**Risk**: Query complexity increases. Instead of checking for one payout event,
the app must aggregate multiple. Relay load slightly increases.

**Mitigation**: The existing query pattern (filter by `a` tag and kind 73004)
already returns all matching events. Aggregation is a simple `reduce`. The
number of payout events equals the number of pledgers — typically small (< 50
for most bounties).

### 5. Private Key Handling for P2PK Swaps

**Risk**: NIP-07 extensions sign Nostr events, but Cashu P2PK swaps require
signing proof secrets with a raw private key. The app may need to ask for the
user's nsec to sign P2PK proofs, which conflicts with the "never handle private
keys" principle.

**Mitigation**: The current PayoutTrigger already handles this via an nsec entry
step. The same approach applies for pledger release. Longer term: explore
whether NIP-07 extensions can expose a signing API for non-event data (some
extensions like Alby support `signSchnorr`), or use NIP-46 remote signing for
P2PK operations.
