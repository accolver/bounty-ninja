## Why

With core bounty operations complete (Phase 3), the app needs discovery features
and UI polish to be production-ready. Phase 4 (PRD Section 18) adds NIP-50
full-text search, category filtering, user settings management, responsive
mobile layout, and branding assets. This phase transforms the app from
functional to usable.

## What Changes

- Implement NIP-50 search with dedicated search relay (`PUBLIC_SEARCH_RELAY`),
  fallback to client-side filtering of cached events
- Build SearchBar component with debounced input and search results page at
  `/search`
- Build SearchResults component displaying matching bounties with status/reward
  filters
- Build search state store bridging NIP-50 relay responses to Svelte 5 runes
- Build Settings page at `/settings` with relay list management (add/remove,
  persisted to localStorage), preferred Cashu mint selection, and theme toggle
  (dark/light Tokyo Night)
- Build Sidebar component for category/tag filtering on desktop
- Build MobileNav component for bottom navigation on mobile screens
- Build user-profile store for current user's profile state
- Update home page with hero search bar variant and category filter tabs
- Update Header with integrated search bar and responsive design
- Add Open Graph meta tags to `app.html` for social sharing previews
- Create branding assets: favicon.ico, logo.svg, og-image.png placeholders
- Write E2E tests with Playwright: full bounty lifecycle, search flow, NIP-07
  auth
- Configure Playwright with local relay (`nak serve`) and mock NIP-07

## Capabilities

### New Capabilities

- `search-discovery`: NIP-50 search state store, SearchBar with debounce,
  SearchResults page, client-side fallback filtering, search route at `/search`
  (PRD Section 10.3)
- `user-settings`: Settings page at `/settings` with relay list CRUD
  (localStorage persistence), Cashu mint selector, theme toggle between Tokyo
  Night dark/light (PRD Phase 4 deliverable 5)
- `responsive-layout`: Sidebar category filter for desktop, MobileNav bottom
  navigation for mobile, responsive Header with search (PRD Section 9)
- `branding-meta`: Open Graph meta tags, favicon, logo SVG placeholder, og-image
  placeholder for social sharing previews (PRD Phase 4 deliverables 11-12)
- `e2e-testing`: Playwright test suite with local relay, mock NIP-07 signer,
  full lifecycle/search/auth tests (PRD Section 17.3)

### Modified Capabilities

- `app-layout`: Header gains search bar, Sidebar added for desktop, MobileNav
  added for mobile
- `bounty-routes`: Home page gains hero search bar and category tabs
- `reactive-stores`: New user-profile store added

## Impact

- **New files**: ~15 files across `src/lib/stores/search.svelte.ts`,
  `src/lib/stores/user-profile.svelte.ts`, `src/lib/components/search/`,
  `src/lib/components/layout/Sidebar.svelte`,
  `src/lib/components/layout/MobileNav.svelte`, `src/routes/search/`,
  `src/routes/settings/`, `src/tests/e2e/`, `playwright.config.ts`, `static/`
- **Modified files**: Home page, Header, root layout, `app.html`
- **Acceptance criteria** (from PRD Phase 4): NIP-50 search works on search
  relay, search results page displays matches, category tabs filter by tag,
  settings page persists relay/mint/theme to localStorage, mobile-responsive
  with bottom nav, OG meta tags render correct previews, all E2E tests pass,
  Lighthouse scores > 90
