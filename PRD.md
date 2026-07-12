# Bounty.ninja Product Requirements

**Version:** 3.0

**Updated:** 2026-07-11

**Status:** Public read/write bounty features are available; payment writes are disabled by default and are not approved for real funds.

## 1. Product

Bounty.ninja is a decentralized bounty board built as a static, client-only
SvelteKit application. Users publish bounties, solutions, votes, and financial
records to Nostr. Cashu provides bearer ecash for pledges and payouts. There is
no application backend, custodian, or private database.

The application coordinates payment; it does not enforce settlement. Pledgers
retain control of each pledge and must manually release it after one solution
reaches consensus. A solver receives only the portions actually released.

## 2. Safety Status

Production payment writes are controlled by the build-time
`PUBLIC_PAYMENT_WRITES_ENABLED` flag and default to `false`. While disabled,
pledge, required solution-fee, release, and reclaim actions must not call a mint.
Fee-free Nostr bounty, solution, and voting flows remain available.

The flag may be enabled only in a separately reviewed release after every gate
in `LAUNCH_CHECKLIST.md` is evidenced. Test configuration may enable it against
the isolated mock mint and relay. No beta, independent payment review, recovery
drill, or accessibility audit is claimed complete by this document.

## 3. Architecture

- SvelteKit 2 static SPA with SSR and prerendering disabled; Cloudflare Pages
  serves the fallback document.
- Svelte 5 runes for reactive state and RxJS for relay streams.
- Applesauce v5 `EventStore` as the in-memory event source and `nostr-idb` as
  the app-owned IndexedDB event cache.
- Verified cache-first reads followed by relay revalidation. Untrusted events
  must pass signature, schema, namespace, URL, and resource-limit checks before
  persistence or financial projection.
- `@cashu/cashu-ts` 3.4.1 for Cashu v3/v4 token decoding, mint proof-state
  checks, and NUT-11 inspection.
- NIP-07 browser extensions and NIP-46 remote signers sign Nostr events only.
  The application never requests or handles a Nostr identity secret.
- A versioned IndexedDB payment journal records irreversible manual workflows
  before wallet handoff and preserves exact signed events for retry.

Runtime and dependency versions are pinned in `package.json` and `mise.toml`.
`src/lib/config.ts` is the branding and default-configuration source of truth.

## 4. Event Contract

All newly published application events include `['client', 'bounty.ninja']`.
Amounts are positive integer satoshis. Event-derived financial state is
fail-closed: declarations that are missing data, invalid, duplicated, spent, or
unavailable do not create voting power or release authority.

| Kind  | Record                 | Required relationship/payment data                                                                                             |
| ----- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| 37300 | Bounty definition      | `d`, title, reward; optional expiration, mint, fee, and topic tags                                                             |
| 73001 | Solution               | Bounty `a` reference and `['payment','cashu','<x-only-key>']` for new payout-compatible solutions                              |
| 73002 | Pledge                 | Bounty `a`, creator `p`, amount, Cashu token, mint, and `['payment','cashu','<x-only-key>']`                                   |
| 1018  | Vote                   | Bounty `a`, solution `e`, and approve/reject choice                                                                            |
| 73004 | Payout                 | Bounty `a`, one solution `e`, one source-pledge `e` marked `source`, solver `p`, amount, token, mint, and matching payment tag |
| 73005 | Retraction             | Bounty `a`, bounty/pledge type, and source pledge `e` for pledge retraction                                                    |
| 73006 | Reputation attestation | Authorized retraction relationship used as one derived reputation signal                                                       |

The payment tag is exactly `['payment', 'cashu', '<64-character lowercase
x-only public key>']`. It identifies a dedicated Cashu spending/receiving key,
not the event author's Nostr identity key. Legacy events without this tag may be
displayed but cannot participate in new validated payment operations.

## 5. Payment Policy

### 5.1 Permanent Minibits Pledges

The only currently supported user workflow is a manual Minibits handoff. Before
publishing a pledge, the user creates an exact-amount P2PK token at the bounty's
mint, locked to the public key declared in the payment tag. Every proof must:

- use unit `sat` and the bounty mint;
- be unspent and unique;
- target the declared Minibits payment key;
- have no locktime and no refund keys; and
- permanently require one `SIG_INPUTS` signature.

This no-locktime policy is permanent for the supported Minibits workflow. A
bounty deadline changes lifecycle status but does not unlock proofs and is not a
Cashu refund timer. The controlling Minibits wallet must remain backed up.

### 5.2 Manual Release

After one solution has validated 66% weighted consensus, each pledger releases
each source pledge separately in the same backed-up Minibits wallet. The user
redeems the exact public source token, creates an exact-amount permanent P2PK
token to the winner's declared payment key, and pastes that solver-locked token
into Bounty.ninja. The application verifies the source is spent and the output
token's amount, mint, proof state, key, and NUT-11 policy before publishing one
source-bound Kind 73004 event.

