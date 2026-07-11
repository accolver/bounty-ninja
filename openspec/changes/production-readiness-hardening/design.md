## Context

Bounty.ninja is a static SvelteKit SPA whose public state is assembled from untrusted Nostr events and whose payment records contain public Cashu bearer tokens. The current implementation parses event structure first and performs mint verification later as a display concern. Consequently, declared amounts can influence funding, voting, winner selection, lifecycle, and reputation before the associated value is proven. Payment operations also require the Nostr identity private key and can spend proofs before durable recovery state or relay acknowledgement exists.

The implementation must retain the PRD Section 7 architecture: Applesauce `EventStore` remains the in-memory event source, `nostr-idb` remains the persistent event cache, and no application backend is introduced. Security-sensitive projections may query mints, but mint availability is not equivalent to validity and unavailable proofs must fail closed for financial actions.

## Goals / Non-Goals

**Goals:**

- Make it impossible for unverified pledge declarations to create financial state or voting power.
- Ensure a payout cannot select or redirect the winner and is bound to exact source value.
- Remove Nostr identity private keys from the application trust boundary.
- Make every irreversible Cashu transition resumable after relay failure, reload, or crash.
- Produce deterministic lifecycle state from the same validated event set on every route.
- Contain unsafe production payment behavior before deeper protocol work ships.
- Establish enforceable security, test, deployment, accessibility, and operational release gates.

**Non-Goals:**

- Operating a centralized escrow, application database, or custodial wallet.
- Guaranteeing mint solvency, relay completeness, or relay availability.
- Making old malformed events valid through compatibility fallbacks.
- Shipping the dedicated Nosflare relay in this change.
- Adding user tracking or collecting public keys in operational telemetry.

## Decisions

### 1. Contain before migrating

Production payment writes SHALL be disabled behind a build-time feature flag until wallet-scoped Cashu signing and the validated projection are complete. Read-only rendering of legacy events remains available with explicit unverified status. This avoids preserving an unsafe flow merely to maintain feature availability.

Alternative considered: leave payments enabled while incrementally fixing components. Rejected because the first irreversible swap can occur before downstream safety fixes apply.

### 2. Separate identity signing from payment signing

NIP-07 and NIP-46 SHALL sign Nostr events only. NUT-11 proof signing SHALL be delegated to a Cashu-compatible wallet or a dedicated, non-identity payment key with explicit export/recovery semantics. Components receive a capability interface, not secret key bytes.

Alternative considered: retain in-memory `nsec` entry. Rejected because strings cannot be reliably zeroized and same-origin compromise exposes the user's durable identity.

### 3. Add a validated financial projection

A pure domain projection in `src/lib/bounty/` SHALL consume structurally valid events plus explicit pledge/payout verification records. It returns active validated pledges, proof ownership, vote weights, deterministic consensus, valid releases, and lifecycle state. Home, detail, search, profile, reputation, and action authorization SHALL consume this projection rather than independently summing tags.

Validation records distinguish `pending`, `valid`, `invalid`, and `unavailable`. Only `valid` contributes value. Proof identifiers are indexed to prevent replay across pledge events. Results include the policy version and freshness timestamp because proof spend state changes.

Alternative considered: filter in individual components. Rejected because route-specific derivation already produces contradictory states.

### 4. Bind releases to source pledges

Kind 73004 payout events SHALL include one or more source pledge event references, but the MVP implementation SHALL publish one payout per source pledge. A valid payout must be authored by that pledge's owner, reference the unique consensus winner, target that solution's author, use the bounty mint, and carry the released value locked to the target. A payout never participates in winner selection.

### 5. Use deterministic event ordering and fail-closed ambiguity

Latest-event decisions use `(created_at, id)` ordering. Retractions require owner authorization and a valid same-bounty target. If multiple solutions satisfy consensus under legacy voting rules, release is blocked until the protocol yields one deterministic winner. Missing relay data is surfaced as incomplete rather than interpreted as confirmed absence during financial actions.

### 6. Persist an operation journal before spending

IndexedDB SHALL hold versioned payment operation records separate from the public event cache. Before spending proofs, the journal records intent and encrypted/exportable recovery material. Each irreversible transition persists before continuing. Publication retries reuse the exact signed event. Completion removes secret recovery material only after relay acknowledgement and explicit wallet handoff.

Alternative considered: component-state recovery dialogs. Rejected because refresh, crash, and service-worker activation destroy them.

### 7. Centralize untrusted-content policy

All event-derived URLs pass through one allowlist helper. Markdown rendering disables raw HTML where possible and sanitizes final HTML before DOM insertion. Live relay and cache ingestion share signature, schema, client namespace, URL, and resource-limit validation before persistence or projection.

### 8. Build and deploy one verified artifact

CI pins tool versions, installs Playwright browsers, runs every required gate, builds once, checks headers and budgets, and deploys that exact artifact through a protected environment. Payment enablement is a reviewed build configuration. Aggregate diagnostics must never include pubkeys, event content, Cashu tokens/proofs, or private relay parameters.

## Risks / Trade-offs

- [Mint proof-state APIs may not prove issuance authenticity] -> Document the exact trust guarantee, test supported mints, and do not label state cryptographically verified beyond what the API proves.
- [Wallet support for NUT-11 signing is fragmented] -> Keep payments disabled until at least one interoperable, tested wallet capability exists.
- [Public legacy events lack source-pledge payout tags] -> Render them as legacy/unverified and exclude them from new financial and reputation state.
- [Mint checks leak viewing activity] -> Verify only action-relevant or explicitly requested pledges, batch by mint, cache briefly, and disclose the request.
- [Durable recovery records are sensitive bearer material] -> Minimize retention, encrypt where a recoverable key source exists, support explicit export, and never send records to telemetry.
- [Stricter validation reduces apparent totals] -> Show declared and validated state separately during migration; use only validated totals for action.
- [A static SPA cannot remotely revoke bad code instantly] -> Maintain a reviewed payment-disabled build and documented Cloudflare rollback procedure.

## Migration Plan

1. Ship payment containment, remove private-key inputs, and add unsafe-link/read-side validation.
2. Introduce verification records and the shared projection without enabling payments.
3. Migrate list/detail/search/profile/reputation reads to the projection and load all related event kinds cache-first.
4. Implement wallet-scoped signing, correct lock/refund conditions, source-bound payout events, and the operation journal.
5. Run a test-funds beta against supported mints and isolated full-lifecycle tests.
6. Obtain independent review of NUT-11 semantics and payment recovery, then explicitly enable payments in a reviewed release.

Rollback at every stage disables payment writes. Projection schema versions remain readable, and public Nostr events require no destructive migration.

## Open Questions

- Which Cashu wallet integration can sign NUT-11 challenges without exposing the Nostr identity key?
- Do supported mints treat locktime without refund keys exactly as the current cashu-ts types imply?
- Which mint endpoint or operation establishes proof authenticity rather than only current spend state?
- Should the final winner protocol use exclusive ballots, highest approval weight, or a dedicated winner event?
- What encrypted local key source provides meaningful crash recovery without creating a new unrecoverable secret?
