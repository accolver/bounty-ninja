# Release Rollback Runbook

## Select A Known Artifact

1. Identify the last successful protected production workflow.
2. Download its retained `bounty-ninja-<commit>` artifact.
3. Verify `sha256sum --check bounty-ninja-build.tar.gz.sha256` before extraction.
4. Confirm `build/release.json` identifies the expected commit.

## Restore

1. Prefer an artifact with payment writes disabled.
2. Deploy the verified `build/` directory to Cloudflare Pages without rebuilding.
3. Do not use an unreviewed local working tree or `--commit-dirty` for incident rollback.
4. Serialize rollback with the production deployment concurrency group.

## Validate

Run `bun run smoke:deployment -- <deployment-url> https://bounty.ninja` with
`EXPECTED_RELEASE_SHA` set to the restored commit. Verify security headers,
service-worker cache policy, release identity, read-only bounty access, and disabled
payment actions. Record the workflow and artifact checksum in the incident log.
