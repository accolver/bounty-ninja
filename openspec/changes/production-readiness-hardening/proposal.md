## Why

Bounty.ninja implements the product flow described in PRD Sections 6, 7, 13, and 14, but the current client can derive financial state from unverified bearer tokens, accepts under-authorized payout and retraction events, and asks users to expose Nostr private keys. Because these gaps can cause key compromise, false consensus, payout redirection, or unrecoverable fund loss, production payment actions must be contained and rebuilt around explicit validation and recovery invariants before real-value launch.

## What Changes

- **BREAKING** Remove direct `nsec` and raw private-key entry from authentication, payout, and reclaim flows; Nostr identity signing remains NIP-07/NIP-46 only per PRD Section 14.1.
- **BREAKING** Stop treating structurally parsed pledge and payout events as financially valid. Funding, voting, lifecycle, reputation, and release actions use only a validated financial projection.
- **BREAKING** Bind each payout to exact source pledge events and the unique consensus-approved solution instead of allowing a payout event to select the winner.
- Correct NUT-11 locktime/refund behavior so a public pledge never becomes anyone-spendable after expiration.
- Add durable, resumable operation state for every flow that can spend proofs before relay confirmation, including explicit recovery export.
- Authorize retractions against the referenced bounty or pledge owner and make event conflict resolution deterministic.
- Route live relay and cache ingestion through signature, schema, namespace, URL, and resource-limit validation.
- Sanitize the actual Markdown rendering path and restrict all event-derived URLs to approved schemes.
- Make home, detail, search, profile, and reputation derive lifecycle state from one projection; load payouts and retractions on direct visits and support cache-first/offline recovery.
- Replace superficial release checks with hermetic full-lifecycle and failure-injection tests using an isolated relay and mock mint.
- Require complete CI, reproducible deployment artifacts, protected production releases, privacy-preserving diagnostics, smoke tests, rollback, and incident runbooks.
- Enforce accessibility and performance gates, including a realistic initial-load budget and a separate lazy-editor budget.

Acceptance requires the PRD Section 14 privacy rules, Section 6 event contracts, Section 7 client-side architecture, and Section 17 test requirements to hold under relay failure, mint failure, browser restart, malicious events, and conflicting event order.

## Capabilities

### New Capabilities

- `trusted-financial-state`: Defines validated pledge, consensus, payout, retraction, reputation, and lifecycle projections used by every route and action.
- `payment-operation-recovery`: Defines wallet/signer separation and durable, resumable handling of irreversible Cashu operations.
- `operational-readiness`: Defines release controls, diagnostics, incident response, rollback, and payment kill-switch requirements for a static SPA.

### Modified Capabilities

- `cashu-payments`: Replace identity-key handling and unsafe locktime/swap behavior with wallet-scoped signing and verified P2PK conditions.
- `pledge-flow`: Require durable pre-publication recovery and confirmed publication before reporting success.
- `payout-orchestration`: Change payout authorization to pledger-controlled, source-pledge-bound releases to one validated winner.
- `event-validation`: Apply validation to all ingestion paths and enforce ownership, URL, size, and event relationship constraints.
- `task-state-machine`: Derive all lifecycle states from validated active pledges, consensus, releases, expiration, and authorized retractions.
- `content-security`: Sanitize the production Markdown renderer, validate event-derived URLs, and strengthen CSP.
- `offline-support`: Restore cache-first bounty state and resumable payment operations across reloads and offline deep links.
- `e2e-testing`: Require isolated full-lifecycle, adversarial, recovery, browser, mobile, and accessibility coverage.
- `deployment`: Make the complete quality suite a deployment prerequisite and deploy one pinned, verified artifact with rollback controls.
- `performance-optimization`: Replace the contradictory aggregate budget with enforced initial-route, lazy-chunk, and total-asset budgets.

## Impact

The change affects `src/lib/cashu/`, `src/lib/bounty/`, `src/lib/nostr/`, financial and authentication components, route stores, Markdown rendering, IndexedDB state, the service worker, tests, CI, Cloudflare headers, package/tool version policy, and operational documentation. Existing public Nostr events remain readable, but only events satisfying the new validation contracts influence financial or reputation state. No backend or private database is introduced; any operational telemetry must be aggregate or explicitly scrubbed of pubkeys, event content, relay secrets, and Cashu material.
