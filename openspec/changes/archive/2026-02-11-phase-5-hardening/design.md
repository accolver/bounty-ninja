## Context

Phases 1–4 of Tasks.fyi are complete: the application has Nostr relay
connectivity, bounty data models and reactive stores, a full read-only UI, all
write operations (create, fund, solve, vote, payout), NIP-50 search, category
filtering, settings, and UI polish. The app is functionally complete as an MVP.

However, the application currently lacks the security hardening, performance
optimization, and deployment configuration required for production use at
https://tasks.fyi. Specifically:

- Nostr events from relays are rendered without signature verification — a
  malicious relay could inject fabricated events.
- Cashu token amounts in pledge events are displayed at face value without mint
  verification — double-spent or invalid tokens could inflate bounty totals.
- Markdown content from bounty descriptions and solutions is rendered without
  XSS sanitization — a malicious user could inject scripts.
- The JavaScript bundle includes all modules upfront, including the heavy
  `@cashu/cashu-ts` library, impacting initial load time.
- The IndexedDB event cache grows without bound, eventually consuming
  significant storage on the user's device.
- No client-side rate limiting exists for event publishing, making accidental
  spam possible.
- The app has no offline resilience — if relays are unreachable, the user sees
  errors instead of cached data.
- No production hosting, custom domain, CSP headers, or CI/CD pipeline exists.

Phase 5 addresses all of these gaps to make the application production-ready.

## Goals

- **Security audit and hardening**: Verify all Nostr event signatures before
  rendering. Validate Cashu token proofs against the issuing mint. Sanitize all
  markdown output to prevent XSS. Configure CSP headers to block unauthorized
  resource loading.
- **Performance optimization**: Achieve < 200KB gzipped bundle via dynamic
  imports for Cashu, route-based code splitting, and tree shaking. Meet
  Lighthouse Performance > 90.
- **Reliability**: Implement IndexedDB cache eviction to prevent unbounded
  storage growth. Add client-side rate limiting to prevent accidental event
  spam. Ensure graceful offline degradation with cached data display.
- **Deployment**: Deploy the static SPA to Cloudflare Pages at https://tasks.fyi
  with HTTPS, security headers, precompressed assets, and a CI/CD pipeline that
  runs the full test suite before every deployment.
- **Accessibility and best practices**: Achieve Lighthouse Accessibility > 90
  and Best Practices > 90.

## Non-Goals

- **New features**: No new user-facing features are added in Phase 5. The bounty
  lifecycle, search, settings, and all write operations remain unchanged.
- **DVM / ContextVM integration**: Deferred to Phase 6 (post-MVP).
- **Multi-mint Cashu support**: MVP continues to use a single configured mint.
- **NIP-60 wallet UI**: Full in-app Cashu wallet management is out of scope.
- **Notification system**: NIP-04 DMs for bounty updates are deferred.
- **Server-side validation**: The app remains a static SPA with no backend. All
  validation is client-side.
- **Relay-side rate limiting**: The rate limiter is client-side only; relay-side
  enforcement is outside our control.

## Decisions

### D1: Lazy Token Validation with "Unverified" Badges

**Decision**: Cashu token verification against the mint is performed lazily —
only when a pledge becomes visible (bounty detail page load or viewport
intersection). Unverified pledges display an "Unverified pledge" badge rather
than blocking the UI.

**Rationale**: Eager validation of all pledge tokens on the home page would
create excessive mint requests and slow down the bounty list. Most users
browsing the home page do not need proof-level verification of every pledge.
Lazy validation provides security where it matters (bounty detail view) without
degrading the browsing experience.

**Trade-off**: Users on the home page see pledge totals that may include
unverified amounts. The bounty detail page shows accurate, verified totals. This
is acceptable because the home page is for discovery, not financial
decision-making.

### D2: DOMPurify for Markdown Sanitization

**Decision**: Use DOMPurify as the HTML sanitization library for all
markdown-rendered content.

**Rationale**: DOMPurify is the industry-standard client-side HTML sanitizer. It
is actively maintained, has extensive XSS payload coverage, supports
configurable allow/block lists, and is small (~7KB minified + gzipped). It
handles edge cases like double-encoded payloads, mutation XSS, and DOM
clobbering that simpler regex-based sanitizers miss.

**Alternative considered**: `sanitize-html` — rejected because it is larger and
primarily designed for server-side use. DOMPurify leverages the browser's native
DOM parser for more reliable sanitization.

### D3: Dynamic Imports for Cashu Module

**Decision**: All `@cashu/cashu-ts` imports and `src/lib/cashu/*` modules are
loaded via dynamic `import()` and excluded from the initial bundle.

**Rationale**: `@cashu/cashu-ts` is one of the largest dependencies due to its
cryptographic operations (NUT-11 P2PK, token encoding/decoding). Most page views
(home page, search, profiles) do not require Cashu functionality. Dynamic
importing reduces the initial bundle by approximately 40-60KB gzipped, helping
meet the < 200KB target.

**Implementation**: A `loadCashuModule()` async function wraps the dynamic
import and caches the module reference. Components that need Cashu (PledgeForm,
PledgeItem, TokenValidator) call this function and show a brief loading state
while the chunk downloads.

### D4: Workbox for Service Worker

**Decision**: Use Workbox (via `workbox-webpack-plugin` or `workbox-build`) to
generate the service worker for offline static asset caching.

**Rationale**: Workbox provides battle-tested caching strategies (cache-first
for static assets, network-first for API calls), automatic precaching of build
output, cache versioning, and update detection. Writing a custom service worker
from scratch would be error-prone and harder to maintain.

