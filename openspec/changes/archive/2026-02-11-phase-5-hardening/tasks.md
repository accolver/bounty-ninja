# Phase 5: Hardening — Tasks

## 1. Event Validation

- [x] 1.1 Create `src/lib/nostr/event-validator.ts` — implement
      `validateEvent()` wrapper that calls `verifyEvent()` from `nostr-tools`,
      logs rejected events to console
      (`"Rejected event with invalid signature: <event.id>"`), and returns
      `boolean`
- [x] 1.2 Create `src/lib/nostr/tag-validator.ts` — implement per-kind required
      tag validation: Kind 37300 requires `d`, `title`/`subject`, `reward`
      (positive integer); Kind 73002 requires `a` (format
      `37300:<hex>:<d-tag>`), `amount` (positive integer), `cashu` (non-empty),
      `mint` (valid URL); Kind 73001 requires `a` and non-empty `content`; Kind
      1018 requires `a`, `e`, `vote` (`"approve"` | `"reject"`); Kind 73004
      requires `a`, `e`, and pubkey matching task creator
- [x] 1.3 Integrate signature verification at relay ingestion — wrap the relay
      subscription handler in `src/lib/nostr/relay-pool.ts` to call
      `validateEvent()` before `eventStore.add()`; silently discard invalid
      events
- [x] 1.4 Integrate signature verification at IndexedDB load — wrap the cache
      loader in `src/lib/nostr/cache.ts` to verify each event loaded from
      `nostr-idb`; delete events that fail verification from IndexedDB
- [x] 1.5 Integrate tag validation into task/pledge/solution/vote parsing —
      update `src/lib/task/helpers.ts` to call tag validators before
      constructing domain objects; skip and log events with missing/invalid
      required tags
- [x] 1.6 Add payout event authorization check — in the payout event parser,
      verify Kind 73004 `pubkey` matches the task creator's pubkey; ignore
      unauthorized payout events
- [x] 1.7 Add vote-from-non-pledger filtering — in `src/lib/task/voting.ts`,
      ensure Kind 1018 votes from pubkeys without a Kind 73002 pledge for the
      referenced task have zero weight
- [x] 1.8 Write unit tests `src/tests/unit/event-validator.test.ts` — test valid
      event passes, invalid signature rejected, malformed event rejected
- [x] 1.9 Write unit tests `src/tests/unit/tag-validator.test.ts` — test each
      kind's required tags: missing `d` tag, invalid reward, missing `a` tag,
      empty `cashu` tag, invalid vote value, empty solution content,
      unauthorized payout pubkey

## 2. Token Validation

- [x] 2.1 Create `src/lib/cashu/token-validator.svelte.ts` — implement
      `TokenValidator` class with `$state` for per-token
      `TokenVerificationStatus`
      (`"pending" | "verified" | "unverified" | "invalid" | "expired"`); expose
      `verify(token: string, mintUrl: string): void` method
- [x] 2.2 Implement mint verification logic — use `@cashu/cashu-ts`
      `CashuMint.check()` (or equivalent proof state check) to determine if
      proofs are spendable; set status to `"verified"` on success, `"invalid"`
      on spent proofs
- [x] 2.3 Implement retry logic for unreachable mints — retry up to 3 times with
      2-second delay; set status to `"unverified"` if all retries fail
- [x] 2.4 Implement malformed token detection — catch decode errors (invalid
      base64, missing fields, unsupported version) and set status to `"invalid"`
- [x] 2.5 Implement P2PK locktime expiry detection — check token's P2PK lock
      `locktime` field; set status to `"expired"` if timestamp is in the past;
      show "Reclaim" action for the pledge funder
- [x] 2.6 Implement verification result caching — cache results in-memory keyed
      by hash of serialized token string; TTL of 5 minutes; re-verify on next
      access after expiry
- [x] 2.7 Integrate `TokenValidator` into
      `src/lib/components/pledge/PledgeItem.svelte` — trigger lazy verification
      when pledge becomes visible (viewport intersection or task detail page
      load); display status badge ("Pending", "Verified", "Unverified",
      "Invalid", "Expired")
- [x] 2.8 Integrate `TokenValidator` into
      `src/lib/components/pledge/PledgeList.svelte` — display verification
      badges per pledge
- [x] 2.9 Update `src/lib/components/task/TaskCard.svelte` — adjust
      `totalPledged` to include only `"verified"` and `"unverified"` pledges;
      exclude `"invalid"` pledges from the total
