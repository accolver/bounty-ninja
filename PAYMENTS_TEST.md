# Manual Payment Testing Guide

How to test real Cashu payments (pledge, vote, payout, claim) on Bounty.ninja.

## Prerequisites

1. **Two browser profiles** (or browsers) — one for the bounty creator, one for the pledger/solver.
2. **NIP-07 extension** in each (e.g. Alby, nos2x, Nostr Connect). Each needs a different keypair.
3. **A Cashu wallet** that can produce tokens — [Minibits](https://www.minibits.cash/), [eNuts](https://www.enuts.cash/), or [Nutstash](https://nutstash.com/).
4. **Test sats** — use the testnut mint below, or fund from any Lightning wallet to a real mint.

### Testnet Mint

Use `https://testnut.cashu.space` for testing. It's a free testnet mint — tokens have no real value.

To get test tokens:
1. Open [Nutstash](https://nutstash.com/) or Minibits
2. Add mint: `https://testnut.cashu.space`
3. Use the mint's faucet or Lightning to mint test tokens
4. Copy the cashuA.../cashuB... token string

---

## Test 1: Pledge Flow (Funding a bounty)

**Actor**: Pledger (not the bounty creator)

1. Navigate to any open bounty's detail page.
2. Click **"Fund bounty"** button.
3. In the dialog, paste a Cashu token (cashuA... or cashuB...) into the textarea.
4. **Verify**:
   - Token amount appears in the green summary card below the textarea.
   - If wrong mint: red error "Token mint (...) does not match bounty mint".
   - If invalid token: red error "Invalid Cashu token — could not decode".
5. Optionally add a message.
6. Check the bearer instrument warning checkbox.
7. Click **"Pledge X sats"**.
8. **Verify**:
   - Toast: "Pledge of X sats submitted!"
   - Dialog closes.
   - Pledge appears in the Pledges list with your npub and the amount.
   - PledgeItem badge should show "Verified" (real mint check) after a moment.

### Edge Cases to Test

- Paste a token from the **wrong mint** — should show mint mismatch error.
- Paste garbage text — should show decode error.
- Paste a valid token, then clear it — summary card disappears, submit disabled.
- Submit same token twice (double-spend) — second attempt shows "Token has already been spent".
- Disconnect internet, try to submit — "Offline — cannot publish" on button.

---

## Test 2: Token Verification (Automatic)

**Actor**: Any viewer

1. Open a bounty with existing pledges.
2. Each PledgeItem runs background verification against the mint.
3. **Verify**: Badge transitions from spinner → "Verified" (green) or "Unverified" (yellow).
4. A spent token should show "Unverified".

---

## Test 3: Voting on Solutions

**Actor**: Pledger (someone who funded the bounty)

1. A solver must first submit a solution to the bounty.
2. As a pledger, click **"Approve"** or **"Reject"** on a solution.
3. **Verify**: Vote progress bar updates. Your vote weight is proportional to your pledge amount.
4. Once approval threshold (>50% of pledged sats) is reached:
   - Solution shows "Solution approved! Awaiting payout from bounty creator."

---

## Test 4: Payout Flow (Creator Pays Solver)

**Actor**: bounty creator

1. After a solution reaches consensus approval, the Payout section appears.
2. Click **"Trigger Payout"**.
3. **Step 1 — Confirm**: Review winning solution, solver npub, payout amount. Click **"Continue"**.
4. **Step 2 — Key Entry**:
   - Red security warning box explains the private key is used to sign P2PK proofs.
   - Enter your **nsec1...** or **hex private key** in the password field.
   - Background check shows "X of Y pledge tokens verified as spendable".
   - Click **"Sign & Send Payout"**.
5. **Step 3 — Processing**: Watch progress messages:
   - "Collecting pledge tokens..."
   - "Connecting to mint..."
   - "Unlocking pledge tokens..."
   - "Creating payout token for solver..."
   - "Publishing payout event..."
6. **Verify**:
   - Toast: "Payout of X sats sent to solver!"
   - Dialog closes.
   - Payout section updates to show the completed payout.

### Edge Cases to Test

- Enter an **invalid nsec** — error "Invalid key" shown, button disabled.
- Enter **wrong private key** (not matching creator pubkey) — mint swap fails, error toast.
- If pledges were already spent — "Pledge tokens have already been spent" error.
- Disconnect internet during processing — "Could not connect to the Cashu mint" error.

---

## Test 5: Solver Claim (Receiving Payment)

**Actor**: Winning solver

1. After the creator triggers payout, navigate to the bounty as the solver.
2. The SolverClaim component appears showing "You won! Claim your payout."
3. The Cashu token string is displayed.
4. **Copy the token** and import it into your Cashu wallet (Minibits / eNuts / Nutstash).
5. **Verify**: Wallet shows the received sats (minus mint fees from the two swaps).

---

## Test 6: Refund Path (Expired bounty)

**Actor**: Pledger

1. Create a bounty with a short deadline (e.g. 5 minutes from now for testing).
2. Fund it with a pledge.
3. Wait for the bounty to expire without a payout.
4. The P2PK locktime on the pledge tokens expires.
5. The pledger can now use their private key to reclaim the tokens from the mint.
   - This is done externally via a Cashu wallet that supports P2PK refund claims.

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
