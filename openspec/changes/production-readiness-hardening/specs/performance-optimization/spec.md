## ADDED Requirements

### Requirement: Layered Performance Budgets

CI SHALL enforce separate gzip budgets for initial route JavaScript/CSS, the largest lazy chunk, and total application assets. The budget calculation SHALL use the Vite manifest to avoid treating every lazy asset as initial load. Budget values SHALL be documented in one source of truth and ratcheted downward from a measured baseline.

#### Scenario: Oversized editor chunk
- **WHEN** the Markdown editor lazy chunk exceeds its configured budget
- **THEN** CI SHALL fail rather than suppressing the warning

#### Scenario: Initial route regression
- **WHEN** a change increases initial route transfer beyond its budget
- **THEN** deployment SHALL be blocked even if total assets remain within budget

### Requirement: Performance Verification

Release validation SHALL measure mobile first-contentful paint, interaction readiness, accessibility, and main-thread cost on representative home and bounty-detail fixtures.

#### Scenario: Mobile performance regression
- **WHEN** the production artifact misses the agreed mobile thresholds
- **THEN** the release SHALL require explicit review and MUST NOT claim the documented performance target
