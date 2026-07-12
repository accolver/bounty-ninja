# Relay And Mint Outage Runbook

## Relay Outage

1. Confirm browser connectivity separately from relay connectivity.
2. Test configured relays without adding secret-bearing query parameters.
3. Keep verified cache data available and label relay freshness as stale or unavailable.
4. Do not infer event absence, consensus, cancellation, or completion from an incomplete relay view.
5. Restore relays through reviewed configuration and reload the SPA to recreate the singleton pool.

## Mint Outage

1. Disable payment writes if they are not already disabled.
2. Mark proof verification unavailable, never valid, and block financial actions.
3. Preserve operation journals and recovery material across reloads.
4. Do not repeatedly probe unrelated pledges or claim that mint proof state proves solvency.
5. Resume only after supported protocol checks pass against the same normalized mint.

## Verification

Confirm read-only bounty access, cached navigation, explicit retry controls, and no
false funded/completed state. Record only aggregate outage categories and release identity.
