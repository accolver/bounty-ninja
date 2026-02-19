# AGENTS.md — Bounty.ninja

> AI coding agents: read this file first. It's your context for working on this
> project. Read `PRD.md` for the full product spec — it is the source of truth
> for architecture, data models, event kinds, and implementation decisions.

## What This Is

**Bounty.ninja** is a decentralized, censorship-resistant bounty board / labor
marketplace. Users post bounties as Nostr events, fund them with P2PK-locked
Cashu ecash, submit solutions, vote on winners, and receive automatic payouts.
Zero backend — entirely client-side.

**Domain:** https://bounty.ninja — deployed on Cloudflare Pages.

---

## Tech Stack — Non-Negotiable

| Layer            | Technology                                          | Notes                                                                                 |
| ---------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Language         | **TypeScript**                                      | Strict mode. No `any` unless truly unavoidable (and document why).                    |
| Framework        | **SvelteKit 2**                                     | Static adapter, SPA mode (`ssr: false`, `prerender: false`)                           |
| Reactivity       | **Svelte 5 Runes**                                  | `$state`, `$derived`, `$effect` — NO legacy `$:`, NO `writable()`/`readable()` stores |
| Runtime          | **Bun**                                             | Package manager AND runtime. Use `bun add`, `bun run`, etc. Never npm/yarn/pnpm.      |
| UI Components    | **shadcn-svelte** (next)                            | Accessible, composable primitives                                                     |
| Styling          | **Tailwind CSS 4**                                  | Via `@tailwindcss/vite` plugin. Tokyo Night theme tokens in `app.css`.                |
| Icons            | **@lucide/svelte**                                  | Tree-shakeable SVG icons                                                              |
| Nostr            | **Applesauce v5** ecosystem                         | `applesauce-core`, `-relay`, `-loaders`, `-signers`, `-accounts`, `-actions`          |
| Nostr Cache      | **nostr-idb**                                       | IndexedDB-backed event cache                                                          |
| Nostr Types      | **nostr-tools**                                     | Use `NostrEvent`, `Filter` types from here — NOT from NDK                             |
| Cashu            | **@cashu/cashu-ts** v3                              | P2PK locking via NUT-11 for trustless escrow                                          |
| Reactive Streams | **RxJS**                                            | Bridged to Svelte 5 Runes in class-based stores                                       |
| Testing          | **Vitest** (unit/integration), **Playwright** (E2E) | 578+ unit/integration, 16 E2E tests                                                   |
| Build            | **Vite 7**                                          | Ships with SvelteKit                                                                  |
| Tool Management  | **mise**                                            | Manages Bun, Node versions + task runner                                              |
| Deploy           | **Cloudflare Pages**                                | `mise run deploy` (build + wrangler pages deploy)                                     |
| Config           | **`src/lib/config.ts`**                             | Single source of truth for branding, relays, storage keys, external links             |

---

## Critical Rules

### Privacy & Security

- **Respect user privacy at all costs.** No PII collection. Users are
  pseudonymous (Nostr pubkeys only).
- **Never handle private keys.** Authentication is NIP-07 only (browser
  extension signing). The app must never ask for, store, or transmit a private
  key.
- All Nostr events are public. Never create an expectation of private data.
- Cashu tokens are bearer instruments — warn users about token security.
- Sanitize all rendered Markdown (DOMPurify) to prevent XSS.
- Validate event signatures and Cashu token structure.

### No Backend

- This is a **static SPA**. No server routes, no API endpoints, no server-side
  logic.
- All data comes from Nostr relay WebSocket subscriptions.
- All state is derived client-side from events in the Applesauce `EventStore` +
  IndexedDB cache.
- `adapter-static` with `fallback: "index.html"`.

### Svelte 5 — Runes Only

- **Always use Svelte 5 runes.** `$state`, `$derived`, `$effect`, `$props`,
  `$bindable`.
- **Never use legacy Svelte 3/4 patterns:** no `$:` reactive declarations, no
  `writable()`/`readable()`/`derived()` stores, no `$$props`, no `$$restProps`,
  no `createEventDispatcher()`.
- Reactive `.svelte.ts` files use class-based stores with `$state`/`$derived`
  runes.
- Use `$effect` for side effects, not `onMount` with reactive dependencies.
- Use `{@render children()}` instead of `<slot />`.
- Use `$props()` for component props, destructure with defaults.
- Use `onMount` for one-time initialization only.

### Bun — Always

- Use `bun` for all package operations: `bun add`, `bun remove`, `bun run`,
  `bun test`.
- Never use `npm`, `yarn`, or `pnpm`. Lock file is `bun.lockb`.

---

## Project Structure

