## 1. Immediate Production Containment

- [x] 1.1 Add a typed, build-time payment-write safety flag in `src/lib/config.ts` and `src/lib/utils/env.ts`, default it to disabled, and test production/default parsing in `src/tests/unit/env.test.ts`
- [x] 1.2 Gate pledge, solution-fee, release, and reclaim mint operations in `src/lib/components/pledge/PledgeForm.svelte`, `src/lib/components/solution/SolutionForm.svelte`, `src/lib/components/voting/PayoutTrigger.svelte`, and `src/lib/components/pledge/ReclaimAlert.svelte`; render one accessible unavailable-state component with component tests
- [x] 1.3 Remove direct nsec login and `PrivateKeySigner` account paths from `src/lib/components/auth/LoginButton.svelte`, `src/lib/nostr/account.svelte.ts`, and `src/lib/nostr/signer.svelte.ts`; update authentication tests
- [x] 1.4 Remove raw private-key inputs from release and reclaim components while preserving disabled/read-only recovery messaging; add a repository test that rejects production secret-key inputs
- [x] 1.5 Update `README.md`, `PAYMENTS_TEST.md`, and user-facing payment copy to state that payment writes are disabled pending wallet integration

## 2. Untrusted Content and Event Ingestion

- [ ] 2.1 Add a centralized safe event URL helper in `src/lib/utils/` allowing only approved schemes and cover encoded, mixed-case, and malformed URLs in `src/tests/unit/`
- [ ] 2.2 Apply safe URL handling to `SolutionItem.svelte`, profile links/images, Markdown links, and every event-derived `href` or `src`; add browser-level regression tests
- [ ] 2.3 Connect `src/lib/utils/sanitize.ts` to the actual `MarkdownViewer.svelte` rendering pipeline and test raw HTML, SVG, protocol, and mutation payloads against the component
- [ ] 2.4 Centralize live relay, search, cache, profile, and reputation ingestion through signature verification in `src/lib/nostr/`; prove invalid events never reach EventStore or IndexedDB with integration tests
- [ ] 2.5 Add per-kind content, tag, tag-value, token, and related-event limits to `src/lib/nostr/tag-validator.ts` and reject oversized events before persistence
- [ ] 2.6 Harden `static/_headers` with `script-src-attr 'none'`, explicit HTML/service-worker cache policies, and a tested inline theme-script authorization strategy

## 3. Trusted Financial Projection

- [ ] 3.1 Define `PledgeVerification`, proof-identity, payout-validation, and projection result types in `src/lib/bounty/types.ts` and `src/lib/cashu/types.ts`
- [ ] 3.2 Implement pure pledge validation policy in `src/lib/cashu/` for unit, normalized mint, decoded amount, proof state, duplicate proof identity, P2PK target, locktime, and refund keys; add mint-contract tests
- [ ] 3.3 Implement a deterministic projection module in `src/lib/bounty/financial-state.ts` using `(created_at, id)` ordering and validated active pledge value
- [ ] 3.4 Add authorized bounty and pledge retraction validation and same-bounty relationship checks; update `retraction-flow.test.ts`
- [ ] 3.5 Implement unique-winner consensus with an explicit ambiguous state and tests for equal timestamps, replayed votes, and multiple quorum winners
- [ ] 3.6 Implement source-bound payout validation and deduplication by pledge ID; test malicious winner redirection, mismatched solver, mint, amount, and token
- [ ] 3.7 Derive reputation only from validated source-bound completions and authorized retractions; update reputation tests

## 4. Route and Lifecycle Consistency

- [ ] 4.1 Replace independent list/detail lifecycle calculations with the shared projection in `bounties.svelte.ts` and `bounty-detail.svelte.ts`
- [ ] 4.2 Add per-bounty payout loading, pass validated retractions into detail derivation, and reject non-bounty `naddr` kinds
- [ ] 4.3 Merge validated `naddr` relay hints with configured relays using bounded connection rules and tests
- [ ] 4.4 Update search and profile routes to use projected bounty summaries and include authored solutions, validated pledges, releases, and reputation
- [ ] 4.5 Correct completion to require one valid payout per active validated source pledge and distinguish consensus, releasing, completed, expired, and cancelled states
- [ ] 4.6 Separate remembered account, signer-ready, and authenticated state and verify signed event pubkeys match the active account

