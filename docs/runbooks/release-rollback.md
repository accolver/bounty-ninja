# Release Rollback Runbook

## Select A Known Artifact

1. Identify the last successful protected production workflow.
2. Confirm the artifact still exists. Verified build artifacts are retained for 30 days;
   Playwright diagnostics are retained for 14 days and are not rollback artifacts.
3. Dispatch `Production rollback` with that successful CI run ID and its full commit SHA.
4. Before downloading an artifact, the protected workflow queries GitHub and requires that
   run to be the repository's `CI` workflow, a successful `push` on `main`, and an exact
   match for the supplied full commit SHA. It also requires that commit to remain an
   ancestor of current `origin/main`.
5. The workflow checks out that exact source commit under an isolated `source/` directory
   for validation and smoke runtime files, but deploys only the retained artifact extracted
   to `build/`. It verifies the archive checksum, payload digest, source run, commit,
   `deploymentChannel`, timestamp, and disabled payment-write flag before upload. Its gate is
   `sha256sum --check bounty-ninja-build.tar.gz.sha256`.

## Restore

1. Prefer an artifact with payment writes disabled.
2. Deploy the verified `build/` directory to Cloudflare Pages without rebuilding. The
   workflow uses the protected `production` environment and `production-deploy` concurrency.
3. Do not use an unreviewed local working tree or `--commit-dirty` for incident rollback.
4. Serialize rollback with the production deployment concurrency group.

## Validate

Run `bun run smoke:deployment -- <deployment-url> https://bounty.ninja` with
`EXPECTED_RELEASE_SHA` set to the restored commit. Verify security headers,
service-worker cache policy, release identity, read-only bounty access, and disabled
payment actions. Record the workflow and artifact checksum in the incident log.

## Rehearsal And Retention

Rehearse the workflow with a retained payment-disabled artifact at least quarterly and
after changing deployment credentials or workflow permissions. Record the date, operators,
source run/artifact, checksum, deployment URL, smoke result, and recovery time in the
incident log. A documented procedure is not evidence that a rehearsal occurred; keep the
launch checklist rollback item open until dated evidence and owner approval exist.
