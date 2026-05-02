# AGENTS.md — Bounty.ninja

AI agents: read this first. Keep changes aligned with `PRD.md` when protocol or
product behavior is unclear, but prefer the current source when this file and
code disagree.

## Product in one paragraph

Bounty.ninja (`https://bounty.ninja`) is a zero-backend bounty marketplace. Users
publish bounty, pledge, solution, vote, payout, retraction, and reputation events
to Nostr relays; pledges use Cashu ecash with P2PK locks. The app is a static
client-side SvelteKit SPA deployed to Cloudflare Pages.

## Stack and commands

- **Runtime/package manager:** Bun only (`bun install`, `bun add`, `bun run`). No
  npm/yarn/pnpm.
- **App:** SvelteKit 2 + Svelte 5 runes, TypeScript strict, Vite 7,
  `@sveltejs/adapter-static` with `fallback: 'index.html'`.
- **UI:** Tailwind CSS 4 (`@tailwindcss/vite`), bits-ui/shadcn-style components,
  `@lucide/svelte`, Milkdown/Crepe markdown editor.
- **Nostr:** Applesauce v5 (`applesauce-core`, `-relay`, `-loaders`, `-signers`,
  `-accounts`, `-actions`) plus `nostr-tools` types and `nostr-idb` cache.
- **Cashu:** `@cashu/cashu-ts` v3.
- **Validation:** `bun run check`, `bun run lint`, `bun run test:unit`,
  `bun run test:integration`, `bun run test:e2e`; `mise run test` runs unit +
  integration. `mise run dev:full` starts the local strfry relay, seeds it, and
  runs the dev server.
- **Deploy:** `mise run deploy` builds and deploys Cloudflare Pages project
  `bounty-ninja`; `mise run deploy:preview` deploys a preview branch.

## Non-negotiables

### No backend

- Do not add server routes, API endpoints, DB-backed server logic, or SSR-only
  behavior. `src/routes/+layout.ts` sets `ssr = false` and `prerender = false`.
- All canonical data comes from public Nostr events. The app derives state
  client-side from the Applesauce `EventStore`, IndexedDB cache, and relays.

### Privacy and signing

- Nostr events are public. Do not imply private user content.
- Never log private keys, nsecs, Cashu bearer tokens, or full sensitive payloads.
- Current login methods are NIP-07 extension, nsec memory-only signer, and NIP-46
  bunker. Preserve the rule that nsec/private signer material is not persisted.
- Cashu tokens are bearer instruments. Treat token display/storage changes as
  security-sensitive and warn users where appropriate.
- Rendered Markdown must go through the sanitizer (`src/lib/utils/sanitize.ts`,
  DOMPurify). Validate Nostr event signatures and tags before trusting events.

### Svelte 5 only

- Use runes: `$state`, `$derived`, `$effect`, `$props`, `$bindable`.
- Do not introduce legacy `$:` reactivity, `writable`/`readable`/`derived`
  stores, `$$props`, `$$restProps`, `createEventDispatcher`, or `<slot />`.
- Reactive stores live in `.svelte.ts` files as class-based stores. Use `onMount`
  only for one-time setup.

## Source map

```text
src/lib/bounty/        event kinds, parsing helpers, state machine, filters, voting
src/lib/cashu/         token encode/decode/validation, mint access, P2PK escrow flows
src/lib/nostr/         EventStore singleton, relay pool, loaders, cache, publish, signers
src/lib/stores/        Svelte-rune app stores (bounties, detail, search, settings, etc.)
src/lib/components/    UI by domain: auth, bounty, pledge, search, shared, solution, voting
src/lib/config.ts      app-wide branding, relays, mint, storage prefix, external links
src/routes/            SPA pages: home, bounty detail/new, profile, search, settings, about
src/tests/             Vitest unit/integration and Playwright E2E tests
```

Important implementation anchors:

- `src/lib/nostr/event-store.ts` exports the singleton Applesauce `EventStore`.
- `src/lib/nostr/relay-pool.ts` exports the singleton `RelayPool`. Be careful
  changing relay lifecycle behavior; page reload is the safest reset path.
- `src/lib/nostr/cache-query.ts` implements L1 EventStore → L2 `nostr-idb` → L3
  relay stale-while-revalidate queries.