**Strategy**:

- **Precache**: All static assets from the Vite build output (HTML, CSS, JS,
  images).
- **Runtime cache**: None for relay WebSocket connections (not cacheable). Cashu
  mint HTTP responses are not cached by the service worker (handled by the
  TokenValidator's in-memory cache).
- **Update flow**: When a new service worker is detected, show a "New version
  available" banner. User clicks to activate and reload.

### D5: Cloudflare Pages for Hosting

**Decision**: Deploy to Cloudflare Pages rather than Vercel or Netlify.

**Rationale**: Cloudflare Pages offers free static hosting with global CDN,
automatic HTTPS, custom domain support, preview deployments for PRs, and native
support for `_headers` and `_redirects` files. The free tier is generous
(unlimited bandwidth, 500 builds/month). Cloudflare's edge network provides
excellent global latency for a decentralized application whose users may be
anywhere.

**Alternative considered**: Vercel — viable but adds unnecessary complexity
(serverless functions we don't need) and has stricter free-tier limits on
bandwidth.

### D6: Event Signature Verification at Ingestion

**Decision**: Verify Nostr event signatures at the point of ingestion (when
events arrive from relays or are loaded from IndexedDB), not at render time.

**Rationale**: Verifying at ingestion ensures that invalid events never enter
the `EventStore`, which is the single source of truth. This is simpler and more
secure than verifying at render time, where a missed check could display
unverified data. The `verifyEvent()` function from `nostr-tools` is fast (< 1ms
per event) so the overhead is negligible.

**Implementation**: A wrapper around the relay subscription handler and the
IndexedDB cache loader that calls `verifyEvent()` before `eventStore.add()`.

### D7: LRU Cache Eviction with User Event Protection

**Decision**: The IndexedDB cache eviction policy uses LRU (Least Recently Used)
ordering with explicit protection for the current user's events and events
related to their active bounties.

**Rationale**: Simple age-based eviction would delete events that the user
actively cares about (their own bounties, pledges they made). LRU with user
protection ensures the cache remains useful for the user's primary workflows
while still bounding storage growth.

**Default limits**: 10,000 events maximum, 30 days maximum age. These are
configurable via the Settings page.

### D8: Client-Side Rate Limiting Per Event Kind

**Decision**: Rate limiting is implemented per event kind with configurable
cooldown periods. State is in-memory only (not persisted across page reloads).

**Rationale**: Different event kinds have different legitimate publishing
frequencies. Votes should be fast (5s cooldown), bounty creation should be
slower (30s cooldown). In-memory-only state prevents users from being locked out
after a page refresh, which would be a poor UX for a client-side-only
application.

## Risks and Trade-offs

### R1: Token Validation Latency

**Risk**: Cashu mint verification adds network latency to the bounty detail
page. If the mint is slow or unreachable, pledge verification status may remain
"pending" or "unverified" for extended periods.

**Mitigation**: Lazy validation with cached results (5-minute TTL). The UI shows
pledge amounts immediately with a "pending" badge, upgrading to "verified" or
"unverified" as results arrive. The bounty detail page is usable before
verification completes.

### R2: Service Worker Cache Invalidation

**Risk**: Stale service worker caches could serve outdated JavaScript after a
deployment, causing bugs or broken functionality.

**Mitigation**: Workbox's precache manifest includes content hashes for all
assets. When a new deployment changes any file, the service worker detects the
hash mismatch and downloads updated assets. The "New version available" banner
prompts users to reload. The `index.html` file is served with
`Cache-Control: no-cache` to ensure the browser always checks for a new service
worker.

### R3: CSP Strictness vs. Functionality

**Risk**: An overly strict CSP could break legitimate functionality — for
example, blocking WebSocket connections to user-configured relays, blocking
images in markdown content, or breaking Tailwind CSS runtime styles.

**Mitigation**: The CSP uses `connect-src 'self' wss: https:` to allow
connections to any relay or mint. `img-src 'self' https: data:` allows external
images. `style-src
'self' 'unsafe-inline'` is required for Tailwind's runtime
style injection. These directives are tested against all application features
before deployment.

### R4: Client-Side-Only Security Limitations

**Risk**: All security measures (signature verification, token validation, XSS
sanitization, rate limiting) are client-side only. A sophisticated attacker
could bypass them by modifying the JavaScript or using a custom client.

**Mitigation**: This is an inherent limitation of a static SPA with no backend.
The security measures protect honest users from malicious content on relays.
They do not and cannot prevent a determined attacker from publishing invalid
events to relays. The Nostr protocol's signature-based identity model provides
the foundational trust layer — events are only as trustworthy as the pubkey that
signed them.

### R5: IndexedDB Storage Limits

**Risk**: Different browsers impose different IndexedDB storage limits. The
cache eviction policy may not prevent storage quota errors on devices with very
limited storage.

**Mitigation**: The `CacheMonitor` exposes storage usage on the Settings page.
The eviction policy runs proactively (on startup and every 30 minutes). If an
IndexedDB write fails due to quota, the error is caught and the cache eviction
is triggered immediately with more aggressive limits (50% of current count).

### R6: Bundle Size Creep

**Risk**: Future development (Phase 6 DVM integration, additional features)
could push the bundle past the 200KB gzipped target.

**Mitigation**: The CI pipeline includes a bundle size check that fails the
build if the target is exceeded. Dynamic imports establish a pattern for keeping
heavy modules out of the initial bundle. The 200KB target applies to the initial
load — dynamically imported chunks are excluded from this measurement.
