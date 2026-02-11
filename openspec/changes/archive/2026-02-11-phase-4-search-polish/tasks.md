# Phase 4: Search, Discovery & Polish — Tasks

## 1. Search State Store

- [x] 1.1 Create `src/lib/stores/search.svelte.ts` — class-based Svelte 5 runes
      store with `$state` properties: `results` (`BountySummary[]`), `loading`
      (boolean), `error` (string | null), `query` (string)
- [x] 1.2 Implement NIP-50 search subscription — construct filter
      `{ kinds: [37300], search: "<query>", limit: 20 }` using
      `searchBountiesFilter()` from `src/lib/bounty/filters.ts`, issue REQ to
      `PUBLIC_SEARCH_RELAY` (default `wss://relay.nostr.band`)
- [x] 1.3 Implement subscription cancellation — cancel any in-flight search
      subscription when a new query is issued
- [x] 1.4 Implement client-side fallback — when search relay is unreachable or
      unresponsive within 5 seconds, fall back to case-insensitive substring
      matching against `title` and `tags` fields of events cached in the
      Applesauce `EventStore`; set `error` to a descriptive fallback-mode
      message
- [x] 1.5 Implement query reset — when query is cleared, reset `results` to
      empty array and clear `error`
- [x] 1.6 Add `searchBountiesFilter()` to `src/lib/bounty/filters.ts` if not
      already present — returns a Nostr `Filter` with `kinds: [37300]` and
      `search` field
- [x] 1.7 Write unit tests in `src/tests/unit/search-store.test.ts` — cover:
      successful NIP-50 search, fallback to client-side, empty results,
      subscription cancellation on new query

## 2. Search Components

- [x] 2.1 Create `src/lib/components/search/SearchBar.svelte` — text input with
      300ms debounce, two variants (`hero` and `compact` via prop),
      `role="search"`, `aria-label="Search bounties"`, visually hidden `<label>`
- [x] 2.2 Implement form submission — on Enter or submit button, navigate to
      `/search?q=<url-encoded-query>` via SvelteKit `goto()`
- [x] 2.3 Implement loading indicator — display spinner/indicator while search
      store `loading` is `true`
- [x] 2.4 Create `src/lib/components/search/SearchResults.svelte` — render
      matching bounties as `BountyCard` components, display total result count,
      show skeleton placeholders (minimum 3) during loading, show `EmptyState`
      with message "No bounties found for '<query>'" when results are empty
- [x] 2.5 Add filter controls to `SearchResults.svelte` — bounty status filter
      (open, completed, all) and minimum reward amount filter; filters apply
      client-side to the search store results

## 3. Search Route

- [x] 3.1 Create `src/routes/search/+page.ts` — read `q` query parameter from
      URL, initialize search store with that query on load
- [x] 3.2 Create `src/routes/search/+page.svelte` — render `SearchResults`
      component, set page title to "Search: <query> — Tasks.fyi" via
      `<svelte:head>`
- [x] 3.3 Verify direct URL access — navigating to `/search?q=cashu` executes
      search immediately on load without additional user interaction

## 4. User Profile Store

- [x] 4.1 Create `src/lib/stores/user-profile.svelte.ts` — class-based Svelte 5
      runes store with `$state` properties: `name`, `displayName`, `picture`,
      `nip05`, `about` (all string | null), `pubkey` (string | null)
- [x] 4.2 Implement Kind 0 subscription — subscribe to `EventStore` for Kind 0
      events matching the current user's pubkey; parse profile fields from most
      recent Kind 0 event JSON content
- [x] 4.3 Handle no-profile case — expose `null` for `name`, `displayName`,
      `picture`, `nip05` when no Kind 0 event exists; `pubkey` still set
- [x] 4.4 Implement reactive updates — store updates when a new Kind 0 event is
      received for the current user
- [x] 4.5 Write unit tests in `src/tests/unit/user-profile-store.test.ts` —
      cover: profile loaded from Kind 0, no profile found, profile update

## 5. Settings Page

- [x] 5.1 Create `src/routes/settings/+page.svelte` — settings page with three
      sections: Relay Management, Cashu Mint Selection, Theme Toggle; set page
      title to "Settings — Tasks.fyi" via `<svelte:head>`
- [x] 5.2 Implement auth gate — if user is unauthenticated, display message
      "Sign in with a Nostr extension to manage your settings" with
      `LoginButton` component; show settings sections only when authenticated
- [x] 5.3 Implement localStorage persistence — read/write all settings as JSON
      under key `tasks.fyi:settings`; handle `QuotaExceededError` gracefully
      with toast "Settings could not be saved — storage full" and retain
      in-memory settings

## 6. Relay Management

- [x] 6.1 Build relay list UI in settings page — display current relay list,
      input field to add new relay, remove button per relay
- [x] 6.2 Implement relay URL validation — reject URLs not starting with
      `wss://` or `ws://` with error "Relay URL must start with wss:// or
      ws://"; reject duplicates with error "This relay is already in your list"
- [x] 6.3 Implement add relay — add to list, connect `RelayPool` to new relay,
      persist to `localStorage` immediately
