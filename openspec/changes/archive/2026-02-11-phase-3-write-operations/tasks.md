# Phase 3: Write Operations — Tasks

## 1. Event Publishing Infrastructure

- [x] 1.1 Create `src/lib/bounty/blueprints.ts` with EventFactory blueprint
      functions for all five event kinds: Kind 37300 (bounty), Kind 73002
      (pledge), Kind 73001 (solution), Kind 1018 (vote), Kind 73004 (payout).
      Each blueprint must produce a valid unsigned event with correct `kind`,
      `tags` (including `["client", "tasks.fyi"]`), and `content` fields.
- [x] 1.2 Implement lazy `EventFactory` initialization in
      `src/lib/nostr/signer.svelte.ts` — factory created on first write
      operation using the NIP-07 signer from `applesauce-signers`, reused for
      all subsequent writes. Reject with "Sign in with a Nostr extension to
      continue" when no signer is present.
- [x] 1.3 Implement multi-relay broadcasting via the `RelayPool` from
      `src/lib/nostr/relay-pool.ts` — publish signed events to all connected
      relays, resolve as successful when at least one relay confirms (OK
      message), log partial failures to console.
- [x] 1.4 Implement optimistic local updates — insert signed events into
      `EventStore` via `eventStore.add(signed)` immediately after signing and
      before relay confirmation. Implement rollback (remove from `EventStore`)
      when all relays reject.
- [x] 1.5 Implement 30-second signer timeout — abort signing attempt and display
      toast "Signer timed out. Please try again." on timeout.

## 2. Cashu Payment Layer

- [x] 2.1 Create `src/lib/cashu/types.ts` with TypeScript types for token
      structures, P2PK lock parameters, escrow state, and mint interaction
      results. Align with `@cashu/cashu-ts` library types.
- [x] 2.2 Create `src/lib/cashu/mint.ts` with singleton `CashuMint` and
      `CashuWallet` initialization using `@cashu/cashu-ts`. Default mint URL
      from `PUBLIC_DEFAULT_MINT` env var. Lazy initialization on first Cashu
      operation. Support per-bounty mint override via `["mint", "<url>"]` tag.
      Implement 3-retry with 2-second delays on mint unreachable, toast "Mint
      unavailable. Try a different mint?" on total failure.
- [x] 2.3 Create `src/lib/cashu/token.ts` with token encoding/decoding utilities
      using `getEncodedToken()` and `getDecodedToken()` from `@cashu/cashu-ts`.
      All tokens must use Cashu v4 encoding (`cashuA...` prefix). Include total
      amount computation from proof set. Handle malformed tokens gracefully with
      "Invalid token" warning.
- [x] 2.4 Create `src/lib/cashu/p2pk.ts` with P2PK locking/unlocking helpers per
      NUT-11. Implement: lock tokens to a hex pubkey (for pledge escrow to
      creator), lock tokens to solver pubkey (for payout), and refund condition
      with locktime expiration.
- [x] 2.5 Create `src/lib/cashu/escrow.ts` with escrow operations: create
      P2PK-locked tokens for pledges, collect pledge tokens from Kind 73002
      events, swap/consolidate tokens at mint using creator's signing
      capability, create solver-locked payout tokens. Handle double-spend
      detection (toast "This token has already been claimed", exclude invalid
      pledge from payout total).

## 3. Toast Notifications

- [x] 3.1 Create `src/lib/stores/toast.svelte.ts` — singleton class-based store
      using `$state` for a reactive toast queue. Support
      `add(message, type, duration?)` method with types: "success" | "error" |
      "warning" | "info". Default duration 5000ms. Auto-dismiss after duration.
      Manual dismiss by id. Max 5 simultaneous toasts (oldest removed on
      overflow).
