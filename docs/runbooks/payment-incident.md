# Payment Incident Runbook

Use this runbook for suspected proof loss, duplicate spends, payout redirection,
unsafe NUT-11 behavior, signer compromise, or incorrect trusted projection.

## Contain

1. Stop the production deployment queue.
2. Confirm the currently served `/release.json` commit and retain the workflow URL.
3. Deploy the latest verified artifact built with `PUBLIC_PAYMENT_WRITES_ENABLED=false`.
4. Verify pledge, fee, release, and reclaim controls cannot call a mint.
5. Preserve local recovery exports; never request tokens, proofs, or keys from users.

## Investigate

1. Reproduce with test funds, an isolated relay, and a mock or designated test mint.
2. Record only release ID, operation category, failure class, and relay/mint result category.
3. Determine the last safe transition in the payment operation journal.
4. Check source-pledge, winner, recipient, amount, mint, proof identity, and relay acknowledgement.

## Recover And Close

1. Resume only idempotent operations using the exact previously signed event.
2. Require explicit wallet handoff or recovery acknowledgement before clearing bearer data.
3. Run payment, adversarial, recovery, full test, lint, check, and build gates.
4. Obtain independent review before re-enabling any payment write.
5. Publish a privacy-safe incident summary and update the relevant regression tests.