Bounty.ninja does not currently perform the wallet swap or sign NUT-11 proofs.
It cannot prevent wallet mistakes, restore a lost wallet, or force a
non-cooperating pledger to release. Retrying a journaled release reuses the exact
signed event and must not create another output token.

### 5.3 Manual Reclaim

Reclaim is also manual. The pledger uses **Revert** on the original pending send
inside the same Minibits wallet, then returns to Bounty.ninja. Retraction remains
blocked until the mint reports every source proof spent. The public source token
must not be imported first because that can race the original pending send.

There is no automatic, deadline-triggered, or in-app-key reclaim. If the
original Minibits pending send or controlling wallet cannot be recovered,
Bounty.ninja cannot recover the funds.

### 5.4 External Wallet Support

Minibits is supported only through the documented manual token creation,
release, claim, and Revert handoffs. Generic wallets may import a public payout
token but may not preserve or satisfy its NUT-11 lock; the solver should use the
backed-up Minibits wallet matching the solution payment key. No NIP-60,
NUT-11-capability API, automated external payment signer, or other wallet is
currently claimed interoperable.

Cashu tokens published to Nostr are public bearer instruments. The NUT-11 lock,
not token secrecy, controls spending. Mint availability, correctness, and
solvency remain external trust dependencies.

## 6. Trusted State And Lifecycle

All list, detail, search, profile, reputation, voting, and action authorization
views use the shared validated financial projection. Active pledge value comes
only from valid, unspent, non-retracted, non-replayed source proofs. Votes are
weighted by that value; deterministic `(created_at, id)` ordering resolves
latest-event choices. Multiple quorum winners are ambiguous and block release.

Lifecycle is derived, never stored:

`draft -> open -> in_review -> consensus_reached -> releasing -> completed`

- `draft`: no validated active pledge value.
- `open`: validated value exists and there are no same-bounty solutions.
- `in_review`: solutions exist but there is no unique consensus winner.
- `consensus_reached`: one winner has quorum and no valid source payout exists.
- `releasing`: at least one but not every active source pledge has one valid
  payout to that winner.
- `completed`: every active source pledge has exactly one valid payout.
- `expired`: the bounty deadline passed before completion. Expiry does not
  unlock Cashu proofs.
- `cancelled`: the creator published an authorized bounty retraction.

Unauthorized or cross-bounty retractions, winner redirection, mismatched
payment keys/mints/amounts, legacy payouts without source references, and
duplicate source payouts do not affect trusted state.

## 7. Security And Privacy

- Never request, receive, store, or transmit an `nsec`, Nostr private key, Cashu
  payment private key, token, or proof through diagnostics.
- NIP-07/NIP-46 sign public Nostr events; Cashu wallet authorization stays in
  the external wallet.
- All Nostr events are public. Users must not put secrets or personal data in
  bounty or solution content.
- Sanitize rendered Markdown and allow only approved URL schemes for event
  links and media.
- Validate signatures and bounded event resources before EventStore or
  IndexedDB insertion.
- Durable payment records are local and sensitive. Recovery export is a user
  handoff, not cloud backup.
- Operational diagnostics are local, explicitly exported, and scrubbed of
  pubkeys, event content/tags, tokens, proofs, and secret URLs.

See `SECURITY.md` and `docs/runbooks/` for disclosure, incident, rollback,
outage, and recovery procedures.

## 8. Quality And Performance

`bun run test` runs the configured Vitest unit and integration suites;
`bun run test:e2e` runs Playwright against a clean local relay and deterministic
mock mint across Chromium, Firefox, WebKit, a 375px viewport, and the separate
service-worker scenario. Exact test totals are intentionally not documented
because they change with the suite; use runner output as the source of truth.

Required local/CI checks are `bun run check`, `bun run lint`, `bun run test`,
`bun run test:coverage`, `bun run build`, `bun run check:bundle`,
`bun run check:headers`, and the configured E2E suite. Coverage thresholds live
in `vitest.config.ts`.

Bundle budgets in `bundle-budgets.json` are enforced from the Vite manifest:
270 KiB gzip for the initial home route, 360 KiB for the largest lazy asset,
and 1284 KiB for total JavaScript/CSS. These are regression budgets, not claims
of measured production speed. Lighthouse performance, accessibility, and
mobile interaction results must not be claimed until a dated production audit
records them in `LAUNCH_CHECKLIST.md`.

The product targets WCAG 2.1 AA, keyboard operation, visible focus, semantic
landmarks and labels, 4.5:1 text contrast, zoom support, and reduced motion.
Automated checks support but do not replace the pending manual accessibility
audit.

## 9. Launch Gates

Payment writes remain disabled until `LAUNCH_CHECKLIST.md` has evidence and
approval for the test-funds beta, independent NUT-11/payment review, recovery
drill, accessibility audit, external-wallet interoperability, complete release
suite, deployment controls, and rollback rehearsal. A production operator must
verify the deployed flag and payment controls after every release.
