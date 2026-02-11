# Phase 3: Write Operations — Design Document

## Context

Phases 1 and 2 delivered a read-only bounty board: the SvelteKit scaffold with
Nostr relay connectivity (Phase 1) and the full bounty display UI with data
models, reactive stores, and read-only components (Phase 2). Users can browse
bounties, view pledges, solutions, and vote tallies — but cannot interact.

Phase 3 is the core product delivery. It adds all write operations that make
Tasks.fyi a functional marketplace: creating bounties, funding with Cashu ecash,
submitting solutions with anti-spam fees, voting on solutions, and orchestrating
payouts. This phase introduces the Cashu payment layer (`@cashu/cashu-ts`) and
Nostr event publishing via Applesauce `EventFactory` with NIP-07 signing.

After Phase 3, Tasks.fyi will be a fully functional — if unpolished — bounty
board where the complete lifecycle (create → fund → solve → vote → payout) works
end-to-end.

## Goals

- Implement all CRUD operations for the bounty lifecycle: create bounties (Kind
  37300), fund with pledges (Kind 73002), submit solutions (Kind 73001), cast
  votes (Kind 1018), and orchestrate payouts (Kind 73004).
- Build the Cashu payment layer: mint/wallet initialization, token
  encoding/decoding, P2PK locking (NUT-11) for escrow, and token swap for
  payout.
- Provide immediate user feedback via toast notifications for all async
  operations (publish success/failure, signing cancelled, mint errors).
- Implement optimistic local updates so the UI reflects changes instantly
  without waiting for relay round-trips.
- Add error boundaries for graceful degradation when individual components fail.
- Wire up the create bounty page (`/bounty/new`) and update the bounty detail
  page with interactive pledge, solution, and vote elements.
- Write unit tests for P2PK operations and integration tests for bounty store
  reactivity and the pledge flow.

## Non-Goals

- **Multi-mint support**: MVP uses a single configured Cashu mint per bounty.
  Cross-mint swaps and multi-mint pledge aggregation are deferred to Phase 6.
- **Automated payout on consensus**: The creator manually triggers payout after
  reviewing vote results. Automatic payout upon quorum is a post-MVP
  enhancement.
- **Real-time token verification**: Cashu tokens are verified lazily (on demand
  during payout), not on every event received. Unverified pledges show a badge.
- **NIP-60 wallet UI**: Full in-app Cashu wallet management is out of scope.
  Users bring their own tokens (minted externally or via the app's mint
  interaction).
- **DVM/ContextVM integration**: AI solver support is Phase 6.
- **NIP-50 search and category filtering**: These are Phase 4 deliverables.
- **Settings page**: Relay management, mint selection, and theme toggle are
  Phase 4.

## Decisions

### 1. Applesauce EventFactory + Blueprints for Event Construction

**Decision**: Use Applesauce's `EventFactory` with custom blueprint functions
defined in `src/lib/bounty/blueprints.ts` to construct all five event kinds.

**Rationale**: EventFactory provides a clean separation between event
construction and signing. Blueprints are pure functions that produce unsigned
event templates, making them easy to unit test. The factory handles the NIP-07
signing integration via `applesauce-signers`, keeping private key handling
entirely within the browser extension.

**Alternative considered**: Manually constructing events with `nostr-tools`
`finalizeEvent()`. Rejected because it bypasses Applesauce's signer abstraction
and would require direct private key access (which violates our security model).

### 2. NIP-07 Signing Flow — Never Handle Private Keys

**Decision**: All event signing goes through the NIP-07 browser extension signer
(`window.nostr.signEvent()`), mediated by `applesauce-signers`. The application
never asks for, stores, or transmits private keys.

**Rationale**: This is a non-negotiable security requirement. Users maintain
sovereignty over their keys. The app is a static SPA with no backend — there is
nowhere safe to store keys even if we wanted to.

**Implications**: Users must have a NIP-07 extension installed (nos2x, Alby,
etc.). The app detects extension availability and disables all write actions
when no signer is present, showing an install prompt instead.

### 3. P2PK Locking Strategy — Tokens Locked to Creator

**Decision**: Pledge tokens are P2PK-locked to the bounty creator's pubkey. The
creator collects all pledge tokens, swaps them at the mint (proving ownership
via their key), and creates new tokens P2PK-locked to the winning solver's
pubkey.

**Rationale**: This is the simplest escrow model that works with Cashu NUT-11.
The creator acts as the escrow agent. While this creates a single point of
failure (see Risks), it avoids the complexity of multi-party escrow or threshold
signatures for MVP.

**Flow**:

1. Funder mints tokens → P2PK-locked to creator's pubkey → published in Kind
   73002 `cashu` tag
2. Creator collects all pledge tokens from Kind 73002 events
3. Creator swaps tokens at mint (mint verifies P2PK signature)
4. Creator creates new tokens → P2PK-locked to solver's pubkey → published in
   Kind 73004 `cashu` tag
5. Solver claims tokens using their private key

### 4. Anti-Spam Fee as Non-Refundable Creator Compensation

**Decision**: Solution submissions require a Cashu token (10-100 sats) as an
anti-spam fee. This token is NOT P2PK-locked — it is immediately claimable by
the bounty creator. The fee is non-refundable regardless of vote outcome.

