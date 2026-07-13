# Payment Launch Checklist

This checklist defines evidence required before a production build may set
`PUBLIC_PAYMENT_WRITES_ENABLED=true`. Every gate below is **pending** unless a
dated artifact and reviewer are linked. Its presence does not mean a beta,
review, drill, or audit has occurred.

Do not use real funds for qualification. Use disposable test funds and wallets.
Do not place identity keys, payment keys, Cashu tokens/proofs, or secret URLs in
issues, logs, screenshots, or reports.

## Test-Funds Beta

- [ ] Name the beta owner, approved mint/version, app commit/artifact, test-fund
      ceiling per participant, total loss budget, dates, stop conditions, and
      incident contact.
- [ ] Recruit informed participants and provide the bearer-token, public-event,
      mint-trust, permanent no-locktime, wallet-backup, and non-cooperation warnings.
- [ ] Exercise create, manual Minibits pledge, solution payment-key declaration,
      weighted vote, one release per source, solver claim, Minibits Revert/retract,
      expiry, relay outage, mint outage, and browser reload.
- [ ] Record sanitized results and every loss, blocked operation, confusing
      instruction, unsupported wallet behavior, and recovery-required state.
- [ ] Close all safety-critical findings and obtain explicit go/no-go approval.

## Recovery Drill

- [ ] Use disposable test funds to interrupt each nonterminal journal stage:
      `prepared`, `awaiting-wallet`, `token-verified`, `source-spent`, `spending`,
      `outputs-created`, `event-signed`, `published`, and `recovery-required`.
- [ ] Reload/restart at each stage and verify recovery UI exposes the operation
      without repeating a mint spend or replacing an already signed event.
- [ ] Reject all relay publications after source spend, then verify the exact
      signed event can be retried and accepted with zero additional mint swaps.
- [ ] Verify recovery export, wallet handoff acknowledgement, redaction, service
      worker update blocking, and the documented lost-wallet/no-pending-send limit.
- [ ] Attach a dated, sanitized drill report with artifact identity, observers,
      outcomes, failures, and remediation links.

## Independent Payment Review

- [ ] Engage a reviewer independent of the implementation who is experienced
      with Cashu NUT-11 and `@cashu/cashu-ts` 3.4.1.
- [ ] Review the permanent one-signature `SIG_INPUTS`, no-locktime, no-refund-key
      Minibits policy and confirm it never becomes anyone-spendable.
- [ ] Review payment-tag parsing, x-only/compressed-key normalization, source
      binding, winner binding, mint/amount/proof validation, duplicate prevention,
      spent-source checks, and fail-closed mint behavior.
- [ ] Review manual release, solver claim, Revert/reclaim race warning, journal
      durability, exact-event retry, service-worker interaction, and diagnostics
      redaction.
- [ ] Resolve all critical/high findings and document disposition of lower
      findings in a dated report that identifies the reviewed commit.

## Wallet Interoperability

- [ ] Integrate and identify at least one compatible external Cashu wallet or
      payment signer; the current copy/paste Minibits workflow alone is not this
      integration.
- [ ] Verify on named wallet and mint versions: permanent pledge creation,
      source authorization, solver-locked output creation, claim, Revert/reclaim,
      cancellation, reload recovery, and user denial.
- [ ] Document supported and unsupported wallets without implying generic token
      import can spend NUT-11-locked proofs.

## Accessibility

- [ ] Run automated critical-route checks plus manual keyboard-only and screen
      reader tests on home, bounty create/detail, pledge, solution, vote, release,
      claim, reclaim, recovery, settings, and error states.
- [ ] Test Chromium, Firefox, WebKit, 375px mobile, 200% zoom/reflow, visible
      focus, labels/errors, landmarks/headings, dialogs, live status, contrast, and
      reduced motion against WCAG 2.1 AA.
- [ ] Have a qualified reviewer record assistive technology/browser versions,
      findings, evidence, remediation, and explicit approval. Automated passing
      tests alone do not complete this gate.

## Release And Operations

- [ ] Complete all production-hardening tasks and run the full pinned quality,
      coverage, E2E, build, header, bundle, and deployed-domain smoke suite on the
      exact retained artifact.
- [ ] Record measured mobile home/detail performance. Report measured values;
      do not convert bundle budgets into Lighthouse claims.
- [ ] Verify protected production approval, artifact checksum, release identity,
      payment-enabled configuration diff, deployment serialization, and automatic
      failure reporting.
- [ ] In Cloudflare Pages, disable Web Analytics/automatic analytics injection and record
      dated dashboard evidence. This setting is external to the repository and is not
      complete merely because the application contains no analytics code.
- [ ] Rehearse payment disablement and Cloudflare rollback; verify read-only
      access remains available and capture recovery time.
- [ ] Confirm incident, outage, disclosure, credential-rotation, recovery, and
      communication runbooks have named owners and current contacts.
- [ ] Obtain final sign-off from the release owner, independent payment reviewer,
      accessibility reviewer, and operations owner before changing the flag.
- [ ] After deployment, verify the custom domain, headers, release identity,
      payment flag, disabled fallback, one disposable end-to-end transaction, and
      rollback readiness. Immediately disable or roll back on any mismatch.
