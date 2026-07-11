# Payment Safety Test Guide

Payment writes are disabled by default with:

```text
PUBLIC_PAYMENT_WRITES_ENABLED=false
```

Do not enable this flag with real funds. The current production milestone is to
replace identity-key handling with an external Cashu payment signer, validate
all pledge and payout proofs before they affect state, and persist recovery data
before any irreversible mint operation.

## Current Verification

1. Run `bun run check`.
2. Run `bun run test:unit`.
3. Run `bun run test:integration`.
4. Run `bun run build`.
5. Open a funded bounty and confirm pledge, release, reclaim, and required-fee
   actions show an unavailable notice and cannot invoke a mint.
6. Confirm fee-free solution submission remains available.
7. Confirm login offers only NIP-07 browser extension and NIP-46 remote signer.
8. Confirm no production page requests an `nsec`, hex private key, or secret key.

The automated guard for step 8 is:

```bash
bunx vitest run src/tests/unit/no-production-secret-inputs.test.ts
```

## Re-Enable Requirements

Payment writes may be enabled only after all tasks in
`openspec/changes/production-readiness-hardening/tasks.md` are complete,
including:

- External wallet or payment-signer interoperability
- Safe NUT-11 primary and refund conditions
- Validated pledge and payout projections
- Source-pledge-bound releases
- Durable operation journal and reload recovery
- Hermetic full-lifecycle and adversarial tests
- Independent payment and recovery review
- Test-funds beta and documented recovery drill

Enabling payments must be a separately reviewed release configuration change.