```
src/
├── lib/
│   ├── bounty/          # Bounty domain logic (kinds, types, state machine, filters, voting)
│   ├── cashu/           # Cashu ecash (escrow, P2PK, token validation, mint interaction)
│   ├── components/      # UI components (auth/, bounty/, layout/, search/, shared/, voting/)
│   ├── nostr/           # Nostr layer (relay pool, event store, cache, loaders, signers)
│   ├── stores/          # Svelte stores (bounty list, search dialog state)
│   ├── utils/           # Shared utilities (env, formatting, error handling)
│   └── config.ts        # App-wide config (branding, relays, payments, storage, links)
├── routes/
│   ├── +page.svelte     # Home — bounty feed with filters
│   ├── bounty/[naddr]/  # Bounty detail (pledge, solve, vote, payout)
│   ├── bounty/new/      # Create bounty form
│   ├── profile/[npub]/  # User profile + their bounties
│   ├── search/          # Search results
│   ├── settings/        # User settings (relays, mint, cache)
│   └── about/           # About page
└── tests/               # Unit, integration, and E2E tests
```

### File Conventions

- **TypeScript files:** kebab-case (`relay-pool.ts`, `state-machine.ts`)
- **Svelte components:** PascalCase (`BountyCard.svelte`, `PledgeForm.svelte`)
- **Reactive modules:** `.svelte.ts` extension for files using runes
  (`signer.svelte.ts`, `bounties.svelte.ts`)
- **Path alias:** `$lib` → `./src/lib`
- **Component organization:** Domain-based directories under
  `src/lib/components/`

---

## Nostr Event Kinds

| Kind  | Type                      | Purpose                         |
| ----- | ------------------------- | ------------------------------- |
| 37300 | Parameterized Replaceable | Bounty definition               |
| 73001 | Regular                   | Pledge (Cashu ecash attachment) |
| 73002 | Regular                   | Solution submission             |
| 1018  | Regular                   | Consensus vote                  |
| 73004 | Regular                   | Payout record                   |
| 73005 | Regular                   | Retraction (cancel/withdraw)    |
| 73006 | Regular                   | Reputation attestation          |

### Bounty Lifecycle

`draft` → `open` → `in_review` → `completed` (side transitions: `expired`,
`cancelled`)

All published events must include the tag `["client", "bounty.ninja"]`.

---

## Architecture Decisions

- **Applesauce `EventStore`** is the single source of truth for Nostr events
  (in-memory).
- **nostr-idb** persists events to IndexedDB for offline/reload resilience.
- **Applesauce RelayPool is a singleton.** Defined in `relay-pool.ts`, shared
  across the app. RxJS internals mean you cannot safely unsubscribe/resubscribe
  — use page reload for relay changes.
- **SWR caching.** `CachedQuery` class: L1 EventStore → L2 IndexedDB → L3 relay.
  Profile cache is LRU (500 max, 15min fresh / 24h stale).
- **`config.ts` is the single source of truth** for app name, storage prefix,
  default relays, mint URL, external links. Don't hardcode these elsewhere.
- **Optimistic local updates** on event publish — insert into EventStore
  immediately before relay confirmation.
- **`min-h-dvh` not `min-h-screen`** — `100dvh` accounts for mobile browser
  chrome.
- **Never use `overflow-hidden` on the header** — it clips absolutely-positioned
  dropdown menus.
- **CSP uses `unsafe-inline`** for script-src because SvelteKit emits inline
  bootstrap scripts with build-specific hashes that aren't viable for static
  sites.
- **Exclude `@noble/curves` and `@noble/hashes`** from Vite `optimizeDeps` (WASM
  compatibility).

---

## Coding Conventions

### Styling

- **Semantic colors only.** Never use raw Tailwind color classes
  (`text-red-500`, `bg-green-400`, `text-amber-600`, `bg-white`, `text-white`,
  `bg-black`). Always use semantic theme tokens defined in `app.css`
  (`text-destructive`, `bg-success/15`, `text-warning`, `bg-input`,
  `bg-background`, `text-destructive-foreground`, `bg-overlay`, etc.). This
  ensures proper contrast in both light and dark modes.
- **Available semantic tokens:** `primary`, `secondary`, `destructive`,
  `success`, `warning`, `accent`, `background`, `foreground`, `card`, `muted`,
  `border`, `input`, `ring`, `popover`, `overlay`. Each has appropriate
  light/dark values. Most have `-foreground` variants for contrast text (e.g.
  `text-primary-foreground` on `bg-primary`).
- **Every interactive element** (`<button>`, clickable `<div>`, `<a>`) must have
  `hover:cursor-pointer`.
- **Every element with a `hover:` class** must also have a `transition` class
  (e.g. `transition-colors`, `transition-all`).
- Mobile-first responsive design. Test at 375px width minimum.
- **Dark mode default** (Mandalorian). Light mode via `.light` class
  (Mandalorian Day).
- Target **WCAG 2.1 AA**: 4.5:1 contrast ratio, keyboard navigation, screen
  reader support, `prefers-reduced-motion`.

### Design System — "Flat Sections" Minimalism

The UI follows a **flat, card-free layout** with restrained color usage. The
guiding principle: **color = action the user needs to take.** Informational
content stays neutral.

#### Layout Rules

- **No cards on cards.** Never nest a bordered container inside another bordered
  container. Sections are separated by thin `border-border` horizontal rules and
  whitespace — not by wrapping in `bg-card rounded-lg border` boxes.
