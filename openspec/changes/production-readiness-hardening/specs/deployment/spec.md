## MODIFIED Requirements

### Requirement: CI/CD Pipeline

The deployment pipeline MUST use pinned Bun and action versions and execute frozen install, formatting, ESLint, Svelte/TypeScript checking with warnings treated according to policy, unit tests with coverage, integration tests, hermetic E2E, production build, header assertions, bundle budgets, dependency/secret scanning, and artifact checksums. It SHALL build once and deploy that exact artifact through a protected production environment.

#### Scenario: Any quality gate fails
- **WHEN** any required validation, test, security, build, header, or budget gate fails
- **THEN** no production deployment SHALL occur

#### Scenario: Verified artifact deploys
- **WHEN** all gates pass
- **THEN** CI SHALL deploy the checksummed artifact that passed the gates
- **AND** SHALL run smoke tests against the deployment and custom domain

#### Scenario: Concurrent releases
- **WHEN** multiple production deployments are requested
- **THEN** deployment concurrency SHALL prevent an older artifact from racing or replacing a newer verified release

## ADDED Requirements

### Requirement: Reproducible Toolchain and Rollback

Bun, Node, Wrangler, Playwright browsers, GitHub Actions, local relay tooling, and production-critical dependencies SHALL be pinned. Each release SHALL record commit and artifact identity and SHALL have a tested rollback procedure.

#### Scenario: Production rollback
- **WHEN** post-deploy smoke tests fail or an incident is declared
- **THEN** operators SHALL restore a known verified artifact using the documented runbook
