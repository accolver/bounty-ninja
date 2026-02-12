## Why

Bounty.ninja has a comprehensive PRD (Section 18, Phase 1) but zero application
code exists. Before any task-specific features can be built, we need the
foundational project scaffold: SvelteKit initialization, dependency
installation, Nostr relay connectivity via Applesauce, NIP-07 authentication,
IndexedDB caching, and the basic layout shell with Tokyo Night theming. This is
the critical path — every subsequent phase depends on this infrastructure.

## What Changes

- Initialize SvelteKit 2 project with static adapter, TypeScript strict mode,
  and Bun as package manager
- Install all production and dev dependencies (Applesauce ecosystem, nostr-idb,
  @cashu/cashu-ts, nostr-tools, RxJS, shadcn-svelte, Tailwind CSS 4)
- Configure Vite 6 with Tailwind plugin and `optimizeDeps` exclusions for
  `@noble/curves` and `@noble/hashes`
- Set up Tokyo Night semantic color tokens in `app.css` via Tailwind CSS 4
  `@theme` directive
- Create singleton `EventStore` and `RelayPool` instances with default relay
  connections
- Set up nostr-idb IndexedDB cache for event persistence across page reloads
- Implement NIP-07 signer detection and reactive authentication state using
  Svelte 5 runes
- Build root layout with Header (logo, login) and Footer (relay status)
  components
- Initialize shadcn-svelte with Button, Card, Badge, Input, Dialog components
- Create shared utility modules: constants, typed env access, formatting helpers
- Define event kind constants (37300, 73001, 73002, 1018, 73004)
- Create mise.toml for tool version management and task running
- Create environment variable files (.env, .env.example) with public relay/mint
  config
- Build a proof-of-concept home page that displays raw events from connected
  relays

## Capabilities

### New Capabilities

- `project-scaffold`: SvelteKit project initialization, configuration files,
  dependency management, and build tooling (PRD Sections 4-5)
- `nostr-connectivity`: Applesauce EventStore singleton, RelayPool with default
  relay connections, nostr-idb IndexedDB caching, and event subscription
  infrastructure (PRD Section 7)
- `authentication`: NIP-07 browser extension signer detection, login/logout
  flow, reactive account state using Svelte 5 runes (PRD Section 14.1)
- `theming`: Tokyo Night dark/light theme with semantic CSS custom properties
  via Tailwind CSS 4 @theme, shadcn-svelte component initialization (PRD
  Section 12)
- `app-layout`: Root layout shell with Header, Footer, relay status indicator,
  and responsive structure (PRD Section 9)

### Modified Capabilities

(none — greenfield project)

## Impact

- **New files**: ~25 files across project root config, `src/lib/nostr/`,
  `src/lib/utils/`, `src/lib/components/layout/`, `src/lib/components/auth/`,
  `src/lib/components/shared/`, `src/routes/`
- **Dependencies**: All npm packages listed in PRD Section 19 installed
- **Build**: Static site output in `build/` directory via `bun run build`
- **Dev server**: `bun run dev` at localhost:5173
- **Acceptance criteria** (from PRD Phase 1): Dev server starts without errors,
  connects to 2+ default relays with green/red indicators, NIP-07 login displays
  npub, events flow into EventStore, IndexedDB cache persists across reloads,
  Tokyo Night theme applied globally, static build succeeds, TypeScript compiles
  with zero errors
