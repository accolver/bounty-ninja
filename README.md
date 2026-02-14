# Bounty.ninja

A decentralized, censorship-resistant bounty board built on
[Nostr](https://nostr.com/) and [Cashu](https://cashu.space/). Post bounties,
fund them with bitcoin ecash, submit solutions, vote on winners, and receive
automatic payouts — all client-side, zero backend.

**Live:** [bounty.ninja](https://bounty.ninja)

## How It Works

1. **Post** a bounty as a Nostr event (Kind 37300)
2. **Fund** it by attaching P2PK-locked Cashu ecash tokens — pledgers retain
   custody
3. **Solve** by submitting proof of work with an anti-spam fee
4. **Vote** — funders vote weighted by their pledge amount (66% quorum)
5. **Payout** — consensus triggers automatic release to the winner

No accounts, no intermediaries, no rug-pulls. Identity is your Nostr keypair
(NIP-07 browser extension).

## Tech Stack

| Layer      | Technology                             |
| ---------- | -------------------------------------- |
| Framework  | SvelteKit 2 (static SPA, `ssr: false`) |
| Reactivity | Svelte 5 Runes                         |
| Nostr      | Applesauce v5 ecosystem + nostr-idb    |
| Payments   | @cashu/cashu-ts v3 (P2PK via NUT-11)   |
| UI         | shadcn-svelte (next) + Tailwind CSS 4  |
| Runtime    | Bun                                    |
| Testing    | Vitest + Playwright                    |
| Deploy     | Cloudflare Pages                       |

## Prerequisites

- [Bun](https://bun.sh/) >= 1.0
- [Node.js](https://nodejs.org/) >= 22
- [Docker](https://www.docker.com/) (for the local relay, optional)
- A NIP-07 browser extension (e.g., [Alby](https://getalby.com/),
  [nos2x](https://github.com/nicholasgasior/nos2x)) for signing

Optionally install [mise](https://mise.jdx.dev/) to auto-manage tool versions
and use the `mise run` task aliases shown below.

## Quick Start

### With mise

```bash
mise install             # Install tools + project dependencies (bun install runs automatically)

mise run dev:full        # Start local relay + seed data + dev server

# Or run each step separately:
mise run relay           # Start local strfry relay (Docker)
mise run seed            # Seed with sample bounties
mise run dev             # Dev server at http://localhost:5173
```

### Without mise

```bash
bun install              # Install project dependencies
bun run dev              # Dev server at http://localhost:5173
```

## Scripts

All scripts work via `bun run <script>` directly. The `mise run` column shows
the equivalent alias if you have mise installed.

| `bun run`  | `mise run`       | Description                        |
| ---------- | ---------------- | ---------------------------------- |
| `dev`      | `dev`            | Dev server with HMR                |
| `build`    | `build`          | Production build (static)          |
| `test`     | `test`           | Unit + integration tests           |
| `test:e2e` | `test:e2e`       | Playwright E2E tests               |
| `check`    | `check`          | TypeScript type checking           |
| `lint`     | `lint`           | ESLint + Prettier check            |
| `format`   | `format`         | Prettier auto-format               |
| —          | `deploy`         | Build + deploy to Cloudflare Pages |
| —          | `deploy:preview` | Deploy to preview URL              |
| —          | `clean`          | Remove build artifacts             |

## Project Structure

```
src/
├── lib/
│   ├── bounty/        # Domain logic (kinds, types, state machine, voting)
│   ├── cashu/         # Cashu ecash (escrow, P2PK, token validation)
│   ├── components/    # UI (auth, bounty, layout, search, shared, voting)
│   ├── nostr/         # Relay pool, event store, cache, loaders, signers
│   ├── stores/        # Svelte 5 rune stores (bounty list, search)
│   ├── utils/         # Formatting, env, error handling
│   └── config.ts      # Single source of truth for app config
├── routes/
│   ├── +page.svelte           # Home — bounty feed
│   ├── bounty/[naddr]/        # Bounty detail
│   ├── bounty/new/            # Create bounty
│   ├── profile/[npub]/        # User profile
│   ├── search/                # Search results
│   ├── settings/              # User settings
│   └── about/                 # About page
└── tests/                     # Unit, integration, E2E
```

## Nostr Event Kinds

| Kind  | Purpose                                       |
| ----- | --------------------------------------------- |
| 37300 | Bounty definition (parameterized replaceable) |
| 73001 | Solution submission                           |
| 73002 | Pledge (Cashu ecash attachment)               |
| 1018  | Consensus vote                                |
| 73004 | Payout record                                 |

## Bounty Lifecycle

```
draft → open → in_review → completed
         ↘ expired    ↗ cancelled
```

## License

[MIT](LICENSE.md)