- [x] 2.10 Write unit tests `src/tests/unit/token-validator.test.ts` — test
      valid token verified, double-spent detected, mint unreachable retries and
      falls back to unverified, malformed token rejected, expired locktime
      detected, cache hit avoids mint request, cache expiry triggers
      re-verification

## 3. Content Security

- [x] 3.1 Install DOMPurify — `bun add dompurify` and
      `bun add -d @types/dompurify`
- [x] 3.2 Create `src/lib/utils/sanitize.ts` — configure DOMPurify with
      `ALLOWED_TAGS` (p, h1-h6, a, img, ul, ol, li, code, pre, blockquote,
      table, thead, tbody, tr, th, td, em, strong, del, br, hr, details,
      summary), `ALLOWED_ATTR` (href, src, alt, title, class, id, target, rel),
      `ALLOW_DATA_ATTR: false`, `FORBID_TAGS` (script, iframe, object, embed,
      form, style, input, textarea, select, button), `FORBID_ATTR` (onerror,
      onclick, onload, onmouseover, onfocus, onblur); export
      `sanitizeHtml(html: string): string`
- [x] 3.3 Integrate DOMPurify into `src/lib/components/shared/Markdown.svelte` —
      pipe markdown-to-HTML output through `sanitizeHtml()` before DOM
      insertion; ensure external links get `target="_blank"` and
      `rel="noopener noreferrer"`
- [x] 3.4 Add input length validation to
      `src/lib/components/task/TaskForm.svelte` — title max 200 chars,
      description max 50,000 chars; show validation error and block submission
      on exceed
- [x] 3.5 Add input length validation to
      `src/lib/components/solution/SolutionForm.svelte` — content max 100,000
      chars
- [x] 3.6 Write unit tests `src/tests/unit/sanitize.test.ts` — test XSS
      payloads: `<script>alert('xss')</script>` stripped,
      `<img onerror="alert('xss')">` attribute stripped, `javascript:` protocol
      links neutralized, double-encoded payloads blocked, `<iframe>` removed,
      `data-*` attributes removed; test legitimate markdown renders correctly
      (headings, bold, code blocks, links, images, tables)

## 4. Rate Limiting

- [x] 4.1 Create `src/lib/nostr/rate-limiter.ts` — implement `RateLimiter` class
      with per-kind cooldown tracking; default cooldowns: Kind 37300 = 30s, Kind
      73001 = 60s, Kind 73002 = 10s, Kind 1018 = 5s, Kind 73004 = 60s; expose
      `canPublish(kind: number, dTag?: string): { allowed: boolean; remainingMs: number }`
      and `recordPublish(kind: number, dTag?: string): void`
- [x] 4.2 Implement reduced cooldown for replaceable event updates — Kind 37300
      with same `d` tag uses 10s cooldown instead of 30s; new tasks
      (different `d` tag) use standard 30s
- [x] 4.3 Integrate rate limiter into
      `src/lib/components/task/TaskForm.svelte` — check `canPublish()`
      before submit; disable button during cooldown; show countdown ("Wait 25s")
- [x] 4.4 Integrate rate limiter into
      `src/lib/components/pledge/PledgeForm.svelte` — check before pledge
      publish; disable and show countdown
- [x] 4.5 Integrate rate limiter into
      `src/lib/components/solution/SolutionForm.svelte` — check before solution
      publish; disable and show countdown
- [x] 4.6 Integrate rate limiter into
      `src/lib/components/voting/VoteButton.svelte` — check before vote publish;
      disable and show countdown
- [x] 4.7 Integrate rate limiter into payout trigger — check before Kind 73004
      publish; disable and show countdown
- [x] 4.8 Write unit tests `src/tests/unit/rate-limiter.test.ts` — test cooldown
      blocks same kind, different kinds are independent, cooldown expiry allows
      publish, replaceable event reduced cooldown, state resets on construction
      (simulating page reload)

## 5. Cache Management

- [x] 5.1 Create `src/lib/nostr/cache-eviction.ts` — implement LRU eviction
      policy for `nostr-idb`; default limits: 10,000 events max, 30 days max
      age; evict to 90% of max (9,000) when exceeded; age-based eviction runs
      before count-based
- [x] 5.2 Implement user event protection — never evict events authored by the
      current user's pubkey or events related to tasks the user created or
      pledged to
- [x] 5.3 Implement non-blocking scheduling — run eviction via
      `requestIdleCallback` (or `setTimeout` fallback); schedule on startup
      (after initial load) and every 30 minutes