- [x] 3.2 Create `src/lib/components/shared/Toaster.svelte` — renders toast
      queue from the store. Fixed position bottom-right (desktop) /
      bottom-center (mobile). Stack vertically, newest at bottom. Style by type
      using Tokyo Night semantic tokens (`--success`, `--destructive`,
      `--warning`, `--primary`). Use `role="alert"` and `aria-live="polite"`.
      Dismiss button with `aria-label="Dismiss notification"`.
      Keyboard-dismissible via Escape. Respect `prefers-reduced-motion` for
      animations.

## 4. Error Boundaries

- [x] 4.1 Create `src/lib/components/shared/ErrorBoundary.svelte` — catches
      rendering errors in children, displays fallback UI ("Something went
      wrong" + "Try again" button). Uses `{@render children()}` for content
      projection. Accepts `fallback` (custom snippet) and `onError` (callback)
      props via `$props()`. Log errors to `console.error`. Use `role="alert"` on
      fallback container. "Try again" clears error state and re-renders
      children.

## 5. Bounty Creation

- [x] 5.1 Create `src/lib/components/bounty/BountyForm.svelte` — form
      collecting: title, markdown description, reward target (sats), category
      tags (repeatable), optional deadline, optional mint URL, optional
      submission fee (10–100 sats). All reactive state via `$state`/`$derived`.
      Validation: title required, reward > 0, fee within
      `PUBLIC_MIN_SUBMISSION_FEE`–`PUBLIC_MAX_SUBMISSION_FEE`, deadline must be
      future.
- [x] 5.2 Implement d-tag generation in `BountyForm.svelte` — URL-safe slug from
      title + random suffix (e.g., `lightning-vending-machine-a1b2c3`) for
      NIP-33 uniqueness.
- [x] 5.3 Wire BountyForm submission to blueprints + EventFactory: construct
      Kind 37300 event with required tags (`d`, `title`, `reward`, `client`) and
      conditional optional tags (`t`, `expiration`, `mint`, `fee`), content =
      markdown description. Sign via NIP-07, optimistic insert into EventStore,
      publish to relays, success toast "Bounty created!".
- [x] 5.4 Implement post-creation navigation — encode new bounty's NIP-33
      address as `naddr` via `nip19.naddrEncode()` from `nostr-tools`, navigate
      to `/bounty/<naddr>` using SvelteKit `goto()`.
- [x] 5.5 Create `src/routes/bounty/new/+page.svelte` — renders `BountyForm` for
      authenticated users. Show "Sign in with a Nostr extension to create a
      bounty" prompt with `LoginButton` for unauthenticated users.

## 6. Pledge Flow

- [x] 6.1 Create `src/lib/components/pledge/PledgeButton.svelte` — "Fund this
      bounty" CTA on bounty detail page. Opens PledgeForm dialog when clicked by
      authenticated user. Shows sign-in prompt for unauthenticated users.
      Disabled with tooltip "This bounty is no longer accepting pledges" when
      bounty status is `completed`, `expired`, or `cancelled`.
- [x] 6.2 Create `src/lib/components/pledge/PledgeForm.svelte` — dialog/modal
      collecting pledge amount (sats) and optional message. Validation: amount ≥
      1 sat, must be whole number. Display bearer instrument warning "Cashu
      tokens are like cash. Once sent, they cannot be reversed. Ensure you trust
      this bounty creator." — user must acknowledge before submit activates.
      Enforce single-mint per bounty (reject if mint mismatch).
- [x] 6.3 Wire PledgeForm submission: create P2PK-locked Cashu token via
      `src/lib/cashu/escrow.ts` (locked to bounty creator's pubkey), construct
      Kind 73002 event with required tags (`a`, `p`, `amount`, `cashu`, `mint`,
      `client`) and optional content (funder message), sign via NIP-07,
      optimistic insert, publish to relays, success toast "Pledge of N sats
      submitted!", close dialog.
- [x] 6.4 Verify bounty status transitions reactively — first pledge on a
      `draft` bounty transitions derived status to `open`, `BountyStatusBadge`
      updates, `totalPledged` updates immediately in UI.

## 7. Solution Submission

- [x] 7.1 Create `src/lib/components/solution/SolutionForm.svelte` — form
      collecting: markdown description (proof of work), optional deliverable
      URL, anti-spam fee payment. Visible only when bounty status is `open` or
      `in_review` and user is authenticated. Show "Sign in with a Nostr
      extension to submit a solution" for unauthenticated users. Hidden for
      `draft`, `completed`, `expired`, `cancelled` statuses.
- [x] 7.2 Implement anti-spam fee validation in SolutionForm — if bounty has
      `["fee", "<sats>"]` tag, require exact amount; otherwise default to
      `PUBLIC_MIN_SUBMISSION_FEE` (10 sats), allow increase up to
      `PUBLIC_MAX_SUBMISSION_FEE` (100 sats). Validate: description required,
      deliverable URL valid if provided, fee within range.
- [x] 7.3 Wire SolutionForm submission: create plain (non-P2PK-locked) Cashu
      token for anti-spam fee, construct Kind 73001 event with required tags
      (`a`, `p`, `cashu`, `client`) and optional `r` tag (deliverable URL),
      content = markdown description, sign via NIP-07, optimistic insert,
      publish to relays, success toast "Solution submitted!".
- [x] 7.4 Verify bounty status transitions — first solution on an `open` bounty
      transitions derived status to `in_review`, `BountyStatusBadge` updates,
      `solutionCount` increments.

## 8. Vote Casting

- [x] 8.1 Create `src/lib/components/voting/VoteButton.svelte` — renders
      "Approve" and "Reject" buttons per solution. Enabled for authenticated
      users who have pledged (checked via Kind 73002 events in EventStore).
      Disabled with tooltip "Only funders can vote" for non-pledgers. Disabled
      with tooltip "Sign in and fund this bounty to vote" for unauthenticated
      users. Display vote weight (`totalPledgeAmount`) for eligible voters.
      Highlight active vote state. Allow vote change (publish new Kind 1018).
- [x] 8.2 Implement voting eligibility enforcement — check EventStore for Kind
      73002 pledge events matching voter's pubkey and bounty address. Votes from
      non-pledgers assigned zero weight and excluded from tallies. Multiple
      pledges from same pubkey sum for weight calculation.
- [x] 8.3 Wire VoteButton submission: construct Kind 1018 event with required
      tags (`a`, `e`, `p`, `vote`, `client`), sign via NIP-07, optimistic
      insert, publish to relays, success toast "Vote submitted!". Prevent
      redundant same-choice votes with toast "You have already voted to approve
      this solution".
- [x] 8.4 Implement vote deduplication — latest Kind 1018 event (by
      `created_at`) per pubkey per solution is canonical. Earlier votes
      superseded. Tally recomputed reactively via `$derived` in
      `bounty-detail.svelte.ts`.
- [x] 8.5 Verify real-time tally updates — new Kind 1018 events from relay
      subscriptions trigger reactive recomputation in `VoteProgress` component.
      When consensus reached (approve weight > reject weight AND approve weight
      ≥ quorum threshold), display "Solution approved! Awaiting payout from
      bounty creator." and show "Trigger Payout" button for creator.

## 9. Payout Orchestration

- [x] 9.1 Implement payout trigger visibility on bounty detail page
      (`src/routes/bounty/[naddr]/+page.svelte`) — "Trigger Payout" button
      visible only when: current user is bounty creator AND a solution has
      reached consensus approval. Hidden for non-creators (show "Awaiting payout
      from bounty creator") and before consensus.
- [x] 9.2 Implement payout confirmation dialog — on "Trigger Payout" click,
      display: winning solution summary, solver's pubkey (formatted as npub),
      total payout amount in sats, number of pledge tokens being consolidated,
      irreversibility warning "This action is irreversible. Tokens will be
      locked to the solver." Require "Confirm Payout" click to proceed. "Cancel"
      closes dialog with no side effects.
- [x] 9.3 Implement pledge token collection — query EventStore for all Kind
      73002 events with matching `["a", "<bounty-address>"]`, extract and decode
      `["cashu", "<token>"]` tags. Skip invalid/already-spent tokens with
      warning log.
- [x] 9.4 Implement token swap and consolidation at mint — swap P2PK-locked
      pledge tokens using creator's signing capability, consolidate fresh
      proofs. Handle partial failure (warning "N of M pledge tokens could not be
      redeemed. Payout amount reduced.", show adjusted amount). Abort on total
      failure (toast "Payout failed. No pledge tokens could be redeemed.").
- [x] 9.5 Implement solver-locked token creation — create new Cashu tokens from
      consolidated proofs, P2PK-locked to solver's hex pubkey (from approved
      Kind 73001 event). Payout amount = total swapped minus mint fees.
- [x] 9.6 Wire payout publishing: construct Kind 73004 event with required tags
      (`a`, `e`, `p`, `amount`, `cashu`, `client`), sign via NIP-07, optimistic
      insert, publish to relays, success toast "Payout of N sats sent to
      solver!". Bounty status transitions to `completed`. Ignore Kind 73004
      events from non-creator pubkeys.
- [x] 9.7 Implement solver claim notification — when solver views bounty detail
      page after payout, display "You have been awarded N sats! Claim your
      tokens." with instructions for claiming P2PK-locked tokens via their Cashu
      wallet.

## 10. Auth Components

- [x] 10.1 Create `src/lib/components/auth/ProfileAvatar.svelte` — displays user
      avatar from Kind 0 profile metadata. Falls back to a generated identicon
      from pubkey when no avatar is set.
- [x] 10.2 Create `src/lib/components/auth/ProfileMenu.svelte` — logged-in user
      dropdown in header showing ProfileAvatar, display name/npub, links to "My
      Bounties", "Create Bounty", and "Sign Out" action.

## 11. Route & Layout Updates

- [x] 11.1 Update `src/routes/+layout.svelte` — mount `Toaster.svelte` (once,
      globally) and add `ProfileMenu` to the header area for authenticated users
      (replacing or augmenting `LoginButton`).
- [x] 11.2 Update `src/routes/bounty/[naddr]/+page.svelte` — integrate
      interactive elements: `PledgeButton`/`PledgeForm` in pledge section,
      `SolutionForm` in solution section, `VoteButton` per solution in voting
      section, payout trigger for creator. Wrap pledge, solution, and vote
      sections in `ErrorBoundary` components for error isolation.

## 12. Unit Tests

- [x] 12.1 Create `src/tests/unit/p2pk.test.ts` — test P2PK lock/unlock
      operations: lock token to pubkey, verify locked token structure, unlock
      with correct key, reject unlock with wrong key, refund after locktime
      expiration, edge cases (empty proofs, invalid pubkey format).
- [x] 12.2 Add blueprint unit tests in `src/tests/unit/` — test each blueprint
      function produces correct event structure: Kind 37300 with
      required/optional tags, Kind 73002 with all required tags, Kind 73001 with
      anti-spam fee token, Kind 1018 with vote choice, Kind 73004 with payout
      token. Verify `["client", "tasks.fyi"]` tag on all events.

## 13. Integration Tests

- [x] 13.1 Create `src/tests/integration/bounty-store.test.ts` — test EventStore
      → timeline observable reactivity: add Kind 37300 event to EventStore →
      verify timeline emits, add Kind 73002 → verify `totalPledged` updates in
      parseBountyDetail, add Kind 73001 → verify `solutionCount` updates, add
      Kind 1018 → verify vote tally recomputes. Full parsing pipeline
      validation.
- [x] 13.2 Create `src/tests/integration/pledge-flow.test.ts` — test pledge
      creation end-to-end with real EventStore: create pledge blueprint, sign
      event, verify EventStore insert, verify bounty status transition from
      `draft` to `open` on first pledge, verify `totalPledged` reflects new
      pledge amount.
