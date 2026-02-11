# AGENTS.md — Tasks.fyi

> Injected into every AI coding session. Read `PRD.md` for full specifications.

## What Is This?

**Tasks.fyi** is a decentralized, censorship-resistant bounty board / labor
marketplace. Users post bounties as Nostr events, fund them with P2PK-locked
Cashu ecash, submit solutions, vote on winners, and receive automatic payouts.
Zero backend — entirely client-side.

**Domain:** <https://tasks.fyi>

---

## Stack — Non-Negotiable

| Layer            | Technology                                          | Notes                                                                                   |
| ---------------- | --------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Language         | **TypeScript**                                      | Strict mode. No `any` unless truly unavoidable.                                         |
| Framework        | **SvelteKit 2**                                     | Static adapter, SPA mode (`ssr: false`)                                                 |
| Reactivity       | **Svelte 5 Runes**                                  | `$state`, `$derived`, `$effect` — NO legacy `$:`, NO `writable()`/`readable()` stores   |
| Runtime          | **Bun**                                             | Package manager AND runtime. Use `bun add`, `bun run`, etc.                             |
| UI Components    | **shadcn-svelte** (next)                            | Accessible, composable primitives                                                       |
| Styling          | **Tailwind CSS 4**                                  | Via `@tailwindcss/vite` plugin. Tokyo Night theme tokens.                               |
| Nostr            | **Applesauce** libraries                            | `applesauce-core`, `applesauce-relay`, `applesauce-loaders`, `applesauce-signers`, etc. |
| Nostr Cache      | **nostr-idb**                                       | IndexedDB-backed event cache                                                            |
| Nostr Types      | **nostr-tools**                                     | Use `NostrEvent`, `Filter` types from here — NOT from NDK                               |
| Cashu            | **@cashu/cashu-ts**                                 | P2PK locking via NUT-11                                                                 |
| Reactive Streams | **RxJS**                                            | Bridged to Svelte 5 Runes in class-based stores                                         |
| Testing          | **Vitest** (unit/integration), **Playwright** (E2E) |                                                                                         |
| Linting          | **ESLint** + **Prettier**                           | `prettier-plugin-svelte`                                                                |
| Build            | **Vite 6**                                          |                                                                                         |
| Tool Management  | **mise**                                            | Manages Bun, Node, nak versions                                                         |

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
- Sanitize all rendered Markdown to prevent XSS.
- Validate event signatures and Cashu token structure.

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

### Bun — Always

- Use `bun` for all package operations: `bun add`, `bun remove`, `bun run`,
  `bun test`.
- Never use `npm`, `yarn`, or `pnpm`.
- Lock file is `bun.lockb`.

### No Backend

- This is a **static SPA**. No server routes, no API endpoints, no server-side
  logic.
- All data comes from Nostr relay WebSocket subscriptions.
- All state is derived client-side from events in the Applesauce `EventStore` +
  IndexedDB cache.
- `adapter-static` with `fallback: "index.html"`, `ssr: false`,
  `prerender: false`.

---

## Architecture Patterns

### State Management

- **Applesauce `EventStore`** is the single source of truth for Nostr events
  (in-memory).
- **nostr-idb** persists events to IndexedDB for offline/reload resilience.
- **Class-based `.svelte.ts` stores** bridge RxJS Observables (from Applesauce)
  to Svelte 5 runes.
- **Singleton pattern** for core services: `eventStore`, `pool` (RelayPool),
  CashuMint/CashuWallet.
- **Optimistic local updates** on event publish — insert into EventStore
  immediately before relay confirmation.

### Nostr Event Kinds

| Kind  | Type                      | Purpose             |
| ----- | ------------------------- | ------------------- |
| 37300 | Parameterized Replaceable | Bounty definition   |
| 73001 | Regular                   | Solution submission |
| 73002 | Regular                   | Pledge (funding)    |
| 1018  | Regular                   | Consensus vote      |
| 73004 | Regular                   | Payout record       |

### Bounty Lifecycle

`draft` → `open` → `in_review` → `completed` (side transitions: `expired`,
`cancelled`)

All published events must include the tag `["client", "tasks.fyi"]`.

---

## File Conventions

- **TypeScript files:** kebab-case (`relay-pool.ts`, `state-machine.ts`)
- **Svelte components:** PascalCase (`BountyCard.svelte`, `PledgeForm.svelte`)
- **Reactive modules:** `.svelte.ts` extension for files using runes
  (`signer.svelte.ts`, `bounties.svelte.ts`)
- **Path alias:** `$lib` → `./src/lib`
- **Component organization:** Domain-based directories under
  `src/lib/components/` (bounty, pledge, solution, voting, auth, search, layout,
  shared)
- **Tests:** `src/tests/unit/`, `src/tests/integration/`, `src/tests/e2e/`

---

## Styling

- **Tailwind CSS 4** with `@tailwindcss/vite` plugin (not PostCSS).
- **Tokyo Night** color scheme with semantic CSS custom properties defined via
  `@theme` in `app.css`.
- **Dark mode default** (Tokyo Night Storm). Light mode via `.light` class
  (Tokyo Night Day).
- shadcn-svelte components consume semantic tokens.
- Target **WCAG 2.1 AA**: 4.5:1 contrast ratio, keyboard navigation, screen
  reader support, `prefers-reduced-motion`.

---

## Performance Targets

- First Contentful Paint < 1.5s
- Time to Interactive < 3s
- Bundle size < 200KB gzipped
- Lighthouse score > 90

---

## Dependencies to Exclude from Vite optimizeDeps

`@noble/curves` and `@noble/hashes` — WASM compatibility requirement.

---

## Testing Notes

- Unit tests mock the `EventStore` directly — no relay connections.
- Integration tests add events to `EventStore` and use `flushSync()` for Svelte
  rune assertions.
- E2E tests use a local Nostr relay (`nak serve`), mock NIP-07 via
  `page.addInitScript()`, and mock Cashu mint.
- Linear voting math must be tested with edge cases (zero pledges, single
  funder, tie-breaking).

---

## What NOT to Do

- Do NOT use NDK (Nostr Development Kit) — this project uses Applesauce.
- Do NOT use Svelte 3/4 stores or reactive syntax.
- Do NOT add a backend, database, or server routes.
- Do NOT handle or store private keys.
- Do NOT use npm/yarn/pnpm — Bun only.
- Do NOT use SSR or prerendering.
- Do NOT skip Markdown sanitization on user content.
- Do NOT run `terraform apply`, `terragrunt apply`, or similar infrastructure
  commands.
