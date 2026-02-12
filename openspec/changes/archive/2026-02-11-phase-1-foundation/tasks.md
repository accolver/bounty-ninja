# Phase 1: Foundation — Tasks

## 1. Project Initialization

- [x] 1.1 Create SvelteKit 2 skeleton project with `bun create svelte@latest`
      (TypeScript, ESLint, Prettier, Vitest, Playwright options selected)
- [x] 1.2 Install Applesauce ecosystem production dependencies:
      `bun add applesauce-core applesauce-relay applesauce-loaders applesauce-common applesauce-signers applesauce-accounts applesauce-actions applesauce-wallet nostr-idb`
- [x] 1.3 Install remaining production dependencies:
      `bun add @cashu/cashu-ts rxjs nostr-tools`
- [x] 1.4 Install dev dependencies:
      `bun add -D tailwindcss @tailwindcss/vite @sveltejs/adapter-static @playwright/test`
- [x] 1.5 Verify `bun.lockb` exists and no `package-lock.json`, `yarn.lock`, or
      `pnpm-lock.yaml` are present
- [x] 1.6 Create project directory structure under `src/lib/` — create empty
      directories: `nostr/`, `nostr/loaders/`, `task/`, `cashu/`, `stores/`,
      `components/layout/`, `components/task/`, `components/pledge/`,
      `components/solution/`, `components/voting/`, `components/auth/`,
      `components/search/`, `components/shared/`, `utils/`
- [x] 1.7 Create `src/tests/unit/`, `src/tests/integration/`, `src/tests/e2e/`
      test directories

## 2. Environment & Tooling Configuration

- [x] 2.1 Create `.env` at project root with all `PUBLIC_*` variables:
      `PUBLIC_DEFAULT_RELAYS`, `PUBLIC_DEFAULT_MINT`, `PUBLIC_APP_NAME`,
      `PUBLIC_APP_URL`, `PUBLIC_MIN_SUBMISSION_FEE`,
      `PUBLIC_MAX_SUBMISSION_FEE`, `PUBLIC_SEARCH_RELAY` (values from PRD
      Section 4.4)
- [x] 2.2 Create `.env.example` with identical content to `.env` (committed to
      git)
- [x] 2.3 Verify `.gitignore` includes `.env` but NOT `.env.example`
- [x] 2.4 Create `mise.toml` at project root with `[tools]` (node 22, bun
      latest, nak via Go install), `[env]` mirroring `.env` plus `LOCAL_RELAY`,
      and all `[tasks]` entries: `dev`, `build`, `preview`, `test`, `test:unit`,
      `test:integration`, `test:e2e`, `relay`, `relay:negentropy`, `seed`,
      `lint`, `format`, `check`, `clean` (content from PRD Section 4.7)

## 3. SvelteKit & Vite Configuration

- [x] 3.1 Configure `svelte.config.js` — import `@sveltejs/adapter-static`, set
      `fallback: "index.html"`, `precompress: true`, `strict: true`, use
      `vitePreprocess()`, define `$lib` alias to `./src/lib`
- [x] 3.2 Configure `vite.config.ts` — add `tailwindcss()` from
      `@tailwindcss/vite` and `sveltekit()` plugins, set `optimizeDeps.exclude`
      for `@noble/curves` and `@noble/hashes`
- [x] 3.3 Verify `tsconfig.json` extends SvelteKit's default TypeScript
      configuration with strict mode enabled

## 4. Type Declarations

- [x] 4.1 Create `src/app.d.ts` — declare `window.nostr` NIP-07 interface with
      `getPublicKey(): Promise<string>` and
      `signEvent(event: object): Promise<object>` methods, plus SvelteKit `App`
      namespace declarations

## 5. CSS & Theming Setup

- [x] 5.1 Create `src/app.css` — add `@import "tailwindcss"`, define Tokyo Night
      Storm dark theme tokens in `@theme` block (all 16 semantic color tokens:
      `--color-primary` through `--color-accent` per PRD Section 12.1)
- [x] 5.2 Add `.light` class override in `src/app.css` with all 16 Tokyo Night
      Day color token values
- [x] 5.3 Add `prefers-reduced-motion` media query in `src/app.css` to disable
      transitions/animations when user prefers reduced motion
