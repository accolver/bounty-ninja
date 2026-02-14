# Manual Payment Testing Guide

How to test real Cashu payments (pledge, vote, release, claim) on Bounty.ninja.

## Payment Model: Pledger-Controlled Escrow

Bounty.ninja uses a **pledger-controlled escrow** model. Key points:

- **Pledge tokens are P2PK-locked to the pledger's own pubkey** — not the bounty
  creator's. This eliminates the rug-pull risk where a creator could steal
  funds.
- After vote consensus (66%+ approval weighted by pledge amount), **each pledger
  individually releases** their portion to the winning solver.
- The bounty creator has no special role in the payout process.
- If a bounty expires without a payout, pledgers can **reclaim** their tokens
  directly using their own private key.

### Lifecycle

`open` → `in_review` (solutions submitted) → `consensus_reached` (66% approval)
→ `releasing` (pledgers releasing funds) → `completed` (all released or deadline
passed)

Side transitions: `expired`, `cancelled`

---

## Prerequisites

1. **Two browser profiles** (or browsers) — one for the pledger, one for the
   solver. Optionally a third for the bounty creator.
2. **NIP-07 extension** in each (e.g. Alby, nos2x, Nostr Connect). Each needs a
   different keypair.
3. **A Cashu wallet** that can produce tokens —
   [Minibits](https://www.minibits.cash/), [eNuts](https://www.enuts.cash/), or
   [Nutstash](https://nutstash.com/).
4. **Test sats** — use the testnut mint below, or fund from any Lightning wallet
   to a real mint.

### Testnet Mint

Use `https://testnut.cashu.space` for testing. It's a free testnet mint — tokens
have no real value.

To get test tokens:

1. Open [Nutstash](https://nutstash.com/) or Minibits
2. Add mint: `https://testnut.cashu.space`
3. Use the mint's faucet or Lightning to mint test tokens
4. Copy the cashuA.../cashuB... token string

---

## Test 1: Pledge Flow (Funding a bounty)

**Actor**: Pledger (any user, including the bounty creator)

1. Navigate to any open bounty's detail page.
2. Click **"Fund bounty"** button.
3. In the dialog, paste a Cashu token (cashuA... or cashuB...) into the
   textarea.
4. **Verify**:
   - Token amount appears in the green summary card below the textarea.
   - If wrong mint: red error "Token mint (...) does not match bounty mint".
   - If invalid token: red error "Invalid Cashu token — could not decode".
   - The warning text says tokens are locked to **your own key** (not the
     creator's).
5. Optionally add a message.
6. Check the bearer instrument warning checkbox.
7. Click **"Pledge X sats"**.
8. **Verify**:
   - Toast: "Pledge of X sats submitted!"
   - Dialog closes.
   - Pledge appears in the Pledges list with your npub and the amount.
   - PledgeItem badge should show "Verified" (real mint check) after a moment.
   - The token is P2PK-locked to **your** pubkey, not the creator's.

### Edge Cases to Test

- Paste a token from the **wrong mint** — should show mint mismatch error.
- Paste garbage text — should show decode error.
- Paste a valid token, then clear it — summary card disappears, submit disabled.
- Submit same token twice (double-spend) — second attempt shows "Token has
  already been spent".
- Disconnect internet, try to submit — "Offline — cannot publish" on button.

---

## Test 2: Token Verification (Automatic)

**Actor**: Any viewer

1. Open a bounty with existing pledges.
2. Each PledgeItem runs background verification against the mint.
3. **Verify**: Badge transitions from spinner → "Verified" (green) or
   "Unverified" (yellow).
4. A spent token should show "Unverified".

---

## Test 3: Voting on Solutions

**Actor**: Pledger (someone who funded the bounty)

1. A solver must first submit a solution to the bounty.
2. As a pledger, click **"Approve"** or **"Reject"** on a solution.
3. **Verify**: Vote progress bar updates. Your vote weight is proportional to
   your pledge amount.
4. Once approval threshold (66% of pledged sats) is reached:
   - Bounty status changes to **"Consensus Reached"** (cyan badge).
   - VoteResults shows "Consensus reached" with release progress.

---

## Test 4: Release Flow (Pledger Releases to Solver)

**Actor**: Pledger (each pledger individually)

This replaces the old creator-triggered payout. Each pledger releases their own
funds.

1. After a solution reaches 66% consensus approval, the **PayoutTrigger**
   section appears for pledgers who haven't released yet.
2. **Verify**: The prompt shows "Release Funds to Solver" with the solver's npub
   and your pledge amount.
3. Click **"Release Funds to Solver"**.
4. **Step 1 — Confirm**: Review the solver npub, your pledge amount, and the
   irreversibility warning. Click **"Continue"**.
5. **Step 2 — Key Entry**:
   - Red security warning box explains the private key is used to sign P2PK
     proofs.
   - Enter your **nsec1...** or **hex private key** in the password field.
   - Click **"Sign & Release"**.
6. **Step 3 — Processing**: Watch progress messages:
   - "Decoding pledge tokens..."
   - "Releasing token 1/N..."
   - "Publishing release event..."
7. **Verify**:
   - Toast: "Released X sats to solver!"
   - Dialog closes.
   - Your pledge now shows a **"Released"** badge in the Pledges list.
   - A Kind 73004 payout event is published under **your** pubkey (not the
     creator's).
   - VoteResults shows updated release progress: "X of Y pledgers have released
     funds (Z%)".
   - Bounty status changes to **"Releasing Funds"** (yellow badge) while
     releases are in progress.
   - Once all pledgers release (or deadline passes), status becomes
     **"Completed"**.

### Edge Cases to Test

- Enter an **invalid nsec** — error "Invalid key" shown, button disabled.
- Enter **wrong private key** (not matching your pledger pubkey) — mint swap
  fails, error toast.
- If your pledge tokens were already spent — "Tokens already spent" error.
- Disconnect internet during processing — "Could not connect to the Cashu mint"
  error.
- **Multiple pledgers**: Have two different pledgers fund the same bounty. After
  consensus, each must release independently. Verify that partial release shows
  correct progress (e.g. "1 of 2 pledgers released (60%)").
- **Ghosting pledger**: One pledger releases, the other doesn't. Bounty
  eventually completes when deadline passes. Solver receives partial funds.

### Non-Pledger View

- Users who are not pledgers see a read-only release progress indicator (no
  release button).
- The bounty creator has no special payout powers — they see the same view as
  any non-pledger.

---

## Test 5: Solver Claim (Receiving Payment)

**Actor**: Winning solver

1. After pledgers release their funds, navigate to the bounty as the solver.
2. The **SolverClaim** component appears showing individual release events.
3. **Verify**:
   - Shows aggregate total: "Total: X sats from Y pledgers".
   - Lists each pledger's release with their npub and amount.
   - Each release has a copyable Cashu token string.
4. **Copy each token** and import it into your Cashu wallet (Minibits / eNuts /
   Nutstash).
5. **Verify**: Wallet shows the received sats (minus mint fees from the swap).

### Differences from Old Model

- Solver may receive **multiple separate tokens** (one per pledger release), not
  a single combined token.
- Each token is independently claimable — the solver doesn't need to wait for
  all pledgers.

---

## Test 6: Reclaim Path (Expired bounty)

**Actor**: Pledger

1. Create a bounty with a short deadline (e.g. 5 minutes from now for testing).
2. Fund it with a pledge.
3. Wait for the bounty to expire without reaching consensus or payout.
4. The **ReclaimAlert** appears for pledgers with a message: "This bounty has
   expired. You can reclaim your pledge."
5. Click **"Reclaim Tokens"**.
6. Enter your **nsec1...** or **hex private key**.
7. Click **"Confirm Reclaim"**.
8. **Verify**:
   - Toast: "Reclaimed X sats!"
   - A Cashu token string appears that you can copy to your wallet.
   - The help text says "Your key is used locally to sign the reclaim and is
     never stored or transmitted."
9. Import the token into your Cashu wallet.

### Key Difference from Old Model

- Reclaim is straightforward because the tokens are locked to **your own key**.
  There is no refund key or creator involvement. You simply sign and swap at the
  mint.

### Edge Cases to Test

- Try to reclaim tokens that were already released to a solver — error: "Tokens
  already spent — they may have been released to a solver or reclaimed
  previously."
- Enter wrong private key — mint swap fails.

---

## Automated Tests

```bash
# Unit tests (escrow, token, p2pk, token-validator)
bunx vitest run src/tests/unit/escrow.test.ts
bunx vitest run src/tests/unit/token.test.ts
bunx vitest run src/tests/unit/p2pk.test.ts
bunx vitest run src/tests/unit/token-validator.test.ts

# Integration tests (pledge flow, full payment pipeline)
bunx vitest run src/tests/integration/pledge-flow.test.ts
bunx vitest run src/tests/integration/payment-pipeline.test.ts

# All payment-related tests at once
bunx vitest run --reporter=verbose src/tests/unit/escrow.test.ts src/tests/unit/token.test.ts src/tests/unit/p2pk.test.ts src/tests/unit/token-validator.test.ts src/tests/integration/pledge-flow.test.ts src/tests/integration/payment-pipeline.test.ts

# Type check
bun run check
```

### What the Automated Tests Cover

- **escrow.test.ts** (30 tests): `createPledgeToken` locks to pledger pubkey,
  `releasePledgeToSolver` swaps and re-locks to solver, `reclaimPledge` returns
  unlocked proofs, `collectPledgeTokens` extracts from events, fee deduction,
  error handling (double-spend, mint offline).
- **pledge-flow.test.ts** (9 tests): End-to-end pledge creation, verifies token
  locked to pledger pubkey (not creator), locktime matches deadline.
- **payment-pipeline.test.ts** (4 tests): Full lifecycle — pledge with
  self-lock, release to solver, payout event published by pledger, unauthorized
  payout rejection.
- **state-machine.test.ts** (27 tests): `consensus_reached` and `releasing`
  status derivation with `hasConsensus` parameter.
- **helpers.test.ts** (28 tests): `parsePayout` validates pubkey is in
  `pledgerPubkeys`, `parseBountyDetail` aggregates multiple payouts.
