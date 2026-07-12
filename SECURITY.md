# Security Policy

## Supported Version

Only the current production deployment at `https://bounty.ninja` and the latest
commit on `main` receive security fixes. Payment writes are disabled by default
until every production-readiness payment gate is complete.

## Reporting A Vulnerability

Do not disclose an exploitable issue in a public issue, relay event, or social
post. Use GitHub private vulnerability reporting at:

`https://github.com/accolver/bounty-ninja/security/advisories/new`

Include affected commit or release ID, reproduction steps, impact, and whether
Cashu bearer material or Nostr identity signing may be involved. Never include
real private keys, tokens, proofs, or credentials. Use test fixtures only.

## Response Targets

- Acknowledge a report within 3 business days.
- Triage payment loss, key exposure, or remote-code execution within 24 hours.
- Keep the reporter informed at material status changes.
- Coordinate disclosure after a verified fix or mitigation is deployed.

## Scope

High-priority issues include unsafe Cashu spends, payout redirection, proof
replay, identity-key exposure, event-validation bypass, XSS, CSP bypass,
malicious relay ingestion, recovery-data loss, and deployment compromise.

Relay availability, mint solvency, and vulnerabilities in browser extensions or
external wallets are upstream concerns unless Bounty.ninja handles their failure
unsafely.

## Incident Handling

Operators follow the runbooks under `docs/runbooks/`. The first response to any
suspected payment-safety issue is to keep or restore
`PUBLIC_PAYMENT_WRITES_ENABLED=false`; read-only bounty access must remain
available whenever possible.
