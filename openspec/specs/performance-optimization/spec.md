## Requirements

### Requirement: Manifest-Based Bundle Budgets

CI SHALL use the Vite manifest and `bundle-budgets.json` as the single source of
truth for gzip transfer budgets. It SHALL separately enforce the initial home
route (270 KiB), largest lazy asset (360 KiB), and total JavaScript/CSS (1284
KiB). Exceeding any budget SHALL fail the check.

### Requirement: Measured Performance Claims

Release validation SHALL measure mobile home and representative bounty-detail
first contentful paint, interaction readiness, main-thread cost, and
accessibility. Bundle-budget success SHALL not be presented as a Lighthouse or
production-speed result.

#### Scenario: No current audit evidence

- **WHEN** no dated production audit is attached to the launch checklist
- **THEN** documentation SHALL present performance values as targets or budgets,
  not achieved results