- **Flat sections over card wrappers.** Content sections (description, pledges,
  solutions, stats) use `border-t border-border` dividers and `space-y` spacing
  instead of card containers. The only acceptable card-like wrappers are
  dropdowns/popovers, dialogs, and the header/footer chrome.
- **Stats use inline layout.** Stat rows (asking, funded, solutions) display as
  `flex gap` with just label + value — no individual bordered stat cells.

#### Color Restraint Rules

- **Filled `bg-primary` / `bg-success`** is reserved exclusively for **action
  elements the user must interact with**: CTA buttons (e.g. "Release Funds"),
  action banners (e.g. "Action Required: Release Your Funds"), and primary
  submit buttons. Never use filled primary on passive/informational elements.
- **Badges use outline style**, not filled. Status badges:
  `border border-{color} text-{color} bg-transparent`. Tag badges:
  `border border-muted-foreground text-muted-foreground bg-transparent`.
  Verification badges: `border border-warning text-warning bg-transparent`.
- **Links use `text-foreground`** at rest, with `hover:text-primary` on hover.
  Never `text-primary` at rest for regular navigation links. Exception:
  deliberate "learn more" or external resource links in prose content may use
  `text-primary`.
- **Monetary values and stat numbers** use `text-foreground` (neutral), not
  `text-primary` or `text-accent`. The `SatAmount` component uses
  `text-foreground` for values.
- **Vote approve/reject text** uses dimmed semantic colors (`text-success/70`
  and `text-destructive/70`) instead of full-saturation `text-success` /
  `text-destructive`. The progress bar fill uses `bg-success/70` for approve and
  `bg-destructive/70` for reject.
- **Consensus / confirmation messages** may use `text-primary` since they
  indicate a successful state transition the user cares about.
- **"No longer accepting" / closed states** use `text-destructive/70` to
  indicate unavailability without screaming.
- **Cancel / destructive buttons** use outline style:
  `border border-destructive text-destructive bg-transparent opacity-80
hover:opacity-100`.
  Never filled `bg-destructive` for inline actions.

#### Payout Section

- The payout CTA renders as a **full-width strip** at the bottom of the bounty
  detail, not as a card with a button inside. It uses
  `bg-primary
text-primary-foreground` and spans the full content width with
  label + subtitle on the left and an arrow on the right.

### Naming

- This is **Bounty.ninja**, not "Tasks.fyi". All user-facing strings say
  "bounty/bounties", not "task/tasks".
- Use `config.ts` values for app name, not hardcoded strings.

### Testing

- Unit tests in `src/tests/unit/`, E2E in `src/tests/e2e/`.
- Unit tests mock the `EventStore` directly — no relay connections.
- Integration tests add events to `EventStore` and use `flushSync()` for Svelte
  rune assertions.
- E2E tests use a local Nostr relay (`nak serve`), mock NIP-07 via
  `page.addInitScript()`, and mock Cashu mint.
- Run: `bun run test` (unit), `bun run test:e2e` (Playwright).

---

## What NOT to Do

- Do NOT use NDK (Nostr Development Kit) — this project uses Applesauce.
- Do NOT use Svelte 3/4 stores or reactive syntax.
- Do NOT add a backend, database, or server routes.
- Do NOT handle or store private keys.
- Do NOT use npm/yarn/pnpm — Bun only.
- Do NOT skip Markdown sanitization on user content.
- Do NOT use raw Tailwind color classes (`text-red-500`, `bg-white`,
  `text-white`, `bg-black`, etc.) — always use semantic theme tokens from
  `app.css`.

---

## Deploy

```bash
mise run deploy          # Build + deploy to Cloudflare Pages (production)
mise run deploy:preview  # Deploy to preview URL
```

Cloudflare project: `bounty-ninja`.

## Performance Targets

- First Contentful Paint < 1.5s
- Time to Interactive < 3s
- Bundle size < 400KB gzipped (actual: ~355KB)
- Lighthouse score > 90

## Current State (Feb 2026)

- **Phases 1-4 complete**, Phase 5 ~95%
- 578+ tests passing, 0 TypeScript errors
- Client-side caching fully implemented (SWR, LRU eviction, prefetching, quota
  monitoring)
- Logo: Hooded Figure (green hood, gold eyes) — `static/logo-icon.svg`
- `bounty.ninja` is live (also accessible via `bounty-ninja.pages.dev`)

## What's Next

- Verify `bounty.ninja` DNS
- Set up GitHub repo + push
- Lighthouse audit
- Consider dedicated Nosflare relay at `relay.bounty.ninja` (see
  `docs/SPEC-NOSFLARE-RELAY.md`)
- Relay removal persistence bug in settings

## Important Files

- `PRD.md` — Full product spec (the bible)
- `src/lib/config.ts` — App-wide configuration
- `docs/SPEC-CLIENT-CACHE.md` — Caching architecture spec
- `docs/SPEC-NOSFLARE-RELAY.md` — Dedicated relay spec
- `static/_headers` — CSP and security headers
- `static/_redirects` — SPA catch-all (`/* /index.html 200`)
- `mise.toml` — Task runner config (deploy, test, lint commands)
