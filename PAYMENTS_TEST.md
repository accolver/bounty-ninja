# Payment Safety Test Guide

Payment writes are disabled by default with:

```text
PUBLIC_PAYMENT_WRITES_ENABLED=false
```

Do not enable this flag with real funds. Test and E2E builds may enable it only
with isolated test services. Production enablement requires every item in
`LAUNCH_CHECKLIST.md`; no beta, independent review, recovery drill, or
accessibility audit is implied complete.

## Implemented Payment Path

The current path is a manual Minibits workflow, not an external-wallet API:

1. A pledger creates an exact-amount Minibits P2PK token at the bounty mint,
   locked to the public key placed in `['payment','cashu','<x-only-key>']`.
2. Every proof must permanently require one `SIG_INPUTS` signature with **no
   locktime and no refund keys**. This is the permanent supported policy;
   bounty expiry does not unlock the token.
3. For release, the pledger redeems the exact source in the same backed-up
   Minibits wallet, creates an exact solver-locked token, and pastes it into the
   app. The app verifies the spent source and replacement before publishing one
   source-bound payout.
4. For reclaim, the pledger uses **Revert** on the original Minibits pending
   send before returning to publish a retraction. Do not first import the public
   source token; that can race the pending send.

The app cannot sign the swap, restore a wallet, force release, or recover a
pledge when the original pending send or controlling Minibits wallet is lost.
Generic wallet import is not claimed safe for locked payouts. Solvers should
claim with the backed-up Minibits wallet matching their solution payment key.

## Current Verification

1. Run `bun run check`.
2. Run `bun run test:unit`.
3. Run `bun run test:integration`.
4. Run `bun run build`.
5. With the flag disabled, open a funded bounty and confirm pledge, release,
   reclaim, and required-fee
   actions show an unavailable notice and cannot invoke a mint.
6. Confirm fee-free solution submission remains available.
7. Confirm login offers only NIP-07 browser extension and NIP-46 remote signer.
8. Confirm no production page requests any identity or payment secret key.
9. In an isolated test build with the flag enabled, verify pledge, release, and
   reclaim reject the wrong key, mint, amount, proof state, duplicate proof,
   locktime, refund key, or non-`SIG_INPUTS` policy.
10. Confirm new pledge, solution, and source-bound payout events carry exactly
    one `['payment','cashu','<lowercase-x-only-key>']` tag.

Relevant automated checks include:

```bash
bunx vitest run src/tests/unit/no-production-secret-inputs.test.ts
bunx vitest run src/tests/unit/manual-token-verifier.test.ts
bunx vitest run src/tests/integration/manual-payment-workflow.test.ts
```

## Re-Enable Requirements

Payment writes may be enabled only after all tasks in
`openspec/changes/production-readiness-hardening/tasks.md` are complete,
including:

- At least one independently tested external-wallet/payment-signer integration;
  the current manual Minibits handoff does not satisfy this gate
- Independent confirmation of the permanent no-locktime NUT-11 policy
- Validated pledge and payout projections
- Source-pledge-bound releases
- Durable operation journal and reload recovery
- Hermetic full-lifecycle and adversarial tests
- Independent payment and recovery review
- Test-funds beta and documented recovery drill
- Manual accessibility audit and production launch/rollback evidence

Enabling payments must be a separately reviewed release configuration change.