- [x] 5.4 Implement emergency eviction on quota error — catch IndexedDB write
      failures; trigger immediate eviction at 50% of current count
- [x] 5.5 Create `src/lib/nostr/cache-monitor.svelte.ts` — expose reactive
      `$state` for event count and estimated storage bytes (human-readable
      format)
- [x] 5.6 Add cache statistics to `src/routes/settings/+page.svelte` — display
      current event count, estimated storage size; add "Clear Cache" button that
      clears IndexedDB, clears `EventStore`, re-fetches from relays, shows
      confirmation toast
- [x] 5.7 Add configurable cache limits to Settings page — inputs for max event
      count and max age (days); persist to `localStorage`; apply on next
      eviction cycle
- [x] 5.8 Write unit tests `src/tests/unit/cache-eviction.test.ts` — test
      eviction triggers at max count, age-based eviction removes old events,
      user events are protected, emergency eviction at 50%, configurable limits
      applied

## 6. Performance Optimization

- [x] 6.1 Create `src/lib/cashu/loader.ts` — implement `loadCashuModule()` async
      wrapper that dynamically imports `@cashu/cashu-ts` and all
      `src/lib/cashu/*` modules; cache the module reference after first load
- [x] 6.2 Convert all static Cashu imports to dynamic — update
      `PledgeForm.svelte`, `PledgeItem.svelte`, `TokenValidator`, and payout
      components to use `loadCashuModule()`; show brief loading indicator while
      chunk downloads
- [x] 6.3 Verify route-based code splitting — confirm Vite produces separate
      chunks for `/`, `/task/[naddr]`, `/task/new`, `/profile/[npub]`,
      `/search`, `/settings`; adjust `vite.config.ts` `build.rollupOptions` if
      needed
- [x] 6.4 Audit tree shaking — ensure all imports from `nostr-tools`, `rxjs`,
      `@cashu/cashu-ts` use named imports from specific subpaths; replace any
      wildcard/barrel imports
- [x] 6.5 Enable precompressed assets — set `precompress: true` in
      `svelte.config.js` `adapter-static` options to generate `.gz` and `.br`
      files
- [x] 6.6 Optimize static assets — minify SVG files (logo, favicon); ensure Open
      Graph image is 1200x630px and < 200KB
- [x] 6.7 Add `@noble/curves` and `@noble/hashes` to Vite `optimizeDeps.exclude`
      — ensure WASM compatibility per AGENTS.md
- [x] 6.8 Create bundle size check script — `scripts/check-bundle-size.sh` that
      runs `bun run build`, measures gzipped size of all `.js` files in
      `build/`, fails if total exceeds 200KB
- [x] 6.9 Run bundle analysis and verify < 200KB gzipped — execute the check
      script; iterate on splitting/tree-shaking if target not met

## 7. Error Boundaries

- [x] 7.1 Verify `src/lib/components/shared/ErrorBoundary.svelte` exists and
      handles errors gracefully — component should catch rendering errors,
      display user-friendly fallback, and offer retry
- [x] 7.2 Wrap `src/routes/+page.svelte` (home page) in ErrorBoundary
- [x] 7.3 Wrap `src/routes/task/[naddr]/+page.svelte` (task detail) in
      ErrorBoundary
- [x] 7.4 Wrap `src/routes/task/new/+page.svelte` (create task) in
      ErrorBoundary
- [x] 7.5 Wrap `src/routes/profile/[npub]/+page.svelte` (profile) in
      ErrorBoundary
- [x] 7.6 Wrap `src/routes/search/+page.svelte` (search) in ErrorBoundary
- [x] 7.7 Wrap `src/routes/settings/+page.svelte` (settings) in ErrorBoundary

## 8. Offline Support

- [x] 8.1 Install Workbox — `bun add -d workbox-build`
- [x] 8.2 Create `src/service-worker.ts` — implement service worker using
      Workbox with cache-first strategy for static assets (HTML, CSS, JS,
      images, fonts); no caching for WebSocket connections or Cashu mint HTTP
      responses
- [x] 8.3 Create Workbox build integration — add a Vite plugin or post-build
      script that generates the precache manifest from `build/` output with
      content hashes
- [x] 8.4 Register service worker in `src/routes/+layout.svelte` — register on
      startup; do not block initial render
- [x] 8.5 Implement update detection banner — when new service worker detected,
      show non-intrusive "New version available. Refresh to update." banner;
      clicking activates new worker and reloads
