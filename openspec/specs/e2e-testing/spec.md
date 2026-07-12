## Requirements

### Requirement: Hermetic Browser Matrix

Playwright SHALL use a clean local relay, deterministic mock mint, injected
test-only NIP-07 identities, and no public financial services. It SHALL run
Chromium, Firefox, WebKit, a 375px project, and a separate service-worker update
scenario with retained failure artifacts.

### Requirement: Financial And Recovery Coverage

The suite SHALL cover create, manual pledge validation, solution payment key,
weighted vote, unique and ambiguous consensus, one release per source, solver
claim, Revert/retraction, invalid signatures/events, duplicate/spent proofs,
wrong amount/mint/key, payout redirection, relay rejection, reload, exact-event
retry, and every nonterminal journal stage.

#### Scenario: Publish fails after source spend

- **WHEN** all relays reject a payout after Minibits consumed the source
- **THEN** reload SHALL expose recovery-required state
- **AND** retry SHALL publish the same signed event with no additional mint swap

### Requirement: Accessibility Coverage

Automated E2E SHALL check critical-route landmarks, names/labels, focus,
keyboard access, and mobile visibility. These checks SHALL NOT be described as a
completed manual WCAG audit; launch requires separate dated evidence in
`LAUNCH_CHECKLIST.md`.

Exact test counts SHALL come from runner output and SHALL not be maintained as
static documentation claims.
