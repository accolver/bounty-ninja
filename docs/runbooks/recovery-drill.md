# Payment Recovery Drill

Run this drill only with test funds and isolated infrastructure.

1. Start a clean pinned relay and deterministic mock mint.
2. Create one payment operation and stop after each irreversible boundary in separate runs.
3. Reload the browser after `prepared`, `spending`, `outputs-created`, `event-signed`, and `published`.
4. Confirm the journal surfaces the operation and never repeats a completed mint spend.
5. Reject publication on all relays and confirm `recovery-required` retains the exact signed event and safe recovery action.
6. Export recovery data and verify no copy enters diagnostics, logs, screenshots, or telemetry.
7. Resume publication with the exact event, obtain one relay acknowledgement, and confirm wallet handoff.
8. Verify secret recovery material is cleared only after acknowledgement and handoff.
9. Record date, release, participants, scenarios, results, and follow-up issues without bearer material.

The drill fails if funds become unrecoverable, a mint spend repeats, publication uses
a different event, payment state affects unverified projections, or secrets appear in diagnostics.