- [x] 6.4 Implement remove relay — remove from list, disconnect `RelayPool` from
      relay, persist to `localStorage`; show confirmation dialog when removing
      last relay: "Removing all relays will prevent the app from loading data.
      Continue?"
- [x] 6.5 Initialize relay list from `localStorage` on app load — use persisted
      list if present, otherwise fall back to `PUBLIC_DEFAULT_RELAYS`

## 7. Cashu Mint Selection

- [x] 7.1 Build mint selector UI in settings page — display current mint URL
      (default `PUBLIC_DEFAULT_MINT`), input for custom mint URL, "Reset to
      default" button
- [x] 7.2 Implement mint change — update `localStorage`, show toast "Preferred
      mint updated", use new mint for subsequent pledge and solution fee
      operations
- [x] 7.3 Implement reset to default — revert to `PUBLIC_DEFAULT_MINT`, persist
      change

## 8. Theme Toggle

- [x] 8.1 Build theme toggle UI in settings page — switch between "Dark" (Tokyo
      Night Storm) and "Light" (Tokyo Night Day)
- [x] 8.2 Implement theme switching — add/remove `.light` class on `<html>`
      element; persist to `localStorage` under key `tasks.fyi:theme`
- [x] 8.3 Add synchronous theme initialization in `src/app.html` — inline
      `<script>` block that reads `tasks.fyi:theme` from `localStorage` before
      framework JS executes; fall back to `prefers-color-scheme` media query if
      no stored preference
- [x] 8.4 Implement `<meta name="theme-color">` dynamic update — set to
      `#1a1b26` for dark, `#d5d6db` for light; update when theme toggles

## 9. Responsive Layout — Sidebar

- [x] 9.1 Create `src/lib/components/layout/Sidebar.svelte` — rendered only at
      `lg:` breakpoint (1024px+), fixed width 256px on left side of two-column
      layout
- [x] 9.2 Implement category/tag list — derive tags from `t` tags of bounty
      events in `EventStore`, display tag name and bounty count per tag
- [x] 9.3 Implement "Popular Tags" section — show top 10 most-used tags sorted
      by frequency
- [x] 9.4 Implement category selection — clicking a tag filters home page bounty
      list to matching `t` tag; visually highlight selected category
- [x] 9.5 Implement "All" option — clears filter, shows all bounties

## 10. Responsive Layout — MobileNav

- [x] 10.1 Create `src/lib/components/layout/MobileNav.svelte` — fixed to bottom
      of viewport, solid background with top border, hidden at `sm:` breakpoint
      (640px+)
- [x] 10.2 Add navigation items — Home (`/`), Search (`/search`), Create
      (`/bounty/new`), Settings (`/settings`); each with icon and label
- [x] 10.3 Implement active route highlighting — use `--primary` color token for
      active item
- [x] 10.4 Enforce 44x44px minimum touch targets per WCAG 2.1 AA
- [x] 10.5 Implement auth check on Create — prompt unauthenticated users to log
      in via NIP-07 before navigating to `/bounty/new`

## 11. Responsive Layout — Root Layout & Header Updates

- [x] 11.1 Update `src/routes/+layout.svelte` — integrate `Sidebar` (desktop)
      and `MobileNav` (mobile) into root layout; add bottom padding to main
      content area (minimum 64px) on mobile to prevent MobileNav from obscuring
      content
- [x] 11.2 Update `src/lib/components/layout/Header.svelte` — mobile (< 640px):
      logo left, search icon button right, login/profile right; tablet/desktop
      (640px+): logo left, compact `SearchBar` center, login/profile right
- [x] 11.3 Implement mobile search overlay — tapping search icon expands
      full-width search input over Header; dismiss via close button or Escape
      key; Enter navigates to `/search?q=<query>`
- [x] 11.4 Update `src/lib/components/bounty/BountyCard.svelte` — mobile:
      stacked vertical layout (title, status, tags, reward, time ago); desktop
      (640px+): horizontal layout with additional metadata (solution count,
      pledge count)

## 12. Home Page Updates

- [x] 12.1 Update `src/routes/+page.svelte` — add hero-variant `SearchBar`
      prominently above bounty list with placeholder "Search bounties..."
- [x] 12.2 Add category filter tabs — "All" tab (default) plus tabs for common
      tags (development, design, documentation, writing); selecting a tab
      filters bounty list by matching `t` tag client-side against `EventStore`
- [x] 12.3 Ensure hero search navigates to `/search?q=<query>` on Enter/submit

## 13. Branding Assets

- [x] 13.1 Create `static/favicon.svg` — recognizable at 16x16 and 32x32 pixels;
      must not be the default SvelteKit favicon
- [x] 13.2 Create `static/logo.svg` — text-based SVG placeholder ("Tasks.fyi" in
      styled font), optimized under 10KB, legible at 24px and 48px heights, uses
      `currentColor` for theme compatibility
- [x] 13.3 Create `static/og-image.svg` — 1200x630 viewport, Tasks.fyi brand
      name and tagline on Tokyo Night background
- [x] 13.4 Update `src/lib/components/layout/Header.svelte` — use `logo.svg` as
      site logo linking to `/`

