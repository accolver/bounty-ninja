# AGENTS.md — Bounty.ninja

> AI coding agents: read this file first. It's your context for working on this project.

## What This Is

**Bounty.ninja** is a decentralized bounty board built on Nostr + Cashu + SvelteKit 5. Users post bounties with bitcoin rewards, fund them with Cashu ecash tokens, and pay solvers — all client-side, no backend. Live at https://bounty.ninja, deployed on Cloudflare Pages.

Read `PRD.md` for the full product spec. It is the source of truth for architecture, data models, event kinds, and implementation decisions.

## Tech Stack

| Layer | Tech | Notes |
|-------|------|-------|
| Framework | SvelteKit 2 + Svelte 5 | Static site (`adapter-static`), SSR disabled, file-based routing |
| Reactivity | Svelte 5 Runes | `$state`, `$derived`, `$effect` — no legacy stores |
| Nostr | Applesauce v5 ecosystem | `applesauce-core`, `-relay`, `-loaders`, `-signers`, `-accounts`, `-actions` |
| Relay Comms | `RelayPool` (applesauce-relay) | RxJS-based subscriptions, singleton in `src/lib/nostr/relay-pool.ts` |
| Caching | `nostr-idb` (IndexedDB) + LRU | L1 EventStore → L2 IndexedDB → L3 relay. SWR pattern. See `src/lib/nostr/cache*.ts` |
| Cashu | `@cashu/cashu-ts` v3 | P2PK locking (NUT-11) for trustless escrow |
| UI | shadcn-svelte (next) + Tailwind 4 | Tokyo Night theme tokens, utility-first CSS |
| Icons | `@lucide/svelte` | Tree-shakeable SVG icons |
| Testing | Vitest 4 + Playwright | 578+ unit/integration tests, 16 E2E tests |
| Build | Vite 7, Bun | `bun install`, `bun run build`, `bun run test` |
| Deploy | Cloudflare Pages | `mise run deploy` (build + wrangler pages deploy) |
| Config | `src/lib/config.ts` | Single source of truth for branding, relays, storage keys, external links |

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

## Nostr Event Kinds

| Kind | Purpose | Reference |
|------|---------|-----------|
| 37300 | Bounty (replaceable) | `src/lib/bounty/kinds.ts` |
| 73001 | Pledge (Cashu ecash attachment) | |
| 73002 | Solution submission | |
| 1018 | Vote on solution | |
| 73004 | Payout event | |

All events use the `#t bounty.ninja` tag for discoverability. See `PRD.md §6` for full schema.

## Key Architecture Decisions

- **No backend.** Everything is client-side. All state comes from Nostr relays + local cache.
- **Applesauce RelayPool is a singleton.** Defined in `relay-pool.ts`, shared across the app. RxJS internals mean you cannot safely unsubscribe/resubscribe — use page reload for relay changes.
- **SWR caching.** `CachedQuery` class provides stale-while-revalidate: serve from IndexedDB instantly, revalidate from relays in background. Profile cache is LRU (500 max, 15min fresh / 24h stale).
- **`config.ts` is the single source of truth** for app name, storage prefix, default relays, mint URL, external links. Don't hardcode these elsewhere.
- **`min-h-dvh` not `min-h-screen`** — `100dvh` accounts for mobile browser chrome.
- **Never use `overflow-hidden` on the header** — it clips absolutely-positioned dropdown menus.
- **CSP uses `unsafe-inline`** for script-src because SvelteKit emits inline bootstrap scripts with build-specific hashes that aren't viable for static sites.

## Coding Conventions

### Svelte 5
- Use **runes** (`$state`, `$derived`, `$effect`), not legacy `$:` or `writable()`.
- Use `$props()` for component props, not `export let`.
- Use `onMount` for one-time initialization, `$effect` for reactive side effects.
- Prefer `{#snippet}` over slots when possible.

### Styling
- **Every interactive element** (`<button>`, clickable `<div>`, `<a>`) must have `hover:cursor-pointer`.
- **Every element with a `hover:` class** must also have a `transition` class (e.g. `transition-colors`, `transition-all`).
- Mobile-first responsive design. Test at 375px width minimum.
- Use Tailwind utility classes. Tokyo Night theme tokens are in `app.css`.

### TypeScript
- Strict mode. No `any` unless absolutely necessary (and document why).
- Type Nostr events explicitly — don't rely on `NostrEvent` generic.

### Testing
- Unit tests alongside source in `src/tests/unit/`.
- E2E tests in `src/tests/e2e/`.
- Run: `bun run test` (unit), `bun run test:e2e` (Playwright).

### Naming
- This is **Bounty.ninja**, not "Tasks.fyi". All user-facing strings say "bounty/bounties", not "task/tasks".
- Use `config.ts` values for app name, not hardcoded strings.

## Deploy

```bash
mise run deploy          # Build + deploy to Cloudflare Pages (production)
mise run deploy:preview  # Deploy to preview URL
```

Cloudflare project: `bounty-ninja`, account: `a60d0a4430a778bba92fa9d72d7adc87`.

## Current State (Feb 2026)

- **Phases 1-4 complete**, Phase 5 ~95% (CI pipeline, integration tests, bundle optimization)
- 578+ tests passing, 0 TypeScript errors
- Client-side caching fully implemented (SWR, LRU eviction, prefetching, quota monitoring)
- Logo: Hooded Figure (green hood, gold eyes) — `static/logo-icon.svg`
- DNS for `bounty.ninja` pending CNAME propagation (works via `bounty-ninja.pages.dev`)
- No git remote configured yet

## What's Next

- Verify `bounty.ninja` DNS
- Set up GitHub repo + push
- Lighthouse audit
- Consider dedicated Nosflare relay at `relay.bounty.ninja` (see `docs/SPEC-NOSFLARE-RELAY.md`)
- Relay removal persistence bug in settings

## Important Files

- `PRD.md` — Full product spec (the bible)
- `src/lib/config.ts` — App-wide configuration
- `docs/SPEC-CLIENT-CACHE.md` — Caching architecture spec
- `docs/SPEC-NOSFLARE-RELAY.md` — Dedicated relay spec
- `static/_headers` — CSP and security headers
- `static/_redirects` — SPA catch-all (`/* /index.html 200`)
- `mise.toml` — Task runner config (deploy, test, lint commands)
