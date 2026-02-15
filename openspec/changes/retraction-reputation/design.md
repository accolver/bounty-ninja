# Retraction & Reputation — Design Document

## Context

The current system handles bounty cancellation via Kind 5 delete events, but the
bounty detail store doesn't load them yet and relays can silently drop Kind 5
events. There is no mechanism to distinguish "bounty cancelled" from "pledge
retracted," no audit trail for retractions, and no reputation consequences for
bad behavior.

The pledger-controlled escrow model (already implemented) means pledgers can
always reclaim their tokens — the `reclaimPledge()` function in
`src/lib/cashu/escrow.ts` handles the mint swap. What's missing is the Nostr
event layer: recording retractions on-chain and deriving reputation from them.

## Goals

- Provide an explicit, queryable audit trail for all bounty cancellations and
  pledge retractions via Kind 73005 events.
- Automatically publish Kind 73006 reputation attestations when retractions
  occur after solutions have been submitted, creating social accountability.
- Allow free retraction with no penalty when no solutions exist.
- Derive credibility scores client-side from on-chain events and display
  credibility indicators everywhere a pubkey appears in the UI.
- Maintain backward compatibility with legacy Kind 5 delete events.

## Non-Goals

- **Server-side reputation aggregation**: All reputation is derived client-side.
  No centralized reputation service.
- **Reputation staking or slashing**: No token-based reputation mechanism. Pure
  event-based signal aggregation.
- **Cross-application reputation**: The system only considers bounty.ninja event
  kinds. Broader Nostr reputation (web of trust, NIP-32 labels) is deferred.
- **Retraction reversal**: Once a retraction is published, it cannot be undone.
  The user must create a new bounty or pledge.

## Decisions

### 1. Dedicated Kind 73005 for Retractions (Not Kind 5)

**Decision**: Use a custom Kind 73005 event instead of Kind 5 delete events for
bounty cancellation and pledge retraction.

**Rationale**: Kind 5 delete events are problematic: relays may drop them (NIP-09
says relays SHOULD delete but MAY NOT), they cannot carry structured metadata
(type discrimination, pledge references), and they provide no queryable audit
trail. A dedicated kind ensures retractions are first-class events that can be
queried, filtered, and analyzed like any other bounty event.

**Tag structure**:
- `["a", "37300:..."]` — bounty reference (required)
- `["type", "bounty" | "pledge"]` — distinguishes cancellation from retraction
- `["e", "<pledge-event-id>"]` — references the specific pledge (for pledge
  retractions only)
- Content: optional human-readable reason

**Alternative rejected**: Extending Kind 5 with custom tags. Kind 5 has
established semantics that relays interpret — adding bounty-specific tags would
be non-standard and unreliable.

### 2. Self-Attestation Model for Reputation Events

**Decision**: Kind 73006 reputation events are signed by the retracting user's
own key. The client publishes them on behalf of the user as part of the
retraction flow.

**Rationale**: Self-attestation means:
- The event cannot be forged (only the user can sign with their key)
- It appears in the user's event stream (transparent)
- Other clients can independently verify by checking if Kind 73005 retractions
  exist with solutions present — they don't need to trust the Kind 73006 event
- The user's client handles the "confession" automatically — the user cannot
  retract without also publishing the reputation impact

**Trade-off**: A modified client could skip publishing Kind 73006. Mitigation:
other clients can derive the same negative signal by detecting Kind 73005
retractions where solutions exist, making Kind 73006 a convenience for
aggregation rather than the sole source of truth.

### 3. Free Retraction When No Solutions Exist

**Decision**: Retractions before any solution is submitted carry zero reputation
penalty. No Kind 73006 event is published.

**Rationale**: Before solutions exist, no one has invested work based on the
bounty/pledge. The creator may have made a mistake, the pledger may have changed
their mind — this is normal and should be frictionless. Penalizing early
retractions would discourage participation.

**Implementation**: The retraction flow checks `solutions.length > 0` before
deciding whether to publish Kind 73006. This check uses the local event store
(already subscribed to Kind 73001 for the bounty).

### 4. Client-Side Reputation Derivation

**Decision**: Reputation scores are computed entirely client-side by querying
Kind 73004 (payouts), Kind 73006 (reputation events), and Kind 73002 (pledges)
for a given pubkey.