## 14. Meta Tags & app.html

- [x] 14.1 Update `src/app.html` — set `<title>` to "Tasks.fyi — Decentralized
      Bounty Board"
- [x] 14.2 Add Open Graph meta tags to `src/app.html` `<head>` — `og:title`,
      `og:description` ("Post bounties, fund with bitcoin ecash, and pay solvers
      — all on Nostr. No middlemen, no accounts, no censorship."), `og:image`
      (`https://tasks.fyi/og-image.svg`), `og:url`, `og:type` (website),
      `og:site_name`
- [x] 14.3 Add Twitter Card meta tags — `twitter:card` (summary_large_image),
      `twitter:title`, `twitter:description`, `twitter:image`
- [x] 14.4 Add `<meta name="description">` with same description text
- [x] 14.5 Add `<link rel="icon" href="/favicon.svg">` to `<head>`
- [x] 14.6 Ensure `<meta charset="utf-8">` and
      `<meta name="viewport" content="width=device-width, initial-scale=1">` are
      present; viewport MUST NOT include `user-scalable=no` or `maximum-scale=1`
- [x] 14.7 Add `<meta name="theme-color" content="#1a1b26">` (updated
      dynamically by theme toggle per task 8.4)

## 15. Playwright Configuration & Test Infrastructure

- [x] 15.1 Create `playwright.config.ts` — base URL `http://localhost:4173`,
      `webServer` block running `bun run build && bun run preview`, 30s global
      timeout, screenshot on failure, Chromium primary browser, `retries: 1`
      when `process.env.CI`
- [x] 15.2 Implement local relay setup — `nak serve` at `ws://localhost:10547`,
      started before test suite, stopped after all tests; configure app under
      test to connect to local relay via env var override
- [x] 15.3 Implement test fixture seeding — seed local relay with sample
      bounties, pledges, solutions via `nak event` CLI or direct WebSocket
      publishing before tests run
- [x] 15.4 Create mock NIP-07 signer helper — injectable via
      `page.addInitScript()`, implements `window.nostr` with `getPublicKey()`
      (deterministic test pubkey), `signEvent()` (signs with deterministic test
      private key via `nostr-tools`), stub `nip04.encrypt()`/`nip04.decrypt()`
- [x] 15.5 Create mock Cashu mint — either lightweight HTTP server in
      `globalSetup` or `page.route()` interception returning valid test-only
      token responses for mint info, mint tokens, swap tokens, verify tokens;
      use test-only keyset IDs
- [x] 15.6 Add `test:e2e` script to `package.json` — runs `bunx playwright test`

## 16. E2E Tests

- [x] 16.1 Create `src/tests/e2e/bounty-lifecycle.spec.ts` — full lifecycle:
      navigate to `/bounty/new`, fill form (title, description, reward, tags,
      fee), submit, verify bounty on home page, navigate to detail, fund with
      mock Cashu pledge, verify status → open, submit solution with anti-spam
      fee, verify status → in_review, cast approval vote, verify tally updates,
      trigger payout, verify status → completed
- [x] 16.2 Add bounty form validation test in `bounty-lifecycle.spec.ts` —
      submit with empty title, verify validation error, verify no event
      published
- [x] 16.3 Create `src/tests/e2e/search.spec.ts` — seed relay with multiple
      bounties with distinct titles/tags, verify bounties on home page, type
      query in hero SearchBar, press Enter, verify navigation to
      `/search?q=<query>`, verify matching results displayed, apply status
      filter and verify update, click category tab on home page and verify
      filtering, search for nonexistent term and verify empty state
- [x] 16.4 Create `src/tests/e2e/auth.spec.ts` — load home page without mock
      signer, verify Login button visible, verify write actions disabled/prompt
      login, inject mock NIP-07 signer, click Login, verify profile info in
      Header, verify write actions available, navigate to `/settings` and verify
      settings load, log out and verify UI returns to unauthenticated state
- [x] 16.5 Add unauthenticated restriction test in `auth.spec.ts` — navigate to
      `/bounty/new` without auth, verify login prompt displayed instead of form
- [x] 16.6 Add accessibility assertions to all E2E tests — verify `<main>`
      landmark on every page, all images have `alt`, all form inputs have
      labels, focus management after navigation, skip-to-content link present
      and functional

## 17. Final Verification

- [x] 17.1 Run `bun run check` — verify zero TypeScript errors across all new
      and modified files
- [x] 17.2 Run `bun run lint && bun run format` — verify no lint errors, all
      files formatted
- [x] 17.3 Run `bun run build` — verify production build succeeds with no
      console errors
- [x] 17.4 Run `bun run test:e2e` — verify all Playwright E2E tests pass
- [x] 17.5 Run Lighthouse audit against built app — verify Performance > 90,
      Accessibility > 90, Best Practices > 90 (manual or via `@lhci/cli` if
      integrated)
- [x] 17.6 Manual smoke test — verify search on home page and header, category
      tabs, settings page persistence, theme toggle without flash, mobile bottom
      nav, OG meta tags render correct preview (use social media debugger tool)