- [x] 5.4 Add focus ring styles in `src/app.css` using `--color-ring` token for
      keyboard-focused interactive elements
- [x] 5.5 Create `src/app.html` — set `lang="en"` on `<html>`, include
      `charset`, `viewport`, and `color-scheme` meta tags, apply
      `bg-background text-foreground` classes to `<body>`, include
      `%sveltekit.head%` and `%sveltekit.body%` placeholders

## 6. shadcn-svelte Initialization

- [x] 6.1 Run `bunx shadcn-svelte@next init` (Style: Default, Base color:
      Neutral, CSS variables: Yes)
- [x] 6.2 Install shadcn-svelte base components: Button, Card, Badge, Input,
      Dialog — verify files exist under `src/lib/components/ui/`
- [x] 6.3 Verify shadcn-svelte components consume Tokyo Night semantic tokens
      (e.g., `<Button>` uses `--color-primary` background)

## 7. Utility Modules

- [x] 7.1 Create `src/lib/utils/constants.ts` — export `CLIENT_TAG` with value
      `"tasks.fyi"` and other app-wide constants
- [x] 7.2 Create `src/lib/utils/env.ts` — export typed accessor functions for
      all `PUBLIC_*` environment variables with sensible fallback defaults
      (relay list, mint URL, app name, fee range, search relay)
- [x] 7.3 Create `src/lib/utils/format.ts` — implement `formatSats()`
      (locale-aware number formatting), `formatDate()` (human-readable date),
      and `formatNpub()` (truncated npub display, e.g., `npub1abc...xyz`)
- [x] 7.4 Create `src/lib/task/kinds.ts` — export `TASK_KIND` (37300),
      `SOLUTION_KIND` (73001), `PLEDGE_KIND` (73002), `VOTE_KIND` (1018),
      `PAYOUT_KIND` (73004)

## 8. Utility Module Tests

- [x] 8.1 Create `src/tests/unit/constants.test.ts` — verify
      `CLIENT_TAG === "tasks.fyi"`
- [x] 8.2 Create `src/tests/unit/env.test.ts` — verify typed env accessors
      return defaults when variables are undefined
- [x] 8.3 Create `src/tests/unit/format.test.ts` — test `formatSats()` with
      various amounts, `formatDate()` with timestamps, `formatNpub()` truncation
- [x] 8.4 Create `src/tests/unit/kinds.test.ts` — verify all five kind constants
      match PRD values

## 9. Nostr Infrastructure — EventStore

- [x] 9.1 Create `src/lib/nostr/event-store.ts` — instantiate and export
      singleton `EventStore` from `applesauce-core` as named export `eventStore`
- [x] 9.2 Write unit test verifying `eventStore` is a singleton (same reference
      from multiple imports) and accepts `NostrEvent` objects

## 10. Nostr Infrastructure — RelayPool

- [x] 10.1 Create `src/lib/nostr/relay-pool.ts` — instantiate and export
      singleton `RelayPool` from `applesauce-relay` as named export `pool`,
      export `connectDefaultRelays()` function that reads
      `PUBLIC_DEFAULT_RELAYS` from env, splits by comma, filters empty strings,
      and calls `pool.relay(url)` for each
- [x] 10.2 Write unit test verifying `pool` is a singleton and
      `connectDefaultRelays()` parses relay URLs correctly (mock the env
      variable)

## 11. Nostr Infrastructure — IndexedDB Cache

- [x] 11.1 Create `src/lib/nostr/cache.ts` — set up `nostr-idb` IndexedDB cache,
      export initialization function that wires cache to `eventStore` (events
      added to store are persisted, cached events loaded on startup)
- [x] 11.2 Write integration test verifying cache initialization creates an
      IndexedDB database and handles empty state without errors

## 12. Authentication — Signer Detection

- [x] 12.1 Create `src/lib/nostr/signer.svelte.ts` — implement class-based
      reactive store using Svelte 5 runes (`$state`) that detects `window.nostr`
      NIP-07 extension availability, with retry/polling for late-loading
      extensions
- [x] 12.2 Write unit test for signer detection: mock `window.nostr` present,
      absent, and late-loading scenarios

## 13. Authentication — Account State

