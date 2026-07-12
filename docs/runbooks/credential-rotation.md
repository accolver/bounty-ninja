# Credential Rotation Runbook

Cloudflare credentials are deployment-only secrets. They must never enter the
client bundle, diagnostics, logs, Nostr events, or repository.

1. Pause production deployments and revoke the suspected token in Cloudflare.
2. Create a least-privilege Pages deployment token for the `bounty-ninja` project.
3. Replace `CLOUDFLARE_API_TOKEN` and, if required, `CLOUDFLARE_ACCOUNT_ID` in the protected GitHub `production` environment.
4. Review environment protection rules and authorized reviewers.
5. Run CI and deploy a payment-disabled verified artifact through the protected environment.
6. Confirm `/release.json`, custom-domain headers, and post-deploy smoke tests.
7. Review GitHub and Cloudflare audit logs without copying secret values into reports.

For a compromised GitHub account or action, revoke sessions/tokens, rotate affected
credentials, verify pinned action SHAs, and rebuild from a known reviewed commit.