**Rationale**: The fee serves two purposes: (1) deters spam submissions by
imposing a cost, and (2) compensates the bounty creator for the effort of
reviewing submissions. Making it non-refundable and immediately claimable keeps
the mechanism simple — no escrow needed for fees.

**Range enforcement**: The fee must be between `PUBLIC_MIN_SUBMISSION_FEE` (10
sats) and `PUBLIC_MAX_SUBMISSION_FEE` (100 sats). If the bounty specifies a
`["fee", "<sats>"]` tag, that exact amount is required.

### 5. Optimistic Local Updates

**Decision**: After signing an event, immediately insert it into the Applesauce
`EventStore` before relay confirmation. Roll back only if all relays reject.

**Rationale**: Relay round-trips can take 500ms-2s. Optimistic updates make the
UI feel instant. Since the event is already signed (valid), the only failure
mode is relay rejection — which is rare for well-formed events. The Svelte 5
rune stores (`bounties.svelte.ts`, `bounty-detail.svelte.ts`) reactively
propagate the update to all consuming components.

### 6. Creator-Initiated Manual Payout

**Decision**: Payout is triggered manually by the bounty creator after reviewing
vote results. There is no automatic payout when consensus is reached.

**Rationale**: Automatic payout would require the creator's signing capability
to be available at the moment consensus is reached — which is impossible in a
client-side app (the creator may not have the page open). Manual trigger ensures
the creator is present and can verify the vote outcome before committing funds.

### 7. Toast Notification System

**Decision**: Build a global toast state store (`toast.svelte.ts`) with a
`Toaster.svelte` component mounted in the root layout. All async operations
(publish, sign, mint) report success/failure via toasts.

**Rationale**: Write operations are inherently async (NIP-07 signing, relay
publishing, mint interaction). Users need immediate feedback on whether their
action succeeded. Toasts are non-blocking and auto-dismiss, keeping the UI
clean.

### 8. Error Boundaries for Graceful Degradation

**Decision**: Wrap critical interactive sections (pledge, solution, vote) in
`ErrorBoundary.svelte` components so a failure in one section doesn't crash the
entire bounty detail page.

**Rationale**: The bounty detail page is complex — it renders pledge forms,
Cashu token operations, vote tallies, and markdown content. A runtime error in
any of these should not prevent the user from viewing the rest of the page.

## Risks / Trade-offs

### 1. Creator as Single Point of Failure for Payout

**Risk**: The bounty creator holds the P2PK key for all pledge tokens. If the
creator disappears, goes offline, or acts maliciously, pledged funds are locked
until the refund locktime expires.

**Mitigation (MVP)**: Set reasonable locktime on pledge tokens (e.g., 30 days).
After locktime, funders can reclaim their tokens. Display the creator's
reputation (completed payouts) to help funders assess trust.

**Mitigation (Post-MVP)**: Explore multi-sig escrow where a quorum of pledgers
can trigger payout without the creator. This requires Cashu multi-party P2PK
support.

### 2. Client-Side-Only Voting Eligibility Enforcement

**Risk**: Voting eligibility (only pledgers can vote) is enforced client-side
only. Relays will accept any Kind 1018 event regardless of whether the voter has
pledged. A malicious client could publish votes from non-pledgers.

**Mitigation**: The app validates on read — votes from non-pledgers are assigned
zero weight and excluded from tallies. All honest clients running Tasks.fyi will
compute the same tally. The risk is limited to confusion if a user inspects raw
relay data.

### 3. Cashu Mint Trust

**Risk**: The Cashu mint is a trusted third party. If the mint is malicious or
goes offline, pledged tokens may be lost or unclaimable.

**Mitigation (MVP)**: Default to a well-known, reputable mint
(`https://mint.minibits.cash/Bitcoin`). Allow users to override in settings.
Display a trust warning before pledge creation. Single-mint-per-bounty
simplifies the trust model.

**Mitigation (Post-MVP)**: Support multiple mints, allow user-selected mints,
implement mint health checks.

### 4. Token Double-Spend Risk

**Risk**: A funder could pledge the same Cashu token to multiple bounties. The
token is valid when published but only the first swap at the mint will succeed.

**Mitigation**: Tokens are verified during the payout swap process. If a token
has already been spent, the payout amount is reduced and the creator is warned.
Lazy verification (not on every event) is acceptable for MVP — the cost is borne
at payout time, not at pledge time.

### 5. Large Event Payloads

**Risk**: Cashu tokens in event tags can be large (especially for high-value
pledges with many proofs). Some relays may reject events exceeding size limits.

**Mitigation**: Monitor token sizes. For MVP, this is unlikely to be an issue
with typical pledge amounts (< 100,000 sats). Post-MVP: implement token
compression or split large pledges across multiple events.

### 6. NIP-07 Extension Dependency

**Risk**: Users without a NIP-07 browser extension cannot interact with the app
beyond read-only browsing. This limits the potential user base.

**Mitigation**: Provide clear install prompts with links to popular extensions
(nos2x, Alby). The read-only experience is still valuable for discovery.
Post-MVP: explore alternative signing methods (NIP-46 remote signer,
nsecBunker).