- [x] 13.1 Create `src/lib/nostr/account.svelte.ts` — implement class-based
      reactive store with `$state` for hex pubkey and `$derived` for npub
      (NIP-19 encoded), `login()` method calling `window.nostr.getPublicKey()`,
      `logout()` method clearing state and `localStorage`, session persistence
      via `localStorage`
- [x] 13.2 Write unit test for account state: verify login sets pubkey, derived
      npub updates, logout clears state, session restores from `localStorage`

## 14. Authentication — Login Error Handling

- [x] 14.1 Add error handling to `src/lib/nostr/account.svelte.ts` login flow —
      handle user rejection, extension timeout (30s), no extension available,
      and malformed responses
- [x] 14.2 Write unit tests for login error scenarios: user rejects NIP-07
      prompt, extension times out, no extension detected

## 15. Authentication — LoginButton Component

- [x] 15.1 Create `src/lib/components/auth/LoginButton.svelte` — render button
      that triggers NIP-07 login, display "Login" when logged out, include
      `aria-label`, keyboard accessible (focusable via Tab, activatable via
      Enter/Space)
- [x] 15.2 When no NIP-07 extension is detected on login click, display install
      prompt with links to nos2x and Alby

## 16. Layout Components

- [x] 16.1 Create `src/lib/components/layout/Header.svelte` — render `<header>`
      with `<nav>`, Tasks.fyi logo/wordmark linking to `/`, `LoginButton` when
      logged out, truncated npub when logged in, responsive design, keyboard
      navigable
- [x] 16.2 Create `src/lib/components/shared/RelayStatus.svelte` — display
      connection status for each relay in the pool, green (`--color-success`)
      for connected, red (`--color-destructive`) for disconnected, reactive
      updates, `aria-label` per relay (e.g., "relay.damus.io: connected")
- [x] 16.3 Create `src/lib/components/layout/Footer.svelte` — render `<footer>`
      containing `RelayStatus` component, semantic HTML

## 17. Root Layout & Routes

- [x] 17.1 Create `src/routes/+layout.ts` — export `ssr = false` and
      `prerender = false`, call `connectDefaultRelays()` and initialize
      IndexedDB cache on app load
- [x] 17.2 Create `src/routes/+layout.svelte` — import and render `Header`,
      `<main>` with `{@render children()}` (NOT `<slot />`), and `Footer`, apply
      responsive container with max-width and padding, import `src/app.css`
- [x] 17.3 Verify layout is responsive: single-column on mobile (< 640px) with ≥
      16px padding, centered max-width on desktop (≥ 1024px), no horizontal
      overflow at any viewport width

## 18. Home Page — Proof of Concept

- [x] 18.1 Create `src/routes/+page.svelte` — subscribe to recent events from
      connected relays (e.g., Kind 1 text notes, limited), display list showing
      truncated event `id`, `kind`, formatted `created_at`, and truncated
      `content`
- [x] 18.2 Implement empty state on home page: display message like "No events
      found. Connecting to relays..." when no events match the subscription
- [x] 18.3 Expose `eventStore` on `window` for console debugging (development
      only)

## 19. Build Verification

- [x] 19.1 Verify `bun run dev` starts the dev server at `localhost:5173`
      without TypeScript or build errors
- [x] 19.2 Verify `bun run build` produces a `build/` directory with static
      assets and `index.html` fallback, no server-side routes in output
- [x] 19.3 Verify `bun run check` (svelte-check) reports zero TypeScript errors
- [x] 19.4 Verify `bun run test:unit` runs all unit tests and they pass

## 20. End-to-End Acceptance Verification

- [x] 20.1 Verify app connects to at least 2 default relays with green
      indicators visible in `RelayStatus`
- [x] 20.2 Verify clicking "Login" triggers NIP-07 `window.nostr.getPublicKey()`
      and displays the user's npub in the Header
- [x] 20.3 Verify events from relays flow into `eventStore` (inspectable via
      browser console)
- [x] 20.4 Verify IndexedDB cache is created and events persist across page
      reloads
- [x] 20.5 Verify Tokyo Night dark theme is applied globally (background
      `#1a1b26`, text `#a9b1d6`)
- [x] 20.6 Verify Tab navigation follows logical order: Header elements → page
      content → Footer elements, with visible focus rings on all interactive
      elements