## 5. Wallet Signing and Recoverable Payments

- [ ] 5.1 Specify and implement a typed Cashu payment signer capability in `src/lib/cashu/` with no raw secret-key interface
- [ ] 5.2 Validate exact NUT-11 primary/refund/locktime semantics against supported `cashu-ts` and mint behavior; add real-protocol integration fixtures
- [ ] 5.3 Correct pledge output conditions so public proofs never become anyone-spendable after locktime
- [ ] 5.4 Extend Kind 73004 blueprints and validators with exact source pledge and mint references, one payout per source pledge
- [ ] 5.5 Refactor release to create solver-locked outputs directly or return every intermediate proof on failure
- [ ] 5.6 Add a versioned IndexedDB payment operation journal with prepared, spending, outputs-created, signed, published, confirmed, recovery-required, and failed states
- [ ] 5.7 Persist operation state before every irreversible transition and implement idempotent resume using the exact signed event
- [ ] 5.8 Add recovery/export UI that survives reload and cannot be dismissed before safe wallet handoff or explicit acknowledgement
- [ ] 5.9 Integrate at least one compatible external wallet/payment signer and keep the production flag disabled until interoperability tests pass

## 6. Cache, Offline, and Availability

- [ ] 6.1 Integrate verified cache-first queries into home and bounty detail before relay revalidation
- [ ] 6.2 Add service-worker SPA navigation fallback, controlled update activation, and pending-payment compatibility checks
- [ ] 6.3 Track browser, relay, mint, cache freshness, and publication readiness as distinct states with actionable retry UI
- [ ] 6.4 Connect saved cache limits to scheduled eviction, protect active-user events, and restrict clearing to app-owned databases
- [ ] 6.5 Keep cached/local search available offline and merge relay search results incrementally without timeout data loss

## 7. Test and Release Gates

- [ ] 7.1 Build hermetic Playwright setup with a clean local relay, deterministic mock mint, blocked public traffic, and browser installation in CI
- [ ] 7.2 Replace conditional shell assertions with full create, validate pledge, solve, vote, release, claim, retract, reload, and offline lifecycle tests
- [ ] 7.3 Add adversarial and crash-boundary scenarios for all audit exploits and irreversible payment transitions
- [ ] 7.4 Run Chromium, Firefox, WebKit, and 375px mobile projects with accessibility checks and retained failure artifacts
- [ ] 7.5 Add Vitest coverage thresholds and stricter branch coverage for validation, projection, signer, publishing, state-machine, sanitization, and recovery modules
- [ ] 7.6 Fix current Svelte warnings and formatting failures, narrow formatter scope appropriately, and make lint a required gate

## 8. Reproducible Operations and Launch

- [ ] 8.1 Pin Bun, Node, Wrangler, nak/relay image, GitHub Actions, and security/payment-critical direct dependencies
- [ ] 8.2 Update `.github/workflows/ci.yml` to run the complete quality suite, build once, checksum and retain the artifact, serialize production deploys, and use a protected environment
- [ ] 8.3 Replace the aggregate bundle script with Vite-manifest initial-route, largest-lazy-chunk, and total-asset budgets; remove warning suppression
- [ ] 8.4 Add deployed header/custom-domain smoke tests, release identity, post-deploy validation, and automatic failure reporting
- [ ] 8.5 Add privacy-scrubbed diagnostic export/monitoring without pubkeys, event content, tokens, proofs, or secret URLs
- [ ] 8.6 Create `SECURITY.md` and operational runbooks for payment incidents, outages, disclosure, credential rotation, rollback, and recovery drills
- [ ] 8.7 Reconcile `PRD.md`, README, OpenSpec main specs, payment guide, branding, lifecycle, test-count, and performance claims with implemented behavior
- [ ] 8.8 Complete test-funds beta, independent NUT-11/payment review, recovery drill, accessibility audit, and launch checklist before enabling payment writes
