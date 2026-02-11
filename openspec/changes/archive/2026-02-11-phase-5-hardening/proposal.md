## Why

The MVP features are complete (Phases 1-4) but the app needs security hardening,
performance optimization, and deployment preparation before going live at
https://tasks.fyi. Phase 5 (PRD Section 18) addresses Cashu token validation,
Nostr event signature verification, XSS-safe markdown rendering, bundle
optimization, IndexedDB cache management, rate limiting, offline resilience, and
production deployment configuration.

## What Changes

- Implement Cashu token validation against the mint before displaying pledge
  amounts (detect double-spend, expired tokens)
- Implement Nostr event signature verification before rendering (reject
  invalid/malformed events)
- Harden markdown rendering with XSS sanitization (test against known XSS
  payloads)
- Optimize bundle: code splitting, lazy loading for Cashu module, tree shaking
  audit to achieve < 200KB gzipped target
- Implement IndexedDB LRU cache eviction for old events to prevent unbounded
  storage growth
- Add client-side rate limiting for event publishing to prevent accidental spam
- Wrap all route pages in ErrorBoundary components for graceful degradation
- Add offline support: service worker for static assets, graceful degradation
  when relays are unreachable (show cached data with "Offline" banner)
- Configure production deployment: Cloudflare Pages or Vercel static hosting,
  custom domain (tasks.fyi), CSP headers blocking inline scripts/unauthorized
  origins
- Add client-side error logging infrastructure (optional Sentry or similar)
- Run full test suite (unit, integration, E2E) to verify no regressions
- Lighthouse audit to confirm Performance > 90, Accessibility > 90, Best
  Practices > 90

## Capabilities

### New Capabilities

- `token-validation`: Async Cashu token verification against mint — detect
  double-spend, expired, and invalid tokens with "unverified" badges (PRD
  Section 13.3)
- `event-validation`: Nostr event signature verification before rendering,
  malformed event rejection, required tag validation (PRD Section 13.4)
- `content-security`: XSS-safe markdown sanitization, CSP headers, input
  validation across all user-facing content (PRD Section 14.4)
- `performance-optimization`: Bundle code splitting, lazy loading for Cashu
  module, tree shaking, precompressed assets, < 200KB gzipped target (PRD
  Section 15)
- `cache-management`: IndexedDB LRU cache eviction policy for nostr-idb,
  configurable max event count/age (PRD Phase 5 deliverable 5)
- `rate-limiting`: Client-side publish rate limiting to prevent accidental event
  spam, configurable cooldown per event kind
- `offline-support`: Service worker for static assets, graceful offline mode
  showing cached data with reconnection banner (PRD Section 13.1)
- `deployment`: Static hosting configuration (Cloudflare Pages / Vercel), custom
  domain setup, CSP headers, precompression (PRD Phase 5 deliverable 9)

### Modified Capabilities

- `bounty-display-components`: All components now validate event signatures
  before rendering
- `cashu-payments`: Token amounts now verified against mint before display
- `shared-components`: Markdown component hardened with XSS sanitization
- `bounty-routes`: All route pages wrapped in ErrorBoundary
- `error-boundaries`: Coverage expanded to all routes

## Impact

- **New files**: ~10 files for service worker, deployment config, validation
  utilities, rate limiter
- **Modified files**: Markdown component (sanitization), all route pages
  (ErrorBoundary wrapping), pledge/token display components (validation badges),
  build config (code splitting)
- **Acceptance criteria** (from PRD Phase 5): No XSS in markdown rendering,
  invalid signatures rejected, invalid Cashu tokens show warning, bundle < 200KB
  gzipped, app works offline with cached data, deployed at tasks.fyi, CSP
  headers active, all tests pass in CI, Lighthouse > 90