**Rationale**: No centralized reputation server is needed. Every client
independently computes the same score from the same events. This is consistent
with the project's "zero backend" philosophy.

**Caching strategy**: The `ReputationStore` caches scores in memory per session.
On first access for a pubkey, it opens a relay subscription for Kind 73006
events by that pubkey and Kind 73004 events involving that pubkey. Scores are
recomputed when new events arrive.

**Performance**: Most users interact with a small number of unique pubkeys per
session. The reputation store lazily loads only the pubkeys currently visible on
screen. Relay queries use efficient filters (`authors` + `kinds`).

### 5. Credibility Tiers

**Decision**: Five tiers — `new`, `emerging`, `established`, `trusted`,
`flagged` — derived from interaction counts and retraction history.

**Rationale**: Simple, intuitive categories that users can understand at a
glance. The `flagged` tier is triggered by any retraction where solutions
existed, providing immediate visual feedback. The positive tiers reward
consistent participation over time.

**Threshold design**: Thresholds are deliberately low for early adoption (≥3 for
emerging, ≥10 for established, ≥25 for trusted). These can be adjusted as the
platform grows.

**`flagged` does not override positive tiers permanently**: A user with many
successful interactions and one retraction will show their positive tier with a
warning indicator, not be demoted to `flagged`. The `flagged` tier is reserved
for users whose retractions dominate their history.

### 6. CredibilityBadge Integration via ProfileLink

**Decision**: Extend the existing `ProfileLink` component with an optional
`CredibilityBadge` rather than modifying every component individually.

**Rationale**: `ProfileLink` is already used everywhere a pubkey is displayed
(bounty cards, detail pages, pledge items, solution items, profile pages).
Adding reputation awareness to `ProfileLink` gives credibility indicators
everywhere with a single integration point.

**Implementation**: `ProfileLink` gains an optional `showReputation: boolean`
prop (default `true`). When enabled, it reads from `reputationStore` and renders
a `CredibilityBadge` inline after the display name.

### 7. Retraction Flow UX

**Decision**: Retraction requires explicit confirmation with a warning about
reputation impact (when applicable).

**Flow for bounty cancellation**:
1. Creator clicks "Cancel Bounty" on detail page
2. If solutions exist: modal warns "This bounty has X solutions. Cancelling will
   publish a reputation event visible to all users."
3. Creator confirms → client publishes Kind 73005, then Kind 73006 (if solutions
   exist)
4. Bounty transitions to `cancelled`

**Flow for pledge retraction**:
1. Pledger clicks "Retract Pledge" on their pledge item
2. If solutions exist: modal warns about reputation impact
3. Pledger confirms → client publishes Kind 73005, then Kind 73006 (if solutions
   exist), then calls `reclaimPledge()` to reclaim tokens
4. Pledge removed from active list

## Risks / Trade-offs

### 1. Modified Clients Can Skip Reputation Events

**Risk**: A user with a modified client could publish Kind 73005 without the
Kind 73006 reputation event.

**Mitigation**: Other clients can independently detect retractions with
solutions present by querying Kind 73005 and Kind 73001 events for the same
bounty. The Kind 73006 event is a convenience for aggregation, not the sole
source of truth.

### 2. Identity Rotation to Escape Reputation

**Risk**: Users can create new Nostr keypairs to escape negative reputation.

**Mitigation**: New identities start with the `new` tier, which carries no
credibility. Users must build reputation over time through successful
interactions. NIP-05 verification and social graph (follower count) add friction
to identity rotation. The system doesn't need to be perfect — it needs to make
bad behavior visible and good behavior rewarding.

### 3. Reputation Query Load

**Risk**: Querying Kind 73006 and Kind 73004 for every visible pubkey could
create significant relay load.

**Mitigation**: Lazy loading (only query when pubkey is visible on screen),
in-memory caching per session, and batch queries (multiple pubkeys in one
`authors` filter). Most bounty pages show < 20 unique pubkeys.

### 4. Event Ordering Edge Cases

**Risk**: A retraction event (Kind 73005) could be published at nearly the same
timestamp as a solution (Kind 73001), creating ambiguity about whether solutions
existed at retraction time.

**Mitigation**: The client checks the local event store at retraction time. If a
solution exists locally, reputation is published. Edge cases where a solution
arrives on a different relay milliseconds after retraction are acceptable —
the reputation system is probabilistic guidance, not legal judgment.