- `src/lib/nostr/publish.ts` broadcasts signed events to all configured relays
  and succeeds if at least one relay accepts.
- `src/lib/nostr/signer.svelte.ts` signs templates, optimistically inserts into
  `EventStore`, and attaches the configured client tag via Applesauce
  `EventFactory`.
- `src/lib/cashu/escrow.ts` uses a **pledger-controlled escrow model**: pledges
  are self-locked to the pledger pubkey; after consensus each pledger releases
  their portion to the solver.

## Nostr protocol used here

| Kind  | Purpose                         |
| ----- | ------------------------------- |
| 37300 | Bounty definition               |
| 73001 | Solution submission             |
| 73002 | Pledge / Cashu funding event    |
| 1018  | Consensus vote                  |
| 73004 | Payout record                   |
| 73005 | Bounty or pledge retraction     |
| 73006 | Reputation attestation          |

- Published events must include the client tag value from
  `config.nostr.clientTag` / `CLIENT_TAG` (`bounty.ninja`).
- Addressable bounties use kind `37300` with a `d` tag; related events reference
  them via `a` tags in the form `37300:<pubkey>:<d-tag>`.
- Bounty statuses include `draft`, `open`, `in_review`, `consensus_reached`,
  `releasing`, `completed`, `expired`, and `cancelled`.
- Vote quorum defaults to 66% of pledged sats (`config.payments.voteQuorumPercent`).

## Configuration and local dev

- `src/lib/config.ts` is the source of truth for app name, URLs, default relays,
  search relay, default mint, storage prefix, and links. Do not hardcode these
  elsewhere.
- Environment defaults live in `mise.toml` (`PUBLIC_DEFAULT_RELAYS`,
  `PUBLIC_DEFAULT_MINT`, `PUBLIC_SEARCH_RELAY`, `LOCAL_RELAY`, etc.).
- Local relay tasks use Docker/strfry on `ws://localhost:10547`; `mise run
  relay:nak` is a lightweight alternative, but note the existing comment that
  `nak serve` truncates kinds greater than 65535.
- Vite currently **does not exclude** `@noble/*` from `optimizeDeps`; the config
  says Vite 7 handles them correctly when prebundled.

## Styling and UI rules

- Use semantic Tailwind theme tokens from `src/app.css` (`primary`, `secondary`,
  `destructive`, `success`, `warning`, `accent`, `background`, `foreground`,
  `card`, `muted`, `border`, `input`, `ring`, `popover`, `overlay`). Avoid raw
  color utilities like `text-red-500`, `bg-white`, `text-white`, `bg-black`.
- Design direction is flat, minimal sections: avoid cards-on-cards; use dividers
  and whitespace for content sections. Cards are mainly for dialogs, popovers,
  dropdowns, and chrome.
- Filled `bg-primary`/`bg-success` is reserved for actions/CTAs, not passive
  information. Badges are outline style.
- Links are `text-foreground` at rest with `hover:text-primary`. Monetary values
  and stats remain neutral (`text-foreground`).
- Every interactive element should have `hover:cursor-pointer`; every element
  with a `hover:` class should also have a transition class.
- Use `min-h-dvh` instead of `min-h-screen`. Do not put `overflow-hidden` on the
  header; it clips dropdown menus.
- Default theme is Mandalorian dark; `.light` enables Mandalorian Day.

## Testing notes

- Unit tests usually mock or insert directly into `EventStore`; avoid real relay
  connections in unit tests.
- Integration tests compose domain flows around `EventStore` and Svelte rune
  stores; use Svelte `flushSync()` where rune assertions need a flush.
- E2E tests use a local Nostr relay plus mocked NIP-07/Cashu behavior.
- Current test layout: many unit tests, 4 integration files, and 3 E2E spec
  files. Prefer adding focused tests near the code you change.

## Do not do these things

- Do not use NDK; this codebase uses Applesauce.
- Do not add backend persistence or private APIs.
- Do not persist nsec/private key material or expose Cashu tokens in logs.
- Do not skip Markdown sanitization or Nostr tag/signature validation.
- Do not rename the product to Tasks.fyi; user-facing copy should say
  Bounty.ninja and bounty/bounties.