- [x] 8.6 Create `src/lib/stores/connectivity.svelte.ts` — reactive offline
      status detection using `navigator.onLine` API and relay connection state
      from `RelayPool`; app is "offline" when `navigator.onLine === false` OR
      all relays disconnected
- [x] 8.7 Create offline banner component — persistent top banner: "Offline —
      showing cached data. Reconnecting..." when offline; "Relays unreachable —
      showing cached data. Reconnecting..." when browser online but relays down;
      dismiss with "Back online" toast on reconnection
- [x] 8.8 Implement reconnection with exponential backoff — 1s, 2s, 4s, 8s, max
      30s; re-subscribe to active queries on reconnection; merge new events with
      cached data
- [x] 8.9 Disable write operations when offline — all publish buttons
      (TaskForm, PledgeForm, SolutionForm, VoteButton, payout) show offline
      message; preserve form data (do not clear)
- [x] 8.10 Implement graceful feature degradation — search bar disabled with
      "Search unavailable offline" placeholder; profile pages show cached data
      with "Showing cached profile" note or "Profile unavailable offline" empty
      state
- [x] 8.11 Write integration tests `src/tests/integration/offline.test.ts` —
      test cached data displays when offline, offline banner appears, write
      operations disabled, reconnection dismisses banner

## 9. Deployment Configuration

- [x] 9.1 Create `static/_headers` file — define security headers for all routes
      (`/*`): `Content-Security-Policy` (default-src 'self'; script-src 'self';
      style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; connect-src
      'self' wss: https:; font-src 'self'; object-src 'none'; frame-src 'none';
      base-uri 'self'; form-action 'none'), `X-Content-Type-Options: nosniff`,
      `X-Frame-Options: DENY`,
      `Referrer-Policy: strict-origin-when-cross-origin`,
      `Permissions-Policy: camera=(), microphone=(), geolocation=()`,
      `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- [x] 9.2 Add cache control headers to `static/_headers` — hashed assets
      (`/_app/immutable/*`):
      `Cache-Control: public, max-age=31536000, immutable`; `index.html` (`/`):
      `Cache-Control: public, max-age=0, must-revalidate`
- [x] 9.3 Create `static/_redirects` file — SPA fallback: `/* /index.html 200`
- [x] 9.4 Configure Cloudflare Pages project — set build command
      `bun run build`, output directory `build/`, configure custom domain
      `bounty.ninja`, enable HTTPS, set up `www.bounty.ninja` → `bounty.ninja` redirect
- [x] 9.5 Create CI/CD pipeline (`.github/workflows/deploy.yml` or equivalent) —
      steps in order: `bun install`, `bun run check`, `bun run lint`,
      `bun run test:unit`, `bun run test:integration`, `bun run build`, bundle
      size check (fail if > 200KB gzipped), deploy to Cloudflare Pages; abort
      deployment on any failure
- [x] 9.6 Configure preview deployments — Cloudflare Pages preview deployment
      for each pull request against `main`

## 10. Final Verification

- [x] 10.1 Run full unit test suite — `bun run test:unit`; all tests pass
      including new Phase 5 tests
- [x] 10.2 Run full integration test suite — `bun run test:integration`; all
      tests pass
- [x] 10.3 Run E2E test suite — `bun run test:e2e` with local relay
      (`nak serve`), mock NIP-07, mock Cashu mint; all tests pass
- [x] 10.4 Run production build and verify bundle size — `bun run build`;
      confirm total gzipped JS < 200KB
- [x] 10.5 Run Lighthouse audit against deployed site — confirm Performance >
      90, Accessibility > 90, Best Practices > 90; confirm FCP < 1.5s, TTI < 3s,
      CLS < 0.1
- [x] 10.6 Verify CSP headers active — confirm `Content-Security-Policy` header
      present on all HTML responses; verify inline scripts blocked; verify relay
      WebSocket and mint HTTPS connections allowed
- [x] 10.7 Verify XSS protection end-to-end — manually test known XSS payloads
      in task description via the create form; confirm no script execution
- [x] 10.8 Verify offline mode end-to-end — disconnect network; confirm cached
      data displays, offline banner appears, write operations disabled;
      reconnect and confirm "Back online" toast
- [x] 10.9 Verify invalid event rejection end-to-end — publish event with
      tampered signature to test relay; confirm it does not appear in the UI
- [x] 10.10 Verify site accessible at `https://bounty.ninja` — confirm HTTPS
      enforced, `www` redirects, SPA routing works for deep links
      (`/task/naddr1...`, `/profile/npub1...`)
