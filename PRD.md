# Bounty.ninja — Product Requirements Document

## A Decentralized Task Board Powered by Nostr, Cashu & Svelte 5

**Domain:** https://bounty.ninja **Version:** 2.1 **Last Updated:** 2026-02-13
**Status:** Ready for AI-Assisted Implementation

---

## Table of Contents

1. [Overview](#1-overview)
2. [Goals & Objectives](#2-goals--objectives)
3. [Technology Stack](#3-technology-stack)
4. [Environment & Setup](#4-environment--setup)
5. [Project Structure](#5-project-structure)
6. [Data Models — Nostr Event Kinds](#6-data-models--nostr-event-kinds)
7. [State Management Architecture](#7-state-management-architecture)
8. [Route Map](#8-route-map)
9. [Component Hierarchy](#9-component-hierarchy)
10. [Functional Requirements & Product Logic](#10-functional-requirements--product-logic)
11. [Relay Protocol Contracts](#11-relay-protocol-contracts)
12. [Visual Design — Tokyo Night Semantic Theming](#12-visual-design--tokyo-night-semantic-theming)
13. [Error Handling & Edge Cases](#13-error-handling--edge-cases)
14. [Security & Privacy](#14-security--privacy)
15. [Performance Requirements](#15-performance-requirements)
16. [Accessibility Requirements](#16-accessibility-requirements)
17. [Quality Assurance — Testing Strategy](#17-quality-assurance--testing-strategy)
18. [Phased Implementation Plan](#18-phased-implementation-plan)
19. [Dependencies & External Services](#19-dependencies--external-services)
20. [Out of Scope (Post-MVP)](#20-out-of-scope-post-mvp)
21. [Open Questions](#21-open-questions)
22. [Recommendations & Risk Analysis](#22-recommendations--risk-analysis)
23. [Glossary](#23-glossary)
24. [Works Cited](#24-works-cited)

---

## 1. Overview

**Bounty.ninja** is a sovereign, censorship-resistant labor marketplace built
entirely on the Nostr protocol. It enables anyone to post tasks with bitcoin
rewards, fund them with Cashu ecash, and pay solvers — all without a central
server, database, or intermediary.

The application is a **local-first, client-side only** SvelteKit static site.
All state is derived from Nostr relay subscriptions and cached locally in
IndexedDB. Financial settlement uses Cashu ecash tokens with P2PK (NUT-11)
spending conditions for pledger-controlled escrow — pledgers retain custody of
their funds until community consensus triggers release.

**Key value proposition:** A global, permissionless task board where:

- Anyone can post a task by publishing a Nostr event
- Anyone can fund a task by attaching P2PK-locked Cashu tokens
- Anyone can submit solutions with proof of work
- Funders vote on solutions weighted by their contribution
- Payout is automatic upon consensus

---

## 2. Goals & Objectives

### Primary Goal

Ship an MVP task board at https://bounty.ninja where users can create, fund,
solve, and pay out tasks using Nostr + Cashu — with zero backend infrastructure.

### Secondary Goals

- Demonstrate a viable "freedom tech" alternative to centralized freelance
  platforms
- Establish the Kind 37300/73001/73002/1018/73004 event schema as a de facto
  task standard on Nostr
- Provide a reference implementation for Applesauce + Svelte 5 integration

### Success Metrics

| Metric                         | Target | Measurement                                           |
| ------------------------------ | ------ | ----------------------------------------------------- |
| Tasks created (first 90 days)  | 100+   | Count of Kind 37300 events with `#t bounty.ninja` tag |
| Unique pubkeys interacting     | 50+    | Distinct pubkeys across all task event kinds          |
| Successful payouts             | 20+    | Count of Kind 73004 payout events                     |
| Page load time (cold)          | < 3s   | Lighthouse performance audit                          |
| Lighthouse accessibility score | > 90   | Lighthouse audit                                      |

---

## 3. Technology Stack

| Layer                 | Technology               | Version                 | Role                                                          |
| --------------------- | ------------------------ | ----------------------- | ------------------------------------------------------------- |
| **Framework**         | SvelteKit                | ^2.x                    | Static site generation, file-based routing, SSR disabled      |
| **Language**          | TypeScript               | ^5.x                    | Type safety across all modules                                |
| **UI Reactivity**     | Svelte 5 Runes           | (bundled with Svelte 5) | `$state`, `$derived`, `$effect` for fine-grained reactivity   |
| **Nostr Event Store** | applesauce-core          | ^5.x                    | `EventStore` for reactive in-memory Nostr event database      |
| **Nostr Relay Comms** | applesauce-relay         | ^5.x                    | `RelayPool`, RxJS-based relay subscriptions                   |
| **Nostr Loaders**     | applesauce-loaders       | ^5.x                    | `TimelineLoader`, `EventLoader` for fetching events           |
| **Nostr Helpers**     | applesauce-common        | ^5.x                    | Helpers, models, blueprints for common patterns               |
| **Nostr Signers**     | applesauce-signers       | ^5.x                    | NIP-07 browser extension signer support                       |
| **Nostr Accounts**    | applesauce-accounts      | ^5.x                    | Account management (multi-account support)                    |
| **Nostr Actions**     | applesauce-actions       | ^5.x                    | Pre-built actions for event creation workflows                |
| **Nostr Caching**     | applesauce-wallet        | ^5.x                    | NIP-60 Cashu wallet integration                               |
| **Local Cache**       | nostr-idb                | ^2.x                    | IndexedDB-backed event cache                                  |
| **Cashu**             | @cashu/cashu-ts          | ^2.x                    | Cashu token creation, P2PK locking (NUT-11), mint interaction |
| **UI Components**     | shadcn-svelte            | ^next                   | Accessible, composable component primitives                   |
| **Styling**           | Tailwind CSS             | ^4.x                    | Utility-first CSS with Tokyo Night theme tokens               |
| **RxJS**              | rxjs                     | ^7.x                    | Observable streams (Applesauce dependency)                    |
| **Testing**           | Vitest                   | ^3.x                    | Unit and integration tests                                    |
| **E2E Testing**       | Playwright               | ^1.x                    | End-to-end browser tests                                      |
| **Build**             | Vite                     | ^6.x                    | Bundler (ships with SvelteKit)                                |
| **Adapter**           | @sveltejs/adapter-static | ^3.x                    | Static site output for deployment                             |
| **Runtime & Pkg Mgr** | Bun                      | ^1.x                    | Fast all-in-one JavaScript runtime and package manager        |
| **Node**              | Node.js                  | ^22.x                   | Fallback runtime for build tooling compatibility              |

---

## 4. Environment & Setup

### 4.1 Prerequisites

```bash
# Required global tools
node --version  # >= 22.0.0
bun --version   # >= 1.0.0
```

### 4.2 Project Initialization

```bash
# Create the SvelteKit project
bun create svelte@latest bounty-ninja
# When prompted:
#   - Template: Skeleton project
#   - Type checking: Yes, using TypeScript
#   - Additional options: ESLint, Prettier, Vitest, Playwright

cd bounty-ninja
```

### 4.3 Install Dependencies

```bash
# Applesauce ecosystem (Nostr)
bun add applesauce-core applesauce-relay applesauce-loaders applesauce-common applesauce-signers applesauce-accounts applesauce-actions applesauce-wallet nostr-idb

# Cashu
bun add @cashu/cashu-ts

# RxJS (Applesauce peer dependency)
bun add rxjs

# UI
bun add -D tailwindcss @tailwindcss/vite
bunx shadcn-svelte@next init
# When prompted for shadcn-svelte init:
#   - Style: Default
#   - Base color: Neutral (we override with Tokyo Night)
#   - CSS variables: Yes

# Nostr utilities
bun add nostr-tools

# Dev dependencies
bun add -D @sveltejs/adapter-static
bun add -D @playwright/test
```

### 4.4 Environment Variables

Create a `.env` file at the project root. **None of these contain secrets** —
they are all public configuration for a client-side app.

```env
# .env
# Default relay list (comma-separated WebSocket URLs)
PUBLIC_DEFAULT_RELAYS=wss://relay.damus.io,wss://nos.lol,wss://relay.primal.net

# Default Cashu mint URL
PUBLIC_DEFAULT_MINT=https://mint.minibits.cash/Bitcoin

# App metadata
PUBLIC_APP_NAME=Bounty.ninja
PUBLIC_APP_URL=https://bounty.ninja

# Anti-spam fee range (in sats)
PUBLIC_MIN_SUBMISSION_FEE=10
PUBLIC_MAX_SUBMISSION_FEE=10000

# Vote quorum threshold (percentage, default 66 for supermajority)
PUBLIC_VOTE_QUORUM_PERCENT=66

# Maximum deadline duration in days (default 365)
PUBLIC_MAX_DEADLINE_DAYS=365

# NIP-50 search relay (must support search filter)
PUBLIC_SEARCH_RELAY=wss://search.nos.today
```

Create `.env.example` with the same content (committed to git).

### 4.5 SvelteKit Adapter Configuration

```typescript
// svelte.config.js
import adapter from "@sveltejs/adapter-static";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      pages: "build",
      assets: "build",
      fallback: "index.html", // SPA fallback for client-side routing
      precompress: true,
      strict: true,
    }),
    alias: {
      $lib: "./src/lib",
      "$lib/*": "./src/lib/*",
    },
  },
};

export default config;
```

### 4.6 Vite Configuration

```typescript
// vite.config.ts
import tailwindcss from "@tailwindcss/vite";
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
  // Required for Cashu/nostr-tools WASM
  optimizeDeps: {
    exclude: ["@noble/curves", "@noble/hashes"],
  },
});
```

### 4.7 mise.toml — Tool Versions, Environment & Tasks

Create a `mise.toml` file at the project root. [mise](https://mise.jdx.dev/)
manages tool versions, environment variables, and project tasks in a single
file.

```toml
# mise.toml
min_version = "2024.11.1"

[tools]
node = "22"
bun = "latest"
# nak (nostr army knife) — CLI for Nostr relay interaction, event publishing, local relay
"go:github.com/fiatjaf/nak" = "latest"

[env]
# Default relay list (comma-separated WebSocket URLs)
PUBLIC_DEFAULT_RELAYS = "wss://relay.damus.io,wss://nos.lol,wss://relay.primal.net"
# Default Cashu mint URL
PUBLIC_DEFAULT_MINT = "https://mint.minibits.cash/Bitcoin"
# App metadata
PUBLIC_APP_NAME = "Bounty.ninja"
PUBLIC_APP_URL = "https://bounty.ninja"
# Anti-spam fee range (in sats)
PUBLIC_MIN_SUBMISSION_FEE = "10"
PUBLIC_MAX_SUBMISSION_FEE = "10000"
# Vote quorum threshold — percentage of total pledged sats required for consensus
PUBLIC_VOTE_QUORUM_PERCENT = "66"
# Maximum deadline duration in days (1 year)
PUBLIC_MAX_DEADLINE_DAYS = "365"
# NIP-50 search relay (must support search filter)
PUBLIC_SEARCH_RELAY = "wss://search.nos.today"
# Local relay URL for development
LOCAL_RELAY = "ws://localhost:10547"

[tasks.dev]
description = "Start the SvelteKit dev server with hot reloading"
run = "bun run dev"

[tasks.build]
description = "Build the static site for production"
run = "bun run build"

[tasks.preview]
description = "Preview the production build locally"
run = "bun run preview"

[tasks.test]
description = "Run unit and integration tests"
run = "bun run test:unit && bun run test:integration"

[tasks."test:unit"]
description = "Run unit tests only"
run = "bun run test:unit"

[tasks."test:integration"]
description = "Run integration tests only"
run = "bun run test:integration"

[tasks."test:e2e"]
description = "Run Playwright end-to-end tests"
run = "bun run test:e2e"

[tasks.relay]
description = "Start a local Nostr relay at ws://localhost:10547 (in-memory)"
run = "nak serve"

[tasks."relay:negentropy"]
description = "Start local relay with NIP-77 negentropy sync support"
run = "nak serve --negentropy"

[tasks.seed]
description = "Seed the local relay with sample task events for development"
run = """
echo "Seeding local relay at ws://localhost:10547 with sample task events..."

# Generate a throwaway keypair for seeding (nak uses random key if no --sec provided)
# Task 1: Development task
nak event \
  -k 37300 \
  -c 'Build a Lightning-powered vending machine controller. Must support LNURL-pay and NFC tap-to-pay. Provide a working prototype with documentation.' \
  --tag d=task-dev-001 \
  --tag title='Lightning Vending Machine Controller' \
  --tag reward=50000 \
  --tag t=development \
  --tag t=lightning \
  --tag t=hardware \
  --tag fee=21 \
  --tag client=bounty.ninja \
  ws://localhost:10547

# Task 2: Design task
nak event \
  -k 37300 \
  -c 'Design a logo and brand identity for a Nostr-based marketplace. Deliverables: SVG logo, color palette, typography guide, and 3 social media templates.' \
  --tag d=task-design-001 \
  --tag title='Nostr Marketplace Brand Identity' \
  --tag reward=25000 \
  --tag t=design \
  --tag t=branding \
  --tag fee=10 \
  --tag client=bounty.ninja \
  ws://localhost:10547

# Task 3: Documentation task
nak event \
  -k 37300 \
  -c 'Write a comprehensive beginner guide to Cashu ecash. Cover: what is ecash, how Cashu works, setting up a wallet, minting tokens, and P2PK locking. Target audience: Bitcoin users new to ecash.' \
  --tag d=task-docs-001 \
  --tag title='Beginner Guide to Cashu Ecash' \
  --tag reward=15000 \
  --tag t=documentation \
  --tag t=cashu \
  --tag t=writing \
  --tag fee=10 \
  --tag client=bounty.ninja \
  ws://localhost:10547

echo "Done! 3 sample tasks seeded to ws://localhost:10547"
echo "Start the dev server with 'mise run dev' and browse to http://localhost:5173"
"""

[tasks.lint]
description = "Run ESLint linting"
run = "bun run lint"

[tasks.format]
description = "Run Prettier formatting"
run = "bun run format"

[tasks.check]
description = "Run svelte-check for type errors"
run = "bun run check"

[tasks.clean]
description = "Remove build artifacts and caches"
run = "rm -rf build .svelte-kit node_modules/.vite"
```

**Usage:**

```bash
# Install all tools (bun, node, nak)
mise install

# Start local relay + seed it with test data (run in separate terminals)
mise run relay
mise run seed

# Start dev server
mise run dev

# Run all tests
mise run test

# Build for production
mise run build
```

> **Note:** The `seed` task requires the local relay to be running
> (`mise run relay` in another terminal). The seeded events use throwaway keys
> generated by `nak` — they are for local development only.

---

## 5. Project Structure

```
bounty-ninja/
├── .env                              # Environment variables (public config only)
├── .env.example                      # Template for env vars (committed)
├── mise.toml                         # Tool versions, env vars, and task runner config
├── svelte.config.js                  # SvelteKit config with static adapter
├── vite.config.ts                    # Vite config with Tailwind plugin
├── tailwind.config.ts                # Tailwind config (if needed beyond CSS)
├── tsconfig.json                     # TypeScript configuration
├── package.json                      # Dependencies and scripts
├── playwright.config.ts              # Playwright E2E test config
├── vitest.config.ts                  # Vitest unit/integration test config (if overriding)
│
├── src/
│   ├── app.html                      # HTML shell template
│   ├── app.css                       # Global CSS: Tailwind imports + Tokyo Night tokens
│   ├── app.d.ts                      # Global TypeScript declarations (NIP-07 window.nostr)
│   │
│   ├── lib/
│   │   ├── nostr/                    # === NOSTR PROTOCOL LAYER ===
│   │   │   ├── event-store.ts        # Singleton EventStore instance
│   │   │   ├── relay-pool.ts         # Singleton RelayPool instance + connection management
│   │   │   ├── signer.svelte.ts      # NIP-07 signer state (reactive)
│   │   │   ├── account.svelte.ts     # Current account/pubkey state (reactive)
│   │   │   ├── cache.ts              # nostr-idb IndexedDB cache setup
│   │   │   └── loaders/
│   │   │       ├── task-loader.ts  # TimelineLoader for Kind 37300 tasks
│   │   │       ├── pledge-loader.ts  # Loader for Kind 73002 pledges by task
│   │   │       ├── solution-loader.ts # Loader for Kind 73001 solutions by task
│   │   │       ├── vote-loader.ts    # Loader for Kind 1018 votes by task
│   │   │       └── profile-loader.ts # Loader for Kind 0 profiles
│   │   │
│   │   ├── task/                   # === TASK DOMAIN LOGIC ===
│   │   │   ├── types.ts              # TypeScript interfaces for all task event kinds
│   │   │   ├── kinds.ts              # Event kind constants (37300, 73001, 73002, etc.)
│   │   │   ├── state-machine.ts      # Task lifecycle state derivation
│   │   │   ├── filters.ts            # Nostr filter builders for task queries
│   │   │   ├── blueprints.ts         # Applesauce EventFactory blueprints for task events
│   │   │   ├── helpers.ts            # Parse/extract helpers for task event tags
│   │   │   ├── voting.ts             # Linear weighted voting calculation
│   │   │   ├── taxonomy.ts           # Auto-tag taxonomy: category → keyword patterns
│   │   │   └── auto-tagger.ts        # suggestTags() — matches title/desc against taxonomy
│   │   │
│   │   ├── cashu/                    # === CASHU PAYMENT LAYER ===
│   │   │   ├── mint.ts               # CashuMint + CashuWallet singleton
│   │   │   ├── token.ts              # Token encoding/decoding utilities
│   │   │   ├── p2pk.ts               # P2PK lock/unlock helpers (NUT-11)
│   │   │   ├── escrow.ts             # Escrow logic: lock tokens to task, claim on payout
│   │   │   └── types.ts              # Cashu-specific TypeScript types
│   │   │
│   │   ├── stores/                   # === REACTIVE STORES (Svelte 5 Runes) ===
│   │   │   ├── tasks.svelte.ts    # Reactive task list store (bridges EventStore → $state)
│   │   │   ├── task-detail.svelte.ts # Single task + pledges + solutions + votes
│   │   │   ├── search.svelte.ts      # NIP-50 search state
│   │   │   ├── user-profile.svelte.ts # Current user profile state
│   │   │   └── toast.svelte.ts       # Global toast/notification state
│   │   │
│   │   ├── components/               # === UI COMPONENTS ===
│   │   │   ├── layout/
│   │   │   │   ├── Header.svelte     # Top nav: logo, search, login/profile
│   │   │   │   ├── Footer.svelte     # Footer: relay status, links
│   │   │   │   ├── Sidebar.svelte    # Category/filter sidebar (desktop)
│   │   │   │   └── MobileNav.svelte  # Bottom nav for mobile
│   │   │   │
│   │   │   ├── task/
│   │   │   │   ├── BountyCard.svelte       # Task summary card (for lists)
│   │   │   │   ├── BountyDetail.svelte     # Full task view with tabs
│   │   │   │   ├── BountyForm.svelte       # Create/edit task form
│   │   │   │   ├── BountyStatusBadge.svelte # Status indicator (open/funded/solved/paid)
│   │   │   │   ├── BountyTags.svelte       # Tag pills display
│   │   │   │   ├── BountyTimer.svelte      # Deadline countdown (if applicable)
│   │   │   │   └── TagAutoSuggest.svelte # Taxonomy suggestions + community autocomplete
│   │   │   │
│   │   │   ├── pledge/
│   │   │   │   ├── PledgeButton.svelte     # "Fund this task" CTA
│   │   │   │   ├── PledgeForm.svelte       # Amount input + Cashu token creation
│   │   │   │   ├── PledgeList.svelte       # List of pledges for a task
│   │   │   │   └── PledgeItem.svelte       # Single pledge row
│   │   │   │
│   │   │   ├── solution/
│   │   │   │   ├── SolutionForm.svelte     # Submit solution + anti-spam fee
│   │   │   │   ├── SolutionList.svelte     # List of solutions for a task
│   │   │   │   ├── SolutionItem.svelte     # Single solution with vote controls
│   │   │   │   └── SolutionDetail.svelte   # Expanded solution view
│   │   │   │
│   │   │   ├── voting/
│   │   │   │   ├── VoteButton.svelte       # Approve/reject vote button
│   │   │   │   ├── VoteProgress.svelte     # Visual vote tally (weighted)
│   │   │   │   └── VoteResults.svelte      # Final vote outcome display
│   │   │   │
│   │   │   ├── auth/
│   │   │   │   ├── LoginButton.svelte      # NIP-07 login trigger
│   │   │   │   ├── ProfileMenu.svelte      # Logged-in user dropdown
│   │   │   │   └── ProfileAvatar.svelte    # User avatar (from Kind 0)
│   │   │   │
│   │   │   ├── search/
│   │   │   │   ├── SearchBar.svelte        # NIP-50 search input
│   │   │   │   └── SearchResults.svelte    # Search results list
│   │   │   │
│   │   │   └── shared/
│   │   │       ├── RelayStatus.svelte      # Connected relay indicator
│   │   │       ├── SatAmount.svelte        # Formatted sat display (with icon)
│   │   │       ├── TimeAgo.svelte          # Relative time display
│   │   │       ├── Markdown.svelte         # Markdown renderer for task descriptions
│   │   │       ├── EmptyState.svelte       # Empty state placeholder
│   │   │       ├── LoadingSpinner.svelte   # Loading indicator
│   │   │       ├── ErrorBoundary.svelte    # Error boundary wrapper
│   │   │       └── Toaster.svelte          # Toast notification container
│   │   │
│   │   └── utils/
│   │       ├── format.ts             # Number/date/npub formatting utilities
│   │       ├── nostr-helpers.ts      # npub/nprofile encoding, tag parsing
│   │       ├── constants.ts          # App-wide constants
│   │       └── env.ts               # Typed env var access
│   │
│   ├── routes/                       # === SVELTEKIT ROUTES ===
│   │   ├── +layout.svelte            # Root layout: Header + main + Footer
│   │   ├── +layout.ts               # Root layout load: init Nostr, check NIP-07
│   │   ├── +page.svelte              # Home: Popular tasks + search
│   │   ├── +page.ts                  # Home load: fetch trending tasks
│   │   │
│   │   ├── task/
│   │   │   ├── new/
│   │   │   │   └── +page.svelte      # Create new task form
│   │   │   └── [naddr]/
│   │   │       ├── +page.svelte      # Task detail page
│   │   │       └── +page.ts          # Load task by naddr (NIP-19)
│   │   │
│   │   ├── profile/
│   │   │   └── [npub]/
│   │   │       ├── +page.svelte      # User profile: their tasks, solutions, reputation
│   │   │       └── +page.ts          # Load profile by npub
│   │   │
│   │   ├── search/
│   │   │   ├── +page.svelte          # Search results page
│   │   │   └── +page.ts              # NIP-50 search query execution
│   │   │
│   │   └── settings/
│   │       └── +page.svelte          # User settings: relays, mint, theme
│   │
│   └── tests/
│       ├── unit/
│       │   ├── voting.test.ts        # Square-root voting calculation tests
│       │   ├── state-machine.test.ts # Task lifecycle state tests
│       │   ├── p2pk.test.ts          # P2PK lock/unlock tests
│       │   ├── helpers.test.ts       # Task tag parsing tests
│       │   └── filters.test.ts       # Nostr filter builder tests
│       │
│       ├── integration/
│       │   ├── task-store.svelte.test.ts  # EventStore → Svelte reactivity
│       │   ├── pledge-flow.svelte.test.ts   # Pledge creation + token locking
│       │   └── relay-connection.test.ts     # Relay pool connection handling
│       │
│       └── e2e/
│           ├── task-lifecycle.spec.ts     # Full create → fund → solve → payout
│           ├── search.spec.ts               # Search and discovery flow
│           └── auth.spec.ts                 # NIP-07 login/logout
│
├── static/
│   ├── favicon.ico
│   ├── logo.svg                      # Bounty.ninja logo
│   └── og-image.png                  # Open Graph social preview image
│
└── build/                            # Static output (gitignored)
```

---

## 6. Data Models — Nostr Event Kinds

All task-related events use custom Nostr event kinds. These interfaces define
the **parsed** representation after extracting data from raw Nostr event tags.
The raw events follow standard Nostr structure
(`{ id, pubkey, created_at, kind, tags, content, sig }`).

### 6.1 Event Kind Constants

```typescript
// src/lib/bounty/kinds.ts

/** Task definition — Parameterized Replaceable Event (NIP-33) */
export const BOUNTY_KIND = 37300;

/** Solution submission */
export const SOLUTION_KIND = 73001;

/** Pledge (funding contribution) */
export const PLEDGE_KIND = 73002;

/** Consensus vote */
export const VOTE_KIND = 1018;

/** Payout record */
export const PAYOUT_KIND = 73004;
```

### 6.2 Task Event (Kind 37300)

A **Parameterized Replaceable Event** (NIP-33). The task creator can update it
by publishing a new event with the same `d` tag. The `d` tag serves as the
unique identifier within the creator's pubkey namespace.

```typescript
// src/lib/bounty/types.ts

import type { NostrEvent } from "nostr-tools";

/**
 * Task lifecycle states, derived from the presence/absence of
 * related events (pledges, solutions, votes, payouts).
 */
export type TaskStatus =
  | "draft" // Published but no pledges yet
  | "open" // Has at least one pledge, accepting solutions
  | "in_review" // Has at least one solution, voting in progress
  | "completed" // Payout event (Kind 73004) exists
  | "expired" // Past deadline with no payout
  | "cancelled"; // Creator published a delete (Kind 5) or status tag update

/**
 * Parsed representation of a Kind 37300 task event.
 * Raw Nostr event tags are extracted into typed fields.
 */
export interface Task {
  /** Raw Nostr event (for signature verification, relay publishing, etc.) */
  event: NostrEvent;

  /** Unique identifier: `${pubkey}:${kind}:${dTag}` (NIP-33 address) */
  id: string;

  /** The `d` tag value — unique per-pubkey task identifier */
  dTag: string;

  /** Task creator's pubkey (hex) */
  pubkey: string;

  /** Task title — extracted from first `title` or `subject` tag, fallback to first line of content */
  title: string;

  /** Task description — the `content` field, expected to be markdown */
  description: string;

  /** Reward amount in sats — extracted from `reward` tag: ["reward", "<amount>", "sat"] */
  rewardAmount: number;

  /** Reward currency — always "sat" for MVP */
  rewardCurrency: "sat";

  /** Category tags — extracted from `t` tags: ["t", "development"], ["t", "design"], etc. */
  tags: string[];

  /** Deadline as Unix timestamp — extracted from `expiration` tag (NIP-40), or null if no deadline */
  deadline: number | null;

  /** Current derived status (not stored on-chain, computed from related events) */
  status: TaskStatus;

  /** Total pledged sats (sum of all Kind 73002 events referencing this task) */
  totalPledged: number;

  /** Number of solutions submitted */
  solutionCount: number;

  /** Event created_at timestamp */
  createdAt: number;

  /** Preferred Cashu mint URL — extracted from `mint` tag, or null for any mint */
  mintUrl: string | null;

  /** Anti-spam submission fee in sats — extracted from `fee` tag: ["fee", "<amount>"] */
  submissionFee: number;
}

/**
 * Raw Nostr event structure for Kind 37300.
 *
 * Tags:
 *   ["d", "<unique-task-id>"]                    — REQUIRED, NIP-33 identifier
 *   ["title", "<task title>"]                     — REQUIRED
 *   ["reward", "<amount>", "sat"]                   — REQUIRED, target reward
 *   ["t", "<tag>"]                                  — OPTIONAL, repeatable, category tags
 *   ["expiration", "<unix-timestamp>"]              — OPTIONAL, NIP-40 deadline
 *   ["mint", "<cashu-mint-url>"]                    — OPTIONAL, preferred mint
 *   ["fee", "<sats>"]                               — OPTIONAL, anti-spam submission fee
 *   ["client", "bounty.ninja"]                         — RECOMMENDED, app identifier
 *
 * Content: Markdown description of the task requirements.
 */
```

### 6.3 Pledge Event (Kind 73002)

```typescript
/**
 * Parsed representation of a Kind 73002 pledge event.
 * A funder locks Cashu tokens to the task using P2PK (NUT-11).
 */
export interface Pledge {
  /** Raw Nostr event */
  event: NostrEvent;

  /** Event ID */
  id: string;

  /** Funder's pubkey (hex) */
  pubkey: string;

  /** Reference to the task — extracted from `a` tag: ["a", "37300:<pubkey>:<d-tag>"] */
  taskAddress: string;

  /** Pledged amount in sats — extracted from `amount` tag: ["amount", "<sats>"] */
  amount: number;

  /** Cashu token (serialized) — extracted from `cashu` tag: ["cashu", "<token>"] */
  cashuToken: string;

  /** The Cashu mint URL the token was minted from */
  mintUrl: string;

  /** Event created_at timestamp */
  createdAt: number;

  /** Optional message from the funder */
  message: string;
}

/**
 * Raw Nostr event structure for Kind 73002.
 *
 * Tags:
 *   ["a", "37300:<task-creator-pubkey>:<d-tag>", "<relay-hint>"]  — REQUIRED, task reference
 *   ["p", "<task-creator-pubkey>"]                                 — REQUIRED, for notifications
 *   ["amount", "<sats>"]                                             — REQUIRED, pledge amount
 *   ["cashu", "<serialized-cashu-token>"]                            — REQUIRED, P2PK-locked token
 *   ["mint", "<cashu-mint-url>"]                                     — REQUIRED, token's mint
 *   ["client", "bounty.ninja"]                                          — RECOMMENDED
 *
 * Content: Optional message from the funder (e.g., "Great idea, happy to fund this!")
 *
 * P2PK Locking Strategy (Pledger-Controlled Escrow):
 *   The Cashu token in the `cashu` tag MUST be locked (NUT-11 P2PK) to the
 *   PLEDGER's own public key. This ensures the pledger retains custody of
 *   their funds throughout the bounty lifecycle — no other party can spend
 *   the tokens without the pledger's cooperation.
 *
 *   Lock target: The pledger's own pubkey (self-custody).
 *   Locktime: The bounty deadline (NIP-40 expiration timestamp).
 *   Refund: After locktime expires, tokens remain spendable by the pledger
 *           (they already own the key). The locktime ensures tokens cannot
 *           be released to a solver after the deadline passes without the
 *           pledger's active participation.
 *
 *   Payout flow (after 66% vote consensus):
 *     1. Each pledger is prompted to release their funds by signing a swap
 *        that creates new P2PK-locked tokens for the winning solver.
 *     2. Pledgers who don't release within a grace period retain their funds
 *        (the solver receives only the released portions).
 *     3. Reputation consequences apply to pledgers who don't release after
 *        consensus.
 *
 *   This model prevents rug-pulls: the bounty creator NEVER controls pledge
 *   funds. The trade-off is that payout requires active pledger participation,
 *   mitigated by reputation scoring and social coordination.
 */
```

### 6.4 Solution Event (Kind 73001)

```typescript
/**
 * Parsed representation of a Kind 73001 solution submission.
 */
export interface Solution {
  /** Raw Nostr event */
  event: NostrEvent;

  /** Event ID */
  id: string;

  /** Solver's pubkey (hex) */
  pubkey: string;

  /** Reference to the task */
  taskAddress: string;

  /** Solution description / proof of work — from `content` field (markdown) */
  description: string;

  /** Anti-spam fee token — extracted from `cashu` tag */
  antiSpamToken: string;

  /** Anti-spam fee amount in sats */
  antiSpamAmount: number;

  /** Optional external link to deliverable (e.g., PR URL, file link) */
  deliverableUrl: string | null;

  /** Event created_at timestamp */
  createdAt: number;

  /** Derived: net vote weight (sum of weighted votes) */
  voteWeight: number;
}

/**
 * Raw Nostr event structure for Kind 73001.
 *
 * Tags:
 *   ["a", "37300:<task-creator-pubkey>:<d-tag>", "<relay-hint>"]  — REQUIRED, task reference
 *   ["p", "<task-creator-pubkey>"]                                 — REQUIRED, for notifications
 *   ["cashu", "<serialized-cashu-token>"]                            — REQUIRED, anti-spam fee
 *   ["r", "<url>"]                                                   — OPTIONAL, deliverable URL
 *   ["client", "bounty.ninja"]                                          — RECOMMENDED
 *
 * Content: Markdown description of the solution with proof of work.
 *
 * Anti-Spam Fee:
 *   The `cashu` tag MUST contain a valid Cashu token worth between
 *   PUBLIC_MIN_SUBMISSION_FEE and PUBLIC_MAX_SUBMISSION_FEE sats.
 *   This token is NOT P2PK-locked — it is immediately claimable by the
 *   task creator as compensation for reviewing submissions.
 *   The fee is non-refundable regardless of vote outcome.
 */
```

### 6.5 Vote Event (Kind 1018)

```typescript
/**
 * Parsed representation of a Kind 1018 consensus vote.
 * Only pubkeys that have pledged (Kind 73002) to this task may vote.
 * Vote weight is proportional to the voter's pledge amount (linear weighting).
 */
export interface Vote {
  /** Raw Nostr event */
  event: NostrEvent;

  /** Event ID */
  id: string;

  /** Voter's pubkey (hex) — MUST match a pledge pubkey for this task */
  pubkey: string;

  /** Reference to the task */
  taskAddress: string;

  /** Reference to the solution being voted on — extracted from `e` tag */
  solutionId: string;

  /** Vote choice */
  choice: "approve" | "reject";

  /** Derived: voter's pledge amount (looked up from Kind 73002 events) */
  pledgeAmount: number;

  /** Derived: vote weight = pledgeAmount (linear) */
  weight: number;

  /** Event created_at timestamp */
  createdAt: number;
}

/**
 * Raw Nostr event structure for Kind 1018.
 *
 * Tags:
 *   ["a", "37300:<task-creator-pubkey>:<d-tag>", "<relay-hint>"]  — REQUIRED, task reference
 *   ["e", "<solution-event-id>", "<relay-hint>"]                     — REQUIRED, solution reference
 *   ["p", "<solution-author-pubkey>"]                                — REQUIRED, for notifications
 *   ["vote", "approve" | "reject"]                                   — REQUIRED, vote choice
 *   ["client", "bounty.ninja"]                                          — RECOMMENDED
 *
 * Content: Optional comment explaining the vote.
 *
 * Voting Rules:
 *   - Only pubkeys with at least one Kind 73002 pledge for this task may vote.
 *   - Vote weight = pledgeAmountInSats (linear — 1 sat = 1 vote weight).
 *   - Each pubkey may vote once per solution. Latest event wins (replaceable by pubkey+solution).
 *   - A solution is "approved" when total approve weight > total reject weight
 *     AND total approve weight >= totalPledgedSats * QUORUM_FRACTION (default 0.66).
 *   - The quorum threshold is configurable via PUBLIC_VOTE_QUORUM_PERCENT env var
 *     (default 66%). Supermajority reduces risk of contentious payouts.
 *   - The vote serves as a coordination signal: when 66% consensus is reached,
 *     all pledgers are prompted to release their funds to the winning solver.
 */
```

### 6.6 Payout Event (Kind 73004)

```typescript
/**
 * Parsed representation of a Kind 73004 payout record.
 * Published by the task creator after consensus is reached.
 * Contains the unlocked Cashu tokens for the winning solver.
 */
export interface Payout {
  /** Raw Nostr event */
  event: NostrEvent;

  /** Event ID */
  id: string;

  /** Task creator's pubkey (hex) — the one who orchestrates payout */
  pubkey: string;

  /** Reference to the task */
  taskAddress: string;

  /** Reference to the winning solution */
  solutionId: string;

  /** Solver's pubkey (recipient) */
  solverPubkey: string;

  /** Payout amount in sats */
  amount: number;

  /** Cashu token(s) for the solver — P2PK-locked to solver's pubkey */
  cashuToken: string;

  /** Event created_at timestamp */
  createdAt: number;
}

/**
 * Raw Nostr event structure for Kind 73004.
 *
 * Tags:
 *   ["a", "37300:<task-creator-pubkey>:<d-tag>", "<relay-hint>"]  — REQUIRED, task reference
 *   ["e", "<solution-event-id>", "<relay-hint>"]                     — REQUIRED, winning solution
 *   ["p", "<solver-pubkey>"]                                         — REQUIRED, recipient
 *   ["amount", "<sats>"]                                             — REQUIRED, payout amount
 *   ["cashu", "<serialized-cashu-token>"]                            — REQUIRED, P2PK-locked to solver
 *   ["client", "bounty.ninja"]                                          — RECOMMENDED
 *
 * Content: Optional payout note.
 *
 * Payout Process (Pledger-Controlled Release):
 *   1. Vote consensus is reached (66% quorum of pledged sats approve a solution)
 *   2. The app prompts each pledger to release their funds:
 *      a. Pledger signs a swap at the mint using their private key
 *      b. New tokens are created P2PK-locked to the winning solver's pubkey
 *   3. Each pledger publishes their own Kind 73004 payout event for their portion
 *   4. Solver claims tokens from each payout event using their private key
 *   5. Pledgers who don't release within the grace period retain their funds
 *      but receive negative reputation impact
 *
 *   Note: Multiple Kind 73004 events may exist for the same bounty — one per
 *   pledger who releases. The total payout is the sum of all released portions.
 *   The bounty transitions to "completed" when any payout events exist.
 */
```

### 6.7 Aggregate Types

```typescript
/**
 * A fully hydrated task with all related events resolved.
 * Used by the task detail page.
 */
export interface BountyDetail extends Task {
  /** All pledges for this task */
  pledges: Pledge[];

  /** All solutions submitted */
  solutions: Solution[];

  /** All votes, grouped by solution */
  votesBySolution: Map<string, Vote[]>;

  /** Payout event, if exists */
  payout: Payout | null;

  /** Creator's profile (Kind 0) */
  creatorProfile: {
    name: string;
    displayName: string;
    picture: string;
    nip05: string | null;
  } | null;
}

/**
 * Summary for task list cards (lighter than BountyDetail).
 */
export interface BountySummary {
  id: string;
  dTag: string;
  pubkey: string;
  title: string;
  tags: string[];
  rewardAmount: number;
  totalPledged: number;
  solutionCount: number;
  status: TaskStatus;
  createdAt: number;
  deadline: number | null;
}
```

---

## 7. State Management Architecture

### 7.1 Data Flow Overview

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐     ┌──────────────┐
│ Nostr Relays │────▶│ applesauce-relay  │────▶│ applesauce-core │────▶│ Svelte 5     │
│ (WebSocket)  │     │ RelayPool         │     │ EventStore      │     │ Runes        │
│              │◀────│ (RxJS Observable) │     │ (in-memory DB)  │     │ ($state,     │
│              │     └──────────────────┘     │                 │     │  $derived)   │
│              │              │                │                 │     │              │
│              │              ▼                │                 │     │              │
│              │     ┌──────────────────┐     │                 │     │              │
│              │     │ nostr-idb        │     │                 │     │              │
│              │     │ (IndexedDB cache)│◀───▶│                 │     │              │
│              │     └──────────────────┘     └─────────────────┘     └──────────────┘
│              │                                       │                      │
│              │                                       ▼                      ▼
│              │                              ┌─────────────────┐    ┌──────────────┐
│              │◀─────────────────────────────│ applesauce-     │    │ Svelte 5     │
│              │     (publish signed events)  │ actions          │◀───│ Components   │
│              │                              │ EventFactory     │    │ (user input) │
└─────────────┘                              └─────────────────┘    └──────────────┘
```

### 7.2 Singleton Initialization

```typescript
// src/lib/nostr/event-store.ts
import { EventStore } from "applesauce-core";

/** Global singleton — one EventStore for the entire app */
export const eventStore = new EventStore();
```

```typescript
// src/lib/nostr/relay-pool.ts
import { RelayPool } from "applesauce-relay";
import { env } from "$env/dynamic/public";

const defaultRelays = (env.PUBLIC_DEFAULT_RELAYS ?? "").split(",").filter(
  Boolean,
);

/** Global singleton — one RelayPool for the entire app */
export const pool = new RelayPool();

/** Initialize connections to default relays */
export function connectDefaultRelays(): void {
  for (const url of defaultRelays) {
    pool.relay(url);
  }
}
```

### 7.3 Bridging RxJS Observables to Svelte 5 Runes

Applesauce uses RxJS Observables. Svelte 5 uses runes. The bridge pattern:

```typescript
// src/lib/stores/bounties.svelte.ts
import { eventStore } from "$lib/nostr/event-store";
import { BOUNTY_KIND } from "$lib/bounty/kinds";
import type { BountySummary } from "$lib/bounty/types";
import { parseBountySummary } from "$lib/bounty/helpers";

class TaskListStore {
  #items = $state<BountySummary[]>([]);
  #loading = $state(true);
  #error = $state<string | null>(null);

  constructor() {
    // Subscribe to EventStore timeline for Kind 37300
    const sub = eventStore.timeline({ kinds: [BOUNTY_KIND] });

    sub.subscribe({
      next: (events) => {
        this.#items = events.map(parseBountySummary);
        this.#loading = false;
      },
      error: (err) => {
        this.#error = err.message;
        this.#loading = false;
      },
    });
  }

  get items() {
    return this.#items;
  }
  get loading() {
    return this.#loading;
  }
  get error() {
    return this.#error;
  }

  /** Sorted by total pledged (descending) for "Popular Tasks" */
  get popular() {
    return $derived(
      [...this.#items].sort((a, b) => b.totalPledged - a.totalPledged),
    );
  }
}

export const taskList = new TaskListStore();
```

### 7.4 Event Publishing Flow

```
User Action (e.g., "Create Task")
  │
  ▼
Component calls action function
  │
  ▼
Action builds event using EventFactory + Blueprint
  │
  ▼
EventFactory signs via NIP-07 signer (applesauce-signers)
  │
  ▼
Signed event published to RelayPool
  │
  ▼
RelayPool broadcasts to all connected relays
  │
  ▼
Relay confirms (OK message)
  │
  ▼
Event also added to local EventStore (optimistic update)
  │
  ▼
Svelte rune state updates → UI re-renders
```

---

## 8. Route Map

| Route             | File                                     | Description                                                                                                                                                              | Auth Required             |
| ----------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------- |
| `/`               | `src/routes/+page.svelte`                | **Home page.** Popular tasks ranked by total pledged sats. Search bar (NIP-50). Category filter tabs.                                                                    | No                        |
| `/bounty/new`     | `src/routes/bounty/new/+page.svelte`     | **Create task.** Form: title, description (markdown), reward target, tags, deadline, mint preference, submission fee. Publishes Kind 37300.                              | Yes (NIP-07)              |
| `/bounty/[naddr]` | `src/routes/bounty/[naddr]/+page.svelte` | **Task detail.** Full description, pledge list, solution list, vote progress. Actions: pledge, submit solution, vote. `naddr` is a NIP-19 encoded address (`naddr1...`). | No (view), Yes (interact) |
| `/profile/[npub]` | `src/routes/profile/[npub]/+page.svelte` | **User profile.** Tasks created, solutions submitted, pledges made, reputation score. `npub` is NIP-19 encoded pubkey.                                                   | No                        |
| `/search`         | `src/routes/search/+page.svelte`         | **Search results.** NIP-50 full-text search across tasks. Filters: status (open/completed), min reward, tags.                                                            | No                        |
| `/settings`       | `src/routes/settings/+page.svelte`       | **User settings.** Manage relay list, preferred Cashu mint, theme (dark/light), notification preferences.                                                                | Yes (NIP-07)              |

### Route Load Functions

All `+page.ts` load functions are client-side only (no SSR). They:

1. Parse route params (decode `naddr`/`npub` using `nostr-tools`)
2. Initiate Applesauce loader subscriptions
3. Return reactive references for the page component to consume

```typescript
// src/routes/bounty/[naddr]/+page.ts
import type { PageLoad } from "./$types";
import { nip19 } from "nostr-tools";
import { error } from "@sveltejs/kit";

export const ssr = false;
export const prerender = false;

export const load: PageLoad = ({ params }) => {
  try {
    const decoded = nip19.decode(params.naddr);
    if (decoded.type !== "naddr") {
      throw error(400, "Invalid task address");
    }
    return {
      taskAddress:
        `${decoded.data.kind}:${decoded.data.pubkey}:${decoded.data.identifier}`,
      kind: decoded.data.kind,
      pubkey: decoded.data.pubkey,
      dTag: decoded.data.identifier,
      relays: decoded.data.relays ?? [],
    };
  } catch (e) {
    throw error(404, "Task not found");
  }
};
```

---

## 9. Component Hierarchy

```
+layout.svelte
├── Header.svelte
│   ├── Logo (link to /)
│   ├── SearchBar.svelte
│   ├── LoginButton.svelte (when logged out)
│   └── ProfileMenu.svelte (when logged in)
│       └── ProfileAvatar.svelte
│
├── <slot /> (page content)
│   │
│   ├── [Home Page] +page.svelte
│   │   ├── SearchBar.svelte (hero variant)
│   │   ├── Category tabs (tag filter)
│   │   └── BountyCard.svelte (repeated)
│   │       ├── BountyStatusBadge.svelte
│   │       ├── BountyTags.svelte
│   │       ├── SatAmount.svelte
│   │       └── TimeAgo.svelte
│   │
│   ├── [Task Detail] task/[naddr]/+page.svelte
│   │   ├── BountyDetail.svelte
│   │   │   ├── BountyStatusBadge.svelte
│   │   │   ├── Markdown.svelte (description)
│   │   │   ├── BountyTags.svelte
│   │   │   ├── BountyTimer.svelte
│   │   │   └── SatAmount.svelte (total pledged)
│   │   │
│   │   ├── PledgeButton.svelte → opens PledgeForm.svelte (dialog)
│   │   ├── PledgeList.svelte
│   │   │   └── PledgeItem.svelte (repeated)
│   │   │
│   │   ├── SolutionForm.svelte (if logged in + task is open)
│   │   ├── SolutionList.svelte
│   │   │   └── SolutionItem.svelte (repeated)
│   │   │       ├── VoteButton.svelte
│   │   │       └── VoteProgress.svelte
│   │   │
│   │   └── VoteResults.svelte (if voting complete)
│   │
│   ├── [Create Task] task/new/+page.svelte
│   │   └── BountyForm.svelte
│   │       └── TagAutoSuggest.svelte (taxonomy + community autocomplete)
│   │
│   ├── [Profile] profile/[npub]/+page.svelte
│   │   ├── ProfileAvatar.svelte
│   │   ├── BountyCard.svelte (repeated — user's tasks)
│   │   └── SolutionItem.svelte (repeated — user's solutions)
│   │
│   ├── [Search] search/+page.svelte
│   │   ├── SearchBar.svelte
│   │   ├── Filter controls
│   │   └── SearchResults.svelte
│   │       └── BountyCard.svelte (repeated)
│   │
│   └── [Settings] settings/+page.svelte
│       ├── Relay list manager
│       ├── Mint selector
│       └── Theme toggle
│
├── Footer.svelte
│   └── RelayStatus.svelte
│
└── Toaster.svelte (global toast notifications)
```

---

## 10. Functional Requirements & Product Logic

### 10.1 Task Lifecycle State Machine

```
                    ┌──────────┐
                    │  DRAFT   │ (Kind 37300 published, 0 pledges)
                    └────┬─────┘
                         │ First Kind 73002 pledge received
                         ▼
                    ┌──────────┐
                    │   OPEN   │ (≥1 pledge, accepting solutions)
                    └────┬─────┘
                         │ First Kind 73001 solution received
                         ▼
                    ┌──────────┐
                    │IN_REVIEW │ (≥1 solution, voting active)
                    └────┬─────┘
                         │ Consensus reached + Kind 73004 published
                         ▼
                    ┌──────────┐
                    │COMPLETED │ (Payout issued)
                    └──────────┘

  Side transitions:
    Any state ──[deadline passed, no payout]──▶ EXPIRED
    Any state ──[creator publishes Kind 5 delete]──▶ CANCELLED
```

```typescript
// src/lib/bounty/state-machine.ts
import type { TaskStatus } from "./types";
import type { NostrEvent } from "nostr-tools";
import { PAYOUT_KIND, PLEDGE_KIND, SOLUTION_KIND } from "./kinds";

export function deriveBountyStatus(
  taskEvent: NostrEvent,
  pledges: NostrEvent[],
  solutions: NostrEvent[],
  payouts: NostrEvent[],
  deleteEvents: NostrEvent[],
  now: number = Math.floor(Date.now() / 1000),
): TaskStatus {
  // Check for cancellation (Kind 5 delete referencing this task)
  if (deleteEvents.length > 0) return "cancelled";

  // Check for completion
  if (payouts.length > 0) return "completed";

  // Check for expiration
  const expirationTag = taskEvent.tags.find((t) => t[0] === "expiration");
  if (expirationTag) {
    const deadline = parseInt(expirationTag[1], 10);
    if (!isNaN(deadline) && now > deadline) return "expired";
  }

  // Check for in_review
  if (solutions.length > 0) return "in_review";

  // Check for open
  if (pledges.length > 0) return "open";

  return "draft";
}
```

### 10.2 Linear Weighted Voting

Linear voting weights each funder's vote proportionally to their pledge amount
(1 sat pledged = 1 unit of vote weight). This was chosen over square-root
weighting because sub-linear functions (like √x) are vulnerable to Sybil
attacks: an attacker can multiply their voting power by splitting the same
capital across many pseudonymous Nostr identities (since `√a + √b > √(a+b)`).
With linear weighting, splitting provides zero mathematical advantage — total
weight is identical regardless of how many identities the funds are spread
across. The pledge itself (locking real Cashu tokens) serves as proof of stake.

```typescript
// src/lib/bounty/voting.ts

export interface VoteTally {
  /** Total approve weight (sum of each approver's pledge amount) */
  approveWeight: number;
  /** Total reject weight */
  rejectWeight: number;
  /** Quorum threshold: totalPledgedSats * 0.5 */
  quorum: number;
  /** Whether quorum is met and approve > reject */
  isApproved: boolean;
  /** Whether quorum is met and reject > approve */
  isRejected: boolean;
  /** Percentage of quorum reached (0-100+) */
  quorumPercent: number;
}

/**
 * Calculate vote weight for a single voter.
 * Uses linear weighting (1 sat = 1 vote weight) to prevent Sybil attacks.
 * Sub-linear functions like square root are vulnerable to identity splitting.
 *
 * @param pledgeAmountSats - Total sats pledged by this voter
 * @returns Vote weight (equal to pledge amount)
 */
export function calculateVoteWeight(pledgeAmountSats: number): number {
  if (pledgeAmountSats <= 0) return 0;
  return pledgeAmountSats;
}

/**
 * Tally votes for a specific solution.
 *
 * @param votes - All votes for this solution
 * @param pledgesByPubkey - Map of pubkey → total pledge amount for this task
 * @param totalPledgedSats - Total sats pledged to the task
 */
export function tallyVotes(
  votes: Array<{ pubkey: string; choice: "approve" | "reject" }>,
  pledgesByPubkey: Map<string, number>,
  totalPledgedSats: number,
): VoteTally {
  let approveWeight = 0;
  let rejectWeight = 0;

  // Deduplicate: latest vote per pubkey wins
  const latestVoteByPubkey = new Map<string, "approve" | "reject">();
  for (const vote of votes) {
    // Only count votes from actual pledgers
    if (pledgesByPubkey.has(vote.pubkey)) {
      latestVoteByPubkey.set(vote.pubkey, vote.choice);
    }
  }

  for (const [pubkey, choice] of latestVoteByPubkey) {
    const pledgeAmount = pledgesByPubkey.get(pubkey) ?? 0;
    const weight = calculateVoteWeight(pledgeAmount);
    if (choice === "approve") {
      approveWeight += weight;
    } else {
      rejectWeight += weight;
    }
  }

  const quorum = totalPledgedSats * 0.66; // Configurable via PUBLIC_VOTE_QUORUM_PERCENT
  const quorumPercent = quorum > 0
    ? (Math.max(approveWeight, rejectWeight) / quorum) * 100
    : 0;

  return {
    approveWeight,
    rejectWeight,
    quorum,
    isApproved: approveWeight > rejectWeight && approveWeight >= quorum,
    isRejected: rejectWeight > approveWeight && rejectWeight >= quorum,
    quorumPercent,
  };
}
```

### 10.3 Search and Discovery

The home page features **"Popular Tasks"** ranked by total pot size (sum of sats
in Kind 73002 events). Users can search for both **Open** (no Kind 73004 payout
yet) and **Completed** tasks using NIP-50 search filters on compatible relays.

```typescript
// src/lib/bounty/filters.ts
import {
  BOUNTY_KIND,
  PAYOUT_KIND,
  PLEDGE_KIND,
  SOLUTION_KIND,
  VOTE_KIND,
} from "./kinds";
import type { Filter } from "nostr-tools";

/** Fetch all open tasks (most recent first) */
export function taskListFilter(limit = 50): Filter {
  return { kinds: [BOUNTY_KIND], limit };
}

/** Fetch all pledges for a specific task */
export function pledgesForTaskFilter(taskAddress: string): Filter {
  return {
    kinds: [PLEDGE_KIND],
    "#a": [taskAddress],
  };
}

/** Fetch all solutions for a specific task */
export function solutionsForTaskFilter(taskAddress: string): Filter {
  return {
    kinds: [SOLUTION_KIND],
    "#a": [taskAddress],
  };
}

/** Fetch all votes for a specific task */
export function votesForTaskFilter(taskAddress: string): Filter {
  return {
    kinds: [VOTE_KIND],
    "#a": [taskAddress],
  };
}

/** Fetch payout for a specific task */
export function payoutForTaskFilter(taskAddress: string): Filter {
  return {
    kinds: [PAYOUT_KIND],
    "#a": [taskAddress],
  };
}

/** NIP-50 search filter */
export function searchTasksFilter(query: string, limit = 20): Filter {
  return {
    kinds: [BOUNTY_KIND],
    search: query,
    limit,
  };
}

/** Fetch all tasks by a specific pubkey */
export function taskByAuthorFilter(pubkey: string): Filter {
  return {
    kinds: [BOUNTY_KIND],
    authors: [pubkey],
  };
}
```

### 10.4 Auto-Tag Taxonomy

Bounties on Bounty.ninja span far beyond software — from "Build a REST API" to
"Build a park in Salt Lake City" to "Get 100,000 signatures for this petition."
To keep discovery useful without burdening creators, the app auto-suggests tags
by scanning the bounty title and description against a curated keyword taxonomy.

#### 10.4.1 Design Principles

- **Zero friction.** Tags are suggested automatically as soon as the user
  finishes typing a title or blurs the description field. No extra clicks
  required — suggestions appear inline and the user accepts, dismisses, or
  edits.
- **Client-side only.** The entire taxonomy ships as a static TypeScript module
  (~2-4 KB). No API calls, no network dependency, no privacy concerns.
- **Broad coverage.** The taxonomy covers technical, creative, civic, physical,
  legal, financial, and activist bounties — not just software.
- **Community layering.** In addition to taxonomy matches, the input
  autocompletes against tags already used by other bounties in the local
  EventStore, ranked by frequency. This lets the community organically extend
  the taxonomy.
- **User sovereignty.** Auto-suggested tags are _suggestions_, never
  auto-applied. The creator always has final say over which tags are published.

#### 10.4.2 Taxonomy Structure

Each category maps a canonical tag name to an array of regex patterns. Patterns
are tested against the lowercase concatenation of `title + " " + description`.
When a pattern matches, the canonical tag is suggested. A bounty may match
multiple categories.

```typescript
// src/lib/bounty/taxonomy.ts

export interface TaxonomyEntry {
  /** Canonical tag name (lowercase, what gets stored in the ['t', '...'] tag) */
  tag: string;
  /** Human-readable label for display in the suggestion UI */
  label: string;
  /** Keyword patterns to match against title + description */
  patterns: RegExp[];
}

export const TAXONOMY: TaxonomyEntry[] = [
  // ── Software & Engineering ──────────────────────────────────────────
  {
    tag: "bitcoin",
    label: "Bitcoin",
    patterns: [
      /\b(bitcoin|btc|lightning|ln|lnurl|bolt11|onchain|utxo|mempool)\b/i,
    ],
  },
  {
    tag: "nostr",
    label: "Nostr",
    patterns: [
      /\b(nostr|nip-?\d+|relay|nsec|npub|naddr|nevent|nprofile|zap)\b/i,
    ],
  },
  {
    tag: "cashu",
    label: "Cashu",
    patterns: [/\b(cashu|ecash|e-?cash|nut-?\d+|mint\s+url|cashu\s*token)\b/i],
  },
  {
    tag: "frontend",
    label: "Frontend",
    patterns: [
      /\b(frontend|front-end|react|svelte|vue|angular|next\.?js|nuxt|css|html|tailwind|ui\s+component|responsive|dom)\b/i,
    ],
  },
  {
    tag: "backend",
    label: "Backend",
    patterns: [
      /\b(backend|back-end|server|api|rest\s*api|graphql|grpc|microservice|endpoint|webhook|middleware)\b/i,
    ],
  },
  {
    tag: "mobile",
    label: "Mobile",
    patterns: [
      /\b(mobile|ios|android|react\s*native|flutter|swift|kotlin|app\s+store|play\s+store)\b/i,
    ],
  },
  {
    tag: "rust",
    label: "Rust",
    patterns: [/\b(rust|cargo|crate|rustc|tokio|wasm-?\s*pack)\b/i],
  },
  {
    tag: "python",
    label: "Python",
    patterns: [
      /\b(python|pip|django|flask|fastapi|pytorch|pandas|numpy|jupyter)\b/i,
    ],
  },
  {
    tag: "javascript",
    label: "JavaScript",
    patterns: [
      /\b(javascript|typescript|node\.?js|deno|bun|npm|yarn|pnpm|express|vite|webpack)\b/i,
    ],
  },
  {
    tag: "golang",
    label: "Go",
    patterns: [/\b(golang|go\s+module|goroutine|gin\s+framework)\b/i],
  },
  {
    tag: "devops",
    label: "DevOps",
    patterns: [
      /\b(devops|ci\/?cd|docker|kubernetes|k8s|terraform|ansible|jenkins|github\s+actions|deploy|pipeline|infrastructure)\b/i,
    ],
  },
  {
    tag: "security",
    label: "Security",
    patterns: [
      /\b(security|vulnerability|pentest|pen-?test|audit|cve|exploit|encryption|authentication|authorization|oauth|jwt|firewall|hardening)\b/i,
    ],
  },
  {
    tag: "database",
    label: "Database",
    patterns: [
      /\b(database|sql|postgres|mysql|sqlite|mongodb|redis|cassandra|schema|migration|query\s+optimization)\b/i,
    ],
  },
  {
    tag: "ai",
    label: "AI / ML",
    patterns: [
      /\b(ai|artificial\s+intelligence|machine\s+learning|deep\s+learning|llm|gpt|neural\s+net|model\s+training|fine-?\s*tun|prompt\s+engineer|nlp|computer\s+vision)\b/i,
    ],
  },
  {
    tag: "data",
    label: "Data",
    patterns: [
      /\b(data\s+(?:analysis|science|engineer|pipeline|warehouse|lake|visualization)|etl|analytics|scraping|web\s+scraper|dataset)\b/i,
    ],
  },
  {
    tag: "blockchain",
    label: "Blockchain",
    patterns: [
      /\b(blockchain|smart\s+contract|solidity|ethereum|defi|dao|nft|token|web3|dapp)\b/i,
    ],
  },
  {
    tag: "networking",
    label: "Networking",
    patterns: [
      /\b(networking|tcp|udp|dns|http|websocket|vpn|tor|p2p|peer-to-peer|protocol|mesh\s+network)\b/i,
    ],
  },
  {
    tag: "embedded",
    label: "Embedded",
    patterns: [
      /\b(embedded|firmware|microcontroller|arduino|raspberry\s+pi|esp32|iot|rtos|fpga|pcb)\b/i,
    ],
  },
  {
    tag: "open-source",
    label: "Open Source",
    patterns: [
      /\b(open[\s-]?source|foss|libre|gpl|mit\s+license|apache\s+license|contribute|contributor|maintainer)\b/i,
    ],
  },
  {
    tag: "testing",
    label: "Testing",
    patterns: [
      /\b(testing|unit\s+test|integration\s+test|e2e|end-to-end|qa|quality\s+assurance|test\s+suite|coverage|regression)\b/i,
    ],
  },
  {
    tag: "bug",
    label: "Bug Fix",
    patterns: [
      /\b(bug|fix|patch|issue|broken|crash|regression|debug|troubleshoot)\b/i,
    ],
  },

  // ── Design & Creative ──────────────────────────────────────────────
  {
    tag: "design",
    label: "Design",
    patterns: [
      /\b(design|ui\/?ux|user\s+interface|user\s+experience|wireframe|mockup|prototype|figma|sketch|adobe\s+xd|interaction\s+design)\b/i,
    ],
  },
  {
    tag: "branding",
    label: "Branding",
    patterns: [
      /\b(brand|logo|visual\s+identity|style\s+guide|brand\s+kit|rebrand|color\s+palette|typography)\b/i,
    ],
  },
  {
    tag: "illustration",
    label: "Illustration",
    patterns: [
      /\b(illustrat|drawing|artwork|sketch|comic|character\s+design|icon\s+set|infographic|vector\s+art)\b/i,
    ],
  },
  {
    tag: "video",
    label: "Video",
    patterns: [
      /\b(video|film|animation|motion\s+graphics|editing|vfx|youtube|documentary|cinematic|footage|timelapse)\b/i,
    ],
  },
  {
    tag: "audio",
    label: "Audio",
    patterns: [
      /\b(audio|music|sound|podcast|recording|mixing|mastering|jingle|soundtrack|voiceover|narration)\b/i,
    ],
  },
  {
    tag: "photography",
    label: "Photography",
    patterns: [
      /\b(photo|photograph|portrait|headshot|product\s+photo|aerial\s+photo|drone\s+photo|lightroom)\b/i,
    ],
  },
  {
    tag: "3d",
    label: "3D",
    patterns: [
      /\b(3d|blender|unity|unreal|cad|rendering|3d\s+model|3d\s+print)\b/i,
    ],
  },
  {
    tag: "game",
    label: "Game Dev",
    patterns: [
      /\b(game|gamedev|game\s+design|game\s+engine|unity|unreal|godot|pixel\s+art|level\s+design)\b/i,
    ],
  },

  // ── Content & Writing ──────────────────────────────────────────────
  {
    tag: "writing",
    label: "Writing",
    patterns: [
      /\b(writing|write|article|blog\s+post|copywriting|content\s+creation|ghostwrit|editorial|essay|ebook)\b/i,
    ],
  },
  {
    tag: "documentation",
    label: "Documentation",
    patterns: [
      /\b(documentation|docs|readme|wiki|technical\s+writ|api\s+doc|user\s+guide|tutorial|how-?\s*to)\b/i,
    ],
  },
  {
    tag: "translation",
    label: "Translation",
    patterns: [
      /\b(translat|locali[sz]|i18n|l10n|multilingual|interpret|spanish|french|german|chinese|japanese|portuguese|arabic|hindi|korean)\b/i,
    ],
  },
  {
    tag: "education",
    label: "Education",
    patterns: [
      /\b(education|teach|course|curriculum|lesson|workshop|training|tutor|mentor|bootcamp|lecture|webinar)\b/i,
    ],
  },

  // ── Marketing & Growth ─────────────────────────────────────────────
  {
    tag: "marketing",
    label: "Marketing",
    patterns: [
      /\b(marketing|promotion|campaign|advertising|ad\s+campaign|growth|outreach|awareness|impressions|engagement)\b/i,
    ],
  },
  {
    tag: "social-media",
    label: "Social Media",
    patterns: [
      /\b(social\s+media|twitter|x\.com|instagram|tiktok|youtube|facebook|reddit|discord|telegram|community\s+manag|influencer)\b/i,
    ],
  },
  {
    tag: "seo",
    label: "SEO",
    patterns: [
      /\b(seo|search\s+engine|keyword|backlink|organic\s+traffic|serp|meta\s+tag|sitemap)\b/i,
    ],
  },

  // ── Research & Analysis ────────────────────────────────────────────
  {
    tag: "research",
    label: "Research",
    patterns: [
      /\b(research|study|investigation|analysis|report|whitepaper|white\s+paper|literature\s+review|findings|methodology|peer\s+review)\b/i,
    ],
  },
  {
    tag: "survey",
    label: "Survey",
    patterns: [
      /\b(survey|questionnaire|poll|census|feedback\s+collection|user\s+research|interview|focus\s+group)\b/i,
    ],
  },

  // ── Civic & Community ──────────────────────────────────────────────
  {
    tag: "civic",
    label: "Civic",
    patterns: [
      /\b(civic|city|municipal|public\s+space|urban|town\s+hall|government|zoning|permit|ordinance|public\s+hearing|council|mayor)\b/i,
    ],
  },
  {
    tag: "environment",
    label: "Environment",
    patterns: [
      /\b(environment|climate|sustain|renewable|solar|wind\s+power|recycling|conservation|wildlife|pollution|clean\s+energy|carbon|reforestation|tree\s+plant)\b/i,
    ],
  },
  {
    tag: "activism",
    label: "Activism",
    patterns: [
      /\b(activism|petition|signature|protest|rally|advocacy|campaign|mobiliz|grassroots|civil\s+rights|human\s+rights|justice|reform|movement)\b/i,
    ],
  },
  {
    tag: "nonprofit",
    label: "Nonprofit",
    patterns: [
      /\b(nonprofit|non-?\s*profit|charity|donation|fundrais|volunteer|ngo|501c|humanitarian|relief\s+effort|philanthrop)\b/i,
    ],
  },
  {
    tag: "governance",
    label: "Governance",
    patterns: [
      /\b(governance|policy|regulation|legislation|ballot|election|vote|referendum|democratic|constitution|bylaw)\b/i,
    ],
  },

  // ── Physical & Construction ────────────────────────────────────────
  {
    tag: "construction",
    label: "Construction",
    patterns: [
      /\b(construct|build|building|renovation|remodel|contractor|architect|blueprint|foundation|framing|roofing|plumbing|electrical|hvac)\b/i,
    ],
  },
  {
    tag: "repair",
    label: "Repair",
    patterns: [
      /\b(repair|fix|maintenance|restore|refurbish|replace|broken|damaged|patch|overhaul)\b/i,
    ],
  },
  {
    tag: "landscaping",
    label: "Landscaping",
    patterns: [
      /\b(landscap|garden|lawn|park|playground|trail|path|outdoor\s+space|green\s+space|irrigation|mowing|plant)\b/i,
    ],
  },
  {
    tag: "cleaning",
    label: "Cleaning",
    patterns: [
      /\b(clean|cleanup|clean-?\s*up|trash|litter|debris|sanitation|janitorial|power\s+wash|graffiti\s+removal)\b/i,
    ],
  },
  {
    tag: "delivery",
    label: "Delivery / Logistics",
    patterns: [
      /\b(deliver|courier|shipping|logistics|transport|freight|pickup|drop-?\s*off|moving|hauling)\b/i,
    ],
  },

  // ── Legal & Compliance ─────────────────────────────────────────────
  {
    tag: "legal",
    label: "Legal",
    patterns: [
      /\b(legal|law|attorney|lawyer|contract|compliance|regulation|litigation|intellectual\s+property|trademark|patent|copyright|terms\s+of\s+service|privacy\s+policy)\b/i,
    ],
  },

  // ── Finance & Business ─────────────────────────────────────────────
  {
    tag: "finance",
    label: "Finance",
    patterns: [
      /\b(finance|accounting|bookkeeping|tax|invoice|payroll|budget|financial\s+plan|audit|revenue|profit|loss)\b/i,
    ],
  },
  {
    tag: "business",
    label: "Business",
    patterns: [
      /\b(business\s+plan|startup|entrepreneur|pitch\s+deck|market\s+research|competitive\s+analysis|business\s+model|go-to-market|mvp\s+strategy)\b/i,
    ],
  },

  // ── Events & Organizing ────────────────────────────────────────────
  {
    tag: "event",
    label: "Event",
    patterns: [
      /\b(event|conference|meetup|hackathon|summit|gathering|ceremony|festival|concert|party|show|exhibition|trade\s+show)\b/i,
    ],
  },
  {
    tag: "organizing",
    label: "Organizing",
    patterns: [
      /\b(organiz|coordinat|planning|logistics|scheduling|project\s+manag|task\s+manag|volunteer\s+coordinat)\b/i,
    ],
  },

  // ── Miscellaneous ──────────────────────────────────────────────────
  {
    tag: "bounty",
    label: "Bounty",
    patterns: [
      /\b(bounty|reward|prize|competition|contest|challenge|hackathon)\b/i,
    ],
  },
  {
    tag: "privacy",
    label: "Privacy",
    patterns: [
      /\b(privacy|anonymous|pseudonymous|tor|vpn|encryption|zero[\s-]?knowledge|zk-?\s*proof|sovereign|self[\s-]?custod|censorship[\s-]?resist)\b/i,
    ],
  },
];
```

#### 10.4.3 Matching Algorithm

```typescript
// src/lib/bounty/auto-tagger.ts

import { TAXONOMY, type TaxonomyEntry } from "./taxonomy";

/** Maximum number of auto-suggested tags */
const MAX_SUGGESTIONS = 5;

/**
 * Scan the bounty title and description for taxonomy matches.
 *
 * Returns an ordered array of suggested tag names (most specific matches
 * first). The caller should present these as dismissible chips in the
 * BountyForm UI.
 *
 * @param title - Bounty title text.
 * @param description - Bounty description text (Markdown).
 * @returns Array of canonical tag names, at most MAX_SUGGESTIONS.
 */
export function suggestTags(title: string, description: string): string[] {
  const text = `${title} ${description}`.toLowerCase();
  const matches: Array<{ tag: string; score: number }> = [];

  for (const entry of TAXONOMY) {
    let score = 0;
    for (const pattern of entry.patterns) {
      // Count matches — more matches = higher confidence
      const globalPattern = new RegExp(pattern.source, "gi");
      const hits = text.match(globalPattern);
      if (hits) {
        score += hits.length;
        // Title matches count double — they're more intentional
        const titleHits = title.toLowerCase().match(globalPattern);
        if (titleHits) score += titleHits.length;
      }
    }
    if (score > 0) {
      matches.push({ tag: entry.tag, score });
    }
  }

  // Sort by score (descending), take top N
  matches.sort((a, b) => b.score - a.score);
  return matches.slice(0, MAX_SUGGESTIONS).map((m) => m.tag);
}
```

#### 10.4.4 Community Tag Autocomplete

When the user types into the tag input, the app also queries the local
EventStore for tags already in use across all cached bounties. This provides an
autocomplete list ranked by frequency, supplementing the taxonomy with
community-driven tags that may not be in the curated dictionary.

```typescript
/**
 * Get popular tags from the local EventStore for autocomplete.
 *
 * Scans all cached Kind 37300 events, counts tag frequency, and returns
 * tags matching the given prefix sorted by popularity.
 *
 * @param prefix - User's partial input (e.g., "bit" matches "bitcoin", "bitkey").
 * @param limit - Maximum number of suggestions to return.
 * @returns Array of { tag, count } sorted by count descending.
 */
export function getPopularTags(
  prefix: string,
  limit = 10,
): Array<{ tag: string; count: number }>;
```

#### 10.4.5 BountyForm UX Integration

The auto-tag flow in BountyForm works as follows:

1. **On title blur or description blur:** Call
   `suggestTags(title, description)`. Display results as ghost chips below the
   tag input with a label "Suggested tags". Each chip has an "+" button to
   accept and an "×" to dismiss.
2. **On tag input keystroke:** Query `getPopularTags(prefix)` from the
   EventStore and show a dropdown of matching community tags below the input.
   Selecting a tag from the dropdown adds it to the tag list.
3. **Manual entry still works:** Users can always type arbitrary tags and press
   Enter or comma to add them. The auto-suggest system supplements but never
   replaces manual input.
4. **Deduplication:** If a suggested tag is already in the user's tag list, it
   is not shown again.
5. **Persistence:** Only accepted tags are included in the published event's
   `['t', '...']` tags. Dismissed suggestions are not persisted.

#### 10.4.6 Taxonomy Maintenance

The taxonomy is a static TypeScript file checked into the repository. It should
be reviewed periodically as the bounty ecosystem grows:

- **Adding categories:** When a cluster of bounties consistently uses a tag not
  in the taxonomy, add it. Look at the sidebar's popular tags for candidates.
- **Tuning patterns:** If a category produces false positives (e.g., "build"
  matching `construction` for software bounties), tighten the regex or add
  negative lookaheads.
- **No external dependencies:** The taxonomy must never require a network call,
  API key, or third-party service. It is a pure function of the input text.

#### 10.4.7 Testing Requirements

```typescript
describe("suggestTags", () => {
  it('suggests "bitcoin" for a Lightning Network bounty', () => {
    const tags = suggestTags(
      "Build a Lightning invoice parser",
      "Parse BOLT11 invoices...",
    );
    expect(tags).toContain("bitcoin");
  });

  it('suggests "activism" for a petition bounty', () => {
    const tags = suggestTags(
      "Get 100,000 signatures for this petition",
      "We need to mobilize grassroots support for the reform campaign...",
    );
    expect(tags).toContain("activism");
  });

  it('suggests "construction" and "landscaping" for a park bounty', () => {
    const tags = suggestTags(
      "Build a park for us in Salt Lake City",
      "We want to construct a new green space with playground equipment and walking trails...",
    );
    expect(tags).toContain("construction");
    expect(tags).toContain("landscaping");
  });

  it('suggests "nostr" and "frontend" for a Nostr client bounty', () => {
    const tags = suggestTags(
      "Build a NIP-07 login component for Svelte",
      "Create a reusable Svelte component that handles NIP-07 browser extension signing...",
    );
    expect(tags).toContain("nostr");
    expect(tags).toContain("frontend");
  });

  it("returns at most MAX_SUGGESTIONS tags", () => {
    const tags = suggestTags("...broad text...", "...matches everything...");
    expect(tags.length).toBeLessThanOrEqual(5);
  });

  it("ranks title matches higher than description matches", () => {
    const tags = suggestTags(
      "Rust library for Bitcoin",
      "Please write some code",
    );
    expect(tags[0]).toBe("rust"); // or 'bitcoin' — both are title matches
    expect(tags).toContain("rust");
    expect(tags).toContain("bitcoin");
  });

  it("returns empty array when no patterns match", () => {
    const tags = suggestTags("Hello world", "Just a simple greeting");
    expect(tags).toEqual([]);
  });
});
```

### 10.5 DVM and ContextVM Integration (Post-MVP)

Beyond standard human labor, the board supports:

- **DVM (NIP-90)**: For discrete computational tasks like image generation or
  translation. AI service providers listen for task events tagged with
  DVM-compatible categories and can auto-submit solutions.
- **ContextVM**: Bridging Nostr and Model Context Protocol (MCP). ContextVM
  allows the board to expose tools and resources from MCP servers as
  decentralized services. AI agents can act as "solvers" by listening for task
  requests and utilizing their internal MCP-wrapped capabilities to submit
  results.

> **Note:** DVM/ContextVM integration is out of scope for MVP but the event
> schema is designed to be forward-compatible. Tasks can include a
> `["dvm", "true"]` tag to signal they accept automated solutions.

---

## 11. Relay Protocol Contracts

### 11.1 Relay Subscription Strategy

The app maintains persistent subscriptions for the home feed and opens per-task
subscriptions on demand:

```typescript
// Subscription lifecycle:

// 1. On app load — subscribe to recent tasks
pool
  .relay(relayUrl)
  .subscription({ kinds: [37300], limit: 100 })
  .pipe(onlyEvents())
  .subscribe((event) => eventStore.add(event));

// 2. On task detail page — subscribe to related events
pool
  .relay(relayUrl)
  .subscription([
    { kinds: [73002], "#a": [taskAddress] }, // pledges
    { kinds: [73001], "#a": [taskAddress] }, // solutions
    { kinds: [1018], "#a": [taskAddress] }, // votes
    { kinds: [73004], "#a": [taskAddress] }, // payout
  ])
  .pipe(onlyEvents())
  .subscribe((event) => eventStore.add(event));

// 3. On page leave — unsubscribe (RxJS teardown)
```

### 11.2 Event Publishing

All events are published to the user's configured relay list. The app publishes
to all connected relays simultaneously and considers the publish successful if
at least one relay confirms.

```typescript
// Publishing pattern:
import { EventFactory } from 'applesauce-core';
import { pool } from '$lib/nostr/relay-pool';

const factory = new EventFactory({ signer });

// Create unsigned event from blueprint
const draft = await factory.create(TaskBlueprint, { title, description, ... });

// Sign via NIP-07
const signed = await factory.sign(draft);

// Publish to all connected relays
for (const [url, relay] of pool.relays) {
  relay.publish(signed);
}

// Optimistically add to local store
eventStore.add(signed);
```

---

## 12. Visual Design — Tokyo Night Semantic Theming

The application follows the **Tokyo Night** color scheme, using CSS custom
properties (semantic tokens) to support light and dark modes. These tokens are
consumed by Tailwind CSS and shadcn-svelte components.

### 12.1 Color Tokens

| Semantic Token           | Dark Mode (Tokyo Night Storm) | Light Mode (Tokyo Night Day) | Usage                                   |
| ------------------------ | ----------------------------- | ---------------------------- | --------------------------------------- |
| `--primary`              | `#7aa2f7` (Blue)              | `#2959aa`                    | Brand, primary buttons, links           |
| `--primary-foreground`   | `#1a1b26`                     | `#ffffff`                    | Text on primary backgrounds             |
| `--secondary`            | `#bb9af7` (Purple)            | `#5a3e8e`                    | Secondary actions, accents              |
| `--secondary-foreground` | `#1a1b26`                     | `#ffffff`                    | Text on secondary backgrounds           |
| `--destructive`          | `#f7768e` (Red)               | `#8c4351`                    | Errors, destructive actions, rejections |
| `--success`              | `#9ece6a` (Green)             | `#385f0d`                    | Success states, approvals, payouts      |
| `--warning`              | `#e0af68` (Yellow)            | `#8f5e15`                    | Warnings, pending states                |
| `--background`           | `#1a1b26` (Night)             | `#d5d6db`                    | Page background                         |
| `--foreground`           | `#a9b1d6`                     | `#343b58`                    | Default text                            |
| `--card`                 | `#24283b` (Storm)             | `#e6e7ed`                    | Card backgrounds                        |
| `--card-foreground`      | `#a9b1d6`                     | `#343b58`                    | Card text                               |
| `--muted`                | `#414868`                     | `#9699a3`                    | Muted/disabled elements                 |
| `--muted-foreground`     | `#565f89`                     | `#6c6f7e`                    | Muted text                              |
| `--border`               | `#414868`                     | `#b4b5bd`                    | Borders and dividers                    |
| `--ring`                 | `#7aa2f7`                     | `#2959aa`                    | Focus rings                             |
| `--accent`               | `#2ac3de` (Cyan)              | `#007197`                    | Highlights, sat amounts                 |

### 12.2 CSS Implementation

```css
/* src/app.css */
@import "tailwindcss";

@theme {
  /* Tokyo Night Dark (default) */
  --color-primary: #7aa2f7;
  --color-primary-foreground: #1a1b26;
  --color-secondary: #bb9af7;
  --color-secondary-foreground: #1a1b26;
  --color-destructive: #f7768e;
  --color-success: #9ece6a;
  --color-warning: #e0af68;
  --color-background: #1a1b26;
  --color-foreground: #a9b1d6;
  --color-card: #24283b;
  --color-card-foreground: #a9b1d6;
  --color-muted: #414868;
  --color-muted-foreground: #565f89;
  --color-border: #414868;
  --color-ring: #7aa2f7;
  --color-accent: #2ac3de;
}

/* Tokyo Night Light variant */
.light {
  --color-primary: #2959aa;
  --color-primary-foreground: #ffffff;
  --color-secondary: #5a3e8e;
  --color-secondary-foreground: #ffffff;
  --color-destructive: #8c4351;
  --color-success: #385f0d;
  --color-warning: #8f5e15;
  --color-background: #d5d6db;
  --color-foreground: #343b58;
  --color-card: #e6e7ed;
  --color-card-foreground: #343b58;
  --color-muted: #9699a3;
  --color-muted-foreground: #6c6f7e;
  --color-border: #b4b5bd;
  --color-ring: #2959aa;
  --color-accent: #007197;
}
```

---

## 13. Error Handling & Edge Cases

### 13.1 Relay Connectivity

| Scenario                          | Behavior                                                                                   | UI                                                         |
| --------------------------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| All relays unreachable            | Retry with exponential backoff (1s, 2s, 4s, 8s, max 30s). Show cached data from IndexedDB. | Banner: "Offline — showing cached data. Reconnecting..."   |
| Some relays unreachable           | Continue with available relays. Log failures.                                              | `RelayStatus.svelte` shows red dot for disconnected relays |
| Relay returns NOTICE/error        | Log and surface to user if actionable                                                      | Toast notification for publish failures                    |
| Subscription receives no events   | After 10s timeout, show empty state                                                        | `EmptyState.svelte` with appropriate message               |
| WebSocket disconnects mid-session | Auto-reconnect via Applesauce RelayPool                                                    | Brief "Reconnecting..." indicator                          |

### 13.2 NIP-07 Signer

| Scenario                          | Behavior                                        | UI                                                                       |
| --------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------ |
| No NIP-07 extension detected      | Disable all write actions. Show install prompt. | "Install a Nostr signer extension to interact" with links to nos2x, Alby |
| User rejects sign request         | Catch rejection, do not retry automatically     | Toast: "Signing cancelled"                                               |
| Extension times out               | 30s timeout, then show error                    | Toast: "Signer timed out. Please try again."                             |
| Extension returns malformed event | Validate event structure before publishing      | Toast: "Invalid event from signer"                                       |

### 13.3 Cashu Token Handling

| Scenario                           | Behavior                                             | UI                                                      |
| ---------------------------------- | ---------------------------------------------------- | ------------------------------------------------------- |
| Mint unreachable                   | Retry 3 times with 2s delay. Offer alternative mint. | "Mint unavailable. Try a different mint?"               |
| Token already spent (double-spend) | Mint returns error on swap. Mark pledge as invalid.  | "This token has already been claimed"                   |
| Token expired (locktime passed)    | Funder can reclaim. Show refund option.              | "Pledge expired. Reclaim your tokens."                  |
| Invalid token in pledge event      | Verify token on load. Flag invalid pledges.          | "⚠ Unverified pledge" badge                             |
| Insufficient balance for pledge    | Prevent submission                                   | Form validation: "Insufficient balance"                 |
| P2PK unlock fails                  | Log error, show manual claim instructions            | "Automatic claim failed. Copy token to claim manually." |

### 13.4 Event Validation

| Scenario                              | Behavior                               | UI                         |
| ------------------------------------- | -------------------------------------- | -------------------------- |
| Task event missing required tags      | Skip/hide from list, log warning       | Not displayed              |
| Solution without valid anti-spam fee  | Display but flag as unverified         | "⚠ No anti-spam fee" badge |
| Vote from non-pledger                 | Ignore (zero weight)                   | Not counted in tally       |
| Duplicate vote (same pubkey+solution) | Keep latest by `created_at`            | Latest vote shown          |
| Payout event from non-creator         | Ignore (only creator can issue payout) | Not displayed              |

### 13.5 UI Edge Cases

| Scenario                         | Behavior                                                                       |
| -------------------------------- | ------------------------------------------------------------------------------ |
| Empty task list                  | Show `EmptyState.svelte`: "No tasks yet. Be the first to create one!" with CTA |
| Task with 0 pledges              | Show "draft" status, "Be the first to fund this task" CTA                      |
| Task with solutions but no votes | Show "Waiting for funders to vote" message                                     |
| Very long task description       | Truncate in card view (3 lines), full in detail view with scroll               |
| Markdown injection in content    | Sanitize HTML output from markdown renderer                                    |
| Extremely large pledge amounts   | Format with locale-aware number formatting (e.g., "1,000,000 sats")            |

---

## 14. Security & Privacy

### 14.1 Authentication

- **NIP-07 only** for MVP. The app never handles private keys directly.
- All signing happens in the browser extension (nos2x, Alby, etc.).
- The app only stores the user's public key (`pubkey`) in memory and optionally
  in `localStorage` for session persistence.

### 14.2 Authorization

- **Task creation**: Any authenticated user.
- **Pledging**: Any authenticated user (they provide their own Cashu tokens).
- **Solution submission**: Any authenticated user (must include anti-spam fee).
- **Voting**: Only pubkeys that have published a Kind 73002 pledge for the
  specific task.
- **Payout**: Only the task creator's pubkey can publish Kind 73004.

### 14.3 Data Protection

- **No PII collected**: The app never asks for email, name, or other personal
  data.
- **Pubkeys are pseudonymous**: Users are identified only by their Nostr pubkey.
- **All data is public**: All Nostr events are published to public relays. Users
  should not include sensitive information in task descriptions or solutions.
- **Cashu tokens are bearer instruments**: Treat them like cash. The app should
  warn users about token security.

### 14.4 Content Security

- Sanitize all markdown rendering to prevent XSS.
- Validate all Nostr event signatures before displaying.
- Validate Cashu token structure before displaying amounts.
- CSP headers configured in static hosting (Cloudflare Pages / Vercel).

### 14.5 Pledger-Controlled Escrow Architecture

The original escrow design locked pledge tokens to the bounty creator's pubkey
using NUT-11 P2PK. This created a critical vulnerability: the creator could
spend pledged tokens at the mint at any time, bypassing the voting process
entirely. The mint only enforces P2PK signatures — it has no knowledge of bounty
logic, voting outcomes, or solver identity.

#### 14.5.1 Why NUT-11 Multisig Cannot Solve This

NUT-11 provides two multisig pathways:

- **Locktime Multisig**: Requires `n_sigs` of `m` pubkeys (via `pubkeys` tag and
  `n_sigs` tag). All signing pubkeys must be known at token creation time.
- **Refund Multisig**: Additional pubkeys that can spend after locktime (via
  `refund` tag and `n_sigs_refund` tag).

`@cashu/cashu-ts` v3 fully supports these via `P2PKOptions`:

```typescript
type P2PKOptions = {
  pubkey: string | string[]; // Lock pubkeys (n_sigs threshold)
  requiredSignatures?: number; // n_sigs
  locktime?: number; // Unix timestamp
  refundKeys?: string[]; // Refund pubkeys (active after locktime)
  requiredRefundSignatures?: number; // n_sigs_refund
  sigFlag?: SigFlag; // SIG_INPUTS or SIG_ALL
};
```

**The fundamental problem**: Each pledge creates independent P2PK-locked proofs.
The spending conditions (pubkeys, n_sigs) are fixed per-proof at creation time
and cannot be modified retroactively. For open bounties with dynamic
participants:

1. The solver is unknown at pledge time — they cannot be included in the
   multisig.
2. Each pledger is different — a single multisig config cannot represent all
   pledgers.
3. New pledgers arriving after the first pledge cannot be added to existing
   proofs' spending conditions.

A trusted arbiter (e.g., a bounty.ninja keypair) would solve this but
re-introduces centralization — the very problem Bounty.ninja exists to avoid.

#### 14.5.2 The Solution: Pledger-Controlled Escrow

Instead of locking tokens to the creator, each pledger locks tokens to **their
own pubkey**. This ensures:

- **No single party can rug-pull**: The creator never controls pledge funds.
- **Pledgers retain sovereignty**: Funds stay under the pledger's control until
  they actively choose to release.
- **Locktime protects against permanent lock**: After the bounty deadline,
  pledgers can reclaim their tokens if they choose not to release.

#### 14.5.3 Payout Flow After Consensus

```
Vote consensus reached (66% of pledged sats approve a solution)
  │
  ▼
App transitions bounty to "releasing" state
  │
  ▼
Each pledger sees a "Release Funds" prompt in the bounty detail page
  │
  ├──[Pledger approves]──▶ Pledger signs a swap at the mint:
  │                          1. Swap P2PK-locked proofs (self-locked) for
  │                             new proofs P2PK-locked to the solver's pubkey
  │                          2. Publish Kind 73004 payout event with solver-locked tokens
  │                          3. Solver claims using their private key
  │
  └──[Pledger ghosts]───▶ No release. Solver doesn't receive this portion.
                           After deadline, pledger reclaims their tokens.
                           Reputation score decremented.
```

#### 14.5.4 Bounty Status Extensions

The pledger-controlled model adds a new status to the bounty lifecycle:

```
open → in_review → consensus_reached → releasing → completed
                                          │
                                          └── Shows "X/Y pledgers released (Z% of funds)"
```

- **`consensus_reached`**: Vote quorum met, waiting for pledgers to release.
- **`releasing`**: At least one pledger has released, others pending.
- **`completed`**: All pledgers have released (or deadline passed for
  remaining).

#### 14.5.5 Reputation Tracking

Track pledger reliability via derived Kind 0 profile metadata or a custom event
kind:

| Metric                   | Derivation                                                |
| ------------------------ | --------------------------------------------------------- |
| Pledges made             | Count of Kind 73002 events by this pubkey                 |
| Pledges released on time | Count of Kind 73004 events by this pubkey after consensus |
| Release rate             | released / total pledges (0-100%)                         |
| Funds released           | Total sats released via Kind 73004                        |

Display a reliability badge on profiles: "98% release rate (49/50 pledges)".
Bounty creators and solvers can use this to assess whether a pledger will follow
through.

#### 14.5.6 Trade-offs and Mitigations

| Trade-off                                                           | Mitigation                                                                                                 |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Payout requires active pledger participation                        | Prominent UI prompts, push notifications (future NIP-04 DMs), reputation consequences                      |
| Solver may not receive 100% of pledged funds if some pledgers ghost | Transparent "X% released" indicator; solver can see expected vs. actual payout before claiming             |
| More complex UX than single-party payout                            | Clear step-by-step release flow; auto-release option (future: pledger pre-authorizes release on consensus) |
| Multiple Kind 73004 events per bounty                               | Aggregate payout amounts across events; display total released vs. total pledged                           |

#### 14.5.7 Deadline Enforcement

Bounty deadlines are now mandatory for pledge security (configurable max via
`PUBLIC_MAX_DEADLINE_DAYS`, default 365 days):

- **Maximum deadline**: 1 year from creation. Prevents indefinite token locks.
- **Deadline serves as locktime**: P2PK proofs use the bounty deadline as the
  locktime parameter. After expiry, pledgers can reclaim unreleased funds.
- **Form validation**: The bounty creation form enforces the maximum deadline.

---

## 15. Performance Requirements

| Metric                       | Target  | How to Achieve                                                                                   |
| ---------------------------- | ------- | ------------------------------------------------------------------------------------------------ |
| First Contentful Paint       | < 1.5s  | Static site, code splitting, minimal JS bundle                                                   |
| Time to Interactive          | < 3s    | Lazy-load relay connections, progressive data loading                                            |
| Task list render (50 items)  | < 100ms | Svelte 5 fine-grained reactivity, virtual scrolling if needed                                    |
| Relay subscription setup     | < 500ms | Parallel connections via RelayPool                                                               |
| Event publish round-trip     | < 2s    | Optimistic local update + parallel relay publish                                                 |
| IndexedDB cache read         | < 50ms  | nostr-idb indexed queries                                                                        |
| Bundle size (gzipped)        | < 400KB | Tree-shaking, dynamic imports for Cashu/heavy modules (~355KB with Svelte + Cashu + Nostr stack) |
| Lighthouse Performance score | > 90    | Static adapter, precompressed assets                                                             |

---

## 16. Accessibility Requirements

- **WCAG 2.1 AA compliance** for all interactive elements.
- **Keyboard navigation**: All actions reachable via Tab/Enter/Escape. Focus
  management for dialogs.
- **Screen reader support**: Proper ARIA labels on all interactive elements.
  Live regions for real-time updates (new pledges, votes).
- **Color contrast**: All text meets 4.5:1 contrast ratio (Tokyo Night tokens
  verified).
- **Reduced motion**: Respect `prefers-reduced-motion` media query. Disable
  animations when set.
- **Focus indicators**: Visible focus rings using `--ring` token.
- shadcn-svelte components provide accessible primitives out of the box.

---

## 17. Quality Assurance — Testing Strategy

### 17.1 Unit Tests (Vitest)

Located in `src/tests/unit/`. Run with `bun run test:unit`.

| Test File               | What It Tests                                                                                |
| ----------------------- | -------------------------------------------------------------------------------------------- |
| `voting.test.ts`        | `calculateVoteWeight()`, `tallyVotes()` with various pledge distributions, quorum edge cases |
| `state-machine.test.ts` | `deriveBountyStatus()` for all state transitions, deadline expiration, cancellation          |
| `helpers.test.ts`       | Tag parsing, `parseBountySummary()`, `parsePledge()`, etc.                                   |
| `filters.test.ts`       | Nostr filter builders produce correct filter objects                                         |
| `p2pk.test.ts`          | P2PK token locking/unlocking, refund after locktime                                          |

### 17.2 Integration Tests (Vitest + Svelte)

Located in `src/tests/integration/`. Run with `bun run test:integration`.

| Test File                    | What It Tests                                                                 |
| ---------------------------- | ----------------------------------------------------------------------------- |
| `task-store.svelte.test.ts`  | EventStore receives Kind 37300 → TaskListStore updates → component re-renders |
| `pledge-flow.svelte.test.ts` | PledgeForm creates Cashu token → publishes Kind 73002 → PledgeList updates    |
| `relay-connection.test.ts`   | RelayPool connects, disconnects, reconnects; events flow to EventStore        |

**Integration test approach:**

- Use Applesauce's in-memory event store (no real relays).
- Mock relay responses by directly adding events to EventStore.
- Use `flushSync()` to ensure Svelte 5 rune updates are applied before
  assertions.

### 17.3 E2E Tests (Playwright)

Located in `src/tests/e2e/`. Run with `bun run test:e2e`.

| Test File                | What It Tests                                                         |
| ------------------------ | --------------------------------------------------------------------- |
| `task-lifecycle.spec.ts` | Create task → fund → submit solution → vote → payout (full lifecycle) |
| `search.spec.ts`         | Search for tasks, filter by status, verify results                    |
| `auth.spec.ts`           | NIP-07 login, profile display, logout                                 |

**E2E test approach:**

- Use a local Nostr relay (e.g., `nostr-relay-tray` or a Docker-based relay) for
  isolated testing.
- Mock NIP-07 extension using Playwright's `page.addInitScript()` to inject a
  test signer.
- Mock Cashu mint with a local test mint or mock HTTP responses.

### 17.4 Test Scripts (package.json)

```json
{
  "scripts": {
    "test": "bun run test:unit && bun run test:integration",
    "test:unit": "vitest run src/tests/unit",
    "test:integration": "vitest run src/tests/integration",
    "test:e2e": "playwright test",
    "test:coverage": "vitest run --coverage"
  }
}
```

---

## 18. Phased Implementation Plan

### Phase 1: Foundation — Project Scaffold & Nostr Connectivity

**Goal:** Establish the project skeleton, connect to Nostr relays, and display a
list of events. No task-specific logic yet — just prove the Applesauce + Svelte
5 integration works.

**Dependencies:** None (starting from scratch).

**Deliverables:**

| #  | File(s) to Create/Modify                                                                                    | Description                                                                     |
| -- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| 1  | Project root: `package.json`, `svelte.config.js`, `vite.config.ts`, `tsconfig.json`, `.env`, `.env.example` | Initialize SvelteKit project with all dependencies installed                    |
| 2  | `src/app.html`, `src/app.css`, `src/app.d.ts`                                                               | HTML shell, Tailwind + Tokyo Night CSS tokens, NIP-07 type declarations         |
| 3  | `src/lib/nostr/event-store.ts`                                                                              | Singleton `EventStore` instance                                                 |
| 4  | `src/lib/nostr/relay-pool.ts`                                                                               | Singleton `RelayPool` with `connectDefaultRelays()`                             |
| 5  | `src/lib/nostr/cache.ts`                                                                                    | nostr-idb IndexedDB cache setup                                                 |
| 6  | `src/lib/nostr/signer.svelte.ts`                                                                            | NIP-07 signer detection and reactive state                                      |
| 7  | `src/lib/nostr/account.svelte.ts`                                                                           | Current user pubkey reactive state                                              |
| 8  | `src/lib/utils/constants.ts`, `src/lib/utils/env.ts`, `src/lib/utils/format.ts`                             | App constants, typed env access, formatting utilities                           |
| 9  | `src/lib/bounty/kinds.ts`                                                                                   | Event kind constants                                                            |
| 10 | `src/routes/+layout.svelte`, `src/routes/+layout.ts`                                                        | Root layout with Header/Footer, Nostr initialization                            |
| 11 | `src/lib/components/layout/Header.svelte`, `Footer.svelte`                                                  | Basic layout components                                                         |
| 12 | `src/lib/components/auth/LoginButton.svelte`                                                                | NIP-07 login button                                                             |
| 13 | `src/lib/components/shared/RelayStatus.svelte`                                                              | Relay connection indicator                                                      |
| 14 | `src/routes/+page.svelte`                                                                                   | Home page — display raw Kind 1 notes from relays (proof of connectivity)        |
| 15 | shadcn-svelte init                                                                                          | Run `shadcn-svelte init`, install Button, Card, Badge, Input, Dialog components |

**Acceptance Criteria:**

- [ ] `bun run dev` starts the app at `localhost:5173` without errors
- [ ] App connects to at least 2 default relays (visible in
      `RelayStatus.svelte`)
- [ ] Relay connection status shows green/red indicators for each relay
- [ ] Clicking "Login" triggers NIP-07 `window.nostr.getPublicKey()` and
      displays the user's npub
- [ ] Events from relays appear in the EventStore (verifiable via browser
      console)
- [ ] IndexedDB cache is created and events are persisted across page reloads
- [ ] Tokyo Night dark theme is applied globally
- [ ] `bun run build` produces a static site in `build/` directory
- [ ] TypeScript compiles with zero errors

---

### Phase 2: Task Display — Data Models, Stores & Read-Only UI

**Goal:** Implement all task data models, create reactive stores, and build the
read-only UI (home page with task cards, task detail page). No write operations
yet.

**Dependencies:** Phase 1 complete.

**Deliverables:**

| #  | File(s) to Create/Modify                                                                                                        | Description                                                                                                                              |
| -- | ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 1  | `src/lib/bounty/types.ts`                                                                                                       | All TypeScript interfaces (Task, Pledge, Solution, Vote, Payout, BountyDetail, BountySummary)                                            |
| 2  | `src/lib/bounty/helpers.ts`                                                                                                     | Tag parsing functions: `parseBountySummary()`, `parseBountyDetail()`, `parsePledge()`, `parseSolution()`, `parseVote()`, `parsePayout()` |
| 3  | `src/lib/bounty/state-machine.ts`                                                                                               | `deriveBountyStatus()` function                                                                                                          |
| 4  | `src/lib/bounty/voting.ts`                                                                                                      | `calculateVoteWeight()`, `tallyVotes()`                                                                                                  |
| 5  | `src/lib/bounty/filters.ts`                                                                                                     | All Nostr filter builder functions                                                                                                       |
| 6  | `src/lib/nostr/loaders/task-loader.ts`                                                                                          | TimelineLoader for Kind 37300                                                                                                            |
| 7  | `src/lib/nostr/loaders/pledge-loader.ts`                                                                                        | Loader for Kind 73002 by task address                                                                                                    |
| 8  | `src/lib/nostr/loaders/solution-loader.ts`                                                                                      | Loader for Kind 73001 by task address                                                                                                    |
| 9  | `src/lib/nostr/loaders/vote-loader.ts`                                                                                          | Loader for Kind 1018 by task address                                                                                                     |
| 10 | `src/lib/nostr/loaders/profile-loader.ts`                                                                                       | Loader for Kind 0 profiles                                                                                                               |
| 11 | `src/lib/stores/bounties.svelte.ts`                                                                                             | Reactive task list store                                                                                                                 |
| 12 | `src/lib/stores/task-detail.svelte.ts`                                                                                          | Single task detail store (pledges, solutions, votes)                                                                                     |
| 13 | `src/lib/components/bounty/BountyCard.svelte`                                                                                   | Task summary card                                                                                                                        |
| 14 | `src/lib/components/bounty/BountyStatusBadge.svelte`                                                                            | Status badge component                                                                                                                   |
| 15 | `src/lib/components/bounty/BountyTags.svelte`                                                                                   | Tag pills                                                                                                                                |
| 16 | `src/lib/components/bounty/BountyDetail.svelte`                                                                                 | Full task detail view                                                                                                                    |
| 17 | `src/lib/components/bounty/BountyTimer.svelte`                                                                                  | Deadline countdown                                                                                                                       |
| 18 | `src/lib/components/pledge/PledgeList.svelte`, `PledgeItem.svelte`                                                              | Pledge display                                                                                                                           |
| 19 | `src/lib/components/solution/SolutionList.svelte`, `SolutionItem.svelte`                                                        | Solution display                                                                                                                         |
| 20 | `src/lib/components/voting/VoteProgress.svelte`, `VoteResults.svelte`                                                           | Vote tally display                                                                                                                       |
| 21 | `src/lib/components/shared/SatAmount.svelte`, `TimeAgo.svelte`, `Markdown.svelte`, `EmptyState.svelte`, `LoadingSpinner.svelte` | Shared UI components                                                                                                                     |
| 22 | `src/routes/+page.svelte` (update)                                                                                              | Home page with task card grid, sorted by total pledged                                                                                   |
| 23 | `src/routes/bounty/[naddr]/+page.svelte`, `+page.ts`                                                                            | Task detail page with naddr routing                                                                                                      |
| 24 | `src/routes/profile/[npub]/+page.svelte`, `+page.ts`                                                                            | Profile page (read-only)                                                                                                                 |
| 25 | `src/tests/unit/voting.test.ts`                                                                                                 | Voting calculation tests                                                                                                                 |
| 26 | `src/tests/unit/state-machine.test.ts`                                                                                          | State machine tests                                                                                                                      |
| 27 | `src/tests/unit/helpers.test.ts`                                                                                                | Tag parsing tests                                                                                                                        |
| 28 | `src/tests/unit/filters.test.ts`                                                                                                | Filter builder tests                                                                                                                     |

**Acceptance Criteria:**

- [ ] Home page displays task cards fetched from Nostr relays (or shows empty
      state if none exist)
- [ ] Task cards show: title, status badge, tags, total pledged sats, solution
      count, time ago
- [ ] Tasks are sorted by total pledged sats (descending) by default
- [ ] Clicking a task card navigates to `/bounty/naddr1...` detail page
- [ ] Task detail page shows: full description (rendered markdown), pledge list,
      solution list, vote progress
- [ ] `BountyStatusBadge` correctly reflects derived status
      (draft/open/in_review/completed/expired)
- [ ] `VoteProgress` shows weighted vote tally with quorum indicator
- [ ] Profile page at `/profile/npub1...` shows user's tasks and solutions
- [ ] All unit tests pass: `bun run test:unit` exits with 0
- [ ] Loading states shown while data is being fetched
- [ ] Empty states shown when no data exists

---

### Phase 3: Write Operations — Create, Fund, Solve, Vote, Payout

**Goal:** Implement all write operations: creating tasks, pledging with Cashu,
submitting solutions, voting, and payout. This is the core product
functionality.

**Dependencies:** Phase 2 complete.

**Deliverables:**

| #  | File(s) to Create/Modify                                             | Description                                                        |
| -- | -------------------------------------------------------------------- | ------------------------------------------------------------------ |
| 1  | `src/lib/bounty/blueprints.ts`                                       | Applesauce EventFactory blueprints for all task event kinds        |
| 2  | `src/lib/cashu/mint.ts`                                              | CashuMint + CashuWallet singleton initialization                   |
| 3  | `src/lib/cashu/token.ts`                                             | Token encoding/decoding utilities                                  |
| 4  | `src/lib/cashu/p2pk.ts`                                              | P2PK lock/unlock helpers                                           |
| 5  | `src/lib/cashu/escrow.ts`                                            | Escrow logic: create locked tokens, claim tokens, refund           |
| 6  | `src/lib/cashu/types.ts`                                             | Cashu-specific TypeScript types                                    |
| 7  | `src/lib/components/bounty/BountyForm.svelte`                        | Create task form (title, description, reward, tags, deadline, fee) |
| 8  | `src/lib/components/pledge/PledgeButton.svelte`                      | "Fund this task" CTA button                                        |
| 9  | `src/lib/components/pledge/PledgeForm.svelte`                        | Pledge amount input + Cashu token creation dialog                  |
| 10 | `src/lib/components/solution/SolutionForm.svelte`                    | Solution submission form + anti-spam fee                           |
| 11 | `src/lib/components/voting/VoteButton.svelte`                        | Approve/reject vote button                                         |
| 12 | `src/lib/components/auth/ProfileMenu.svelte`, `ProfileAvatar.svelte` | Logged-in user menu                                                |
| 13 | `src/lib/stores/toast.svelte.ts`                                     | Global toast notification state                                    |
| 14 | `src/lib/components/shared/Toaster.svelte`                           | Toast notification container                                       |
| 15 | `src/lib/components/shared/ErrorBoundary.svelte`                     | Error boundary wrapper                                             |
| 16 | `src/routes/bounty/new/+page.svelte`                                 | Create task page                                                   |
| 17 | Update `src/routes/bounty/[naddr]/+page.svelte`                      | Add pledge, solution, vote interactive elements                    |
| 18 | Update `src/routes/+layout.svelte`                                   | Add Toaster, ProfileMenu                                           |
| 19 | `src/tests/unit/p2pk.test.ts`                                        | P2PK locking/unlocking tests                                       |
| 20 | `src/tests/integration/task-store.svelte.test.ts`                    | EventStore → store → component reactivity                          |
| 21 | `src/tests/integration/pledge-flow.svelte.test.ts`                   | Pledge creation flow                                               |

**Acceptance Criteria:**

- [ ] Authenticated user can create a task via `/bounty/new` form → Kind 37300
      published to relays
- [ ] Created task appears in the home page list within 5 seconds
- [ ] Authenticated user can pledge sats to a task → Cashu token created,
      P2PK-locked, Kind 73002 published
- [ ] Pledge amount reflected in task's total pledged display
- [ ] Authenticated user can submit a solution with anti-spam fee → Kind 73001
      published with `cashu` tag
- [ ] Anti-spam fee validation: submission rejected if fee <
      `PUBLIC_MIN_SUBMISSION_FEE`
- [ ] Pledgers can vote approve/reject on solutions → Kind 1018 published
- [ ] Non-pledgers see disabled vote buttons with tooltip "Only funders can
      vote"
- [ ] Vote tally updates in real-time as votes arrive
- [ ] When consensus is reached, task creator can trigger payout → Kind 73004
      published
- [ ] Payout tokens are P2PK-locked to the solver's pubkey
- [ ] Toast notifications appear for: successful publish, errors, signing
      cancelled
- [ ] All unit and integration tests pass

---

### Phase 4: Search, Discovery & Polish

**Goal:** Implement NIP-50 search, category filtering, settings page, and UI
polish. Make the app feel complete and production-ready.

**Dependencies:** Phase 3 complete.

**Deliverables:**

| #  | File(s) to Create/Modify                                       | Description                                                         |
| -- | -------------------------------------------------------------- | ------------------------------------------------------------------- |
| 1  | `src/lib/stores/search.svelte.ts`                              | NIP-50 search state management                                      |
| 2  | `src/lib/components/search/SearchBar.svelte`                   | Search input with debounce                                          |
| 3  | `src/lib/components/search/SearchResults.svelte`               | Search results display                                              |
| 4  | `src/routes/search/+page.svelte`, `+page.ts`                   | Search results page                                                 |
| 5  | `src/routes/settings/+page.svelte`                             | Settings page: relay management, mint selection, theme toggle       |
| 6  | `src/lib/components/layout/Sidebar.svelte`                     | Category/tag filter sidebar                                         |
| 7  | `src/lib/components/layout/MobileNav.svelte`                   | Mobile bottom navigation                                            |
| 8  | `src/lib/stores/user-profile.svelte.ts`                        | Current user profile state                                          |
| 9  | Update `src/routes/+page.svelte`                               | Add search bar (hero), category tabs, improved layout               |
| 10 | Update `src/lib/components/layout/Header.svelte`               | Add search bar, responsive design                                   |
| 11 | `static/favicon.ico`, `static/logo.svg`, `static/og-image.png` | Branding assets                                                     |
| 12 | Update `src/app.html`                                          | Meta tags, Open Graph tags, favicon                                 |
| 13 | `src/tests/e2e/task-lifecycle.spec.ts`                         | Full lifecycle E2E test                                             |
| 14 | `src/tests/e2e/search.spec.ts`                                 | Search E2E test                                                     |
| 15 | `src/tests/e2e/auth.spec.ts`                                   | Auth E2E test                                                       |
| 16 | `playwright.config.ts`                                         | Playwright configuration                                            |
| 17 | `src/lib/bounty/taxonomy.ts`                                   | Auto-tag taxonomy: category → keyword regex patterns (Section 10.4) |
| 18 | `src/lib/bounty/auto-tagger.ts`                                | `suggestTags()` — matches title + description against taxonomy      |
| 19 | `src/lib/components/bounty/TagAutoSuggest.svelte`              | Suggestion chips UI + community tag autocomplete dropdown           |
| 20 | Update `src/lib/components/bounty/BountyForm.svelte`           | Integrate TagAutoSuggest, trigger on title/description blur         |
| 21 | `src/tests/unit/auto-tagger.test.ts`                           | Taxonomy matching tests (technical + non-technical bounties)        |

**Acceptance Criteria:**

- [ ] Search bar on home page and header performs NIP-50 search on
      `PUBLIC_SEARCH_RELAY`
- [ ] Search results page at `/search?q=...` displays matching tasks
- [ ] Category tabs on home page filter tasks by `t` tag
- [ ] Settings page allows adding/removing relays (persisted to localStorage)
- [ ] Settings page allows selecting preferred Cashu mint
- [ ] Theme toggle switches between Tokyo Night dark and light modes (persisted)
- [ ] Mobile-responsive layout with bottom navigation on small screens
- [ ] Open Graph meta tags render correct preview when sharing task URLs
- [ ] Auto-tag suggestions appear after user types a title or description,
      covering both technical (e.g., "bitcoin", "frontend") and non-technical
      categories (e.g., "activism", "construction", "landscaping")
- [ ] Tag autocomplete shows community-used tags when the user types in the tag
      input
- [ ] Users can accept, dismiss, or manually override all tag suggestions
- [ ] All E2E tests pass with Playwright
- [ ] Lighthouse scores: Performance > 90, Accessibility > 90, Best Practices >
      90
- [ ] No TypeScript errors, no console errors in production build

---

### Phase 5: Hardening — Security, Performance & Deployment

**Goal:** Security audit, performance optimization, error handling hardening,
and deployment to https://bounty.ninja.

**Dependencies:** Phase 4 complete.

**Deliverables:**

| #  | Task                       | Description                                                              |
| -- | -------------------------- | ------------------------------------------------------------------------ |
| 1  | Cashu token validation     | Verify all tokens against mint before displaying amounts                 |
| 2  | Event signature validation | Verify all Nostr event signatures before rendering                       |
| 3  | Markdown sanitization      | Ensure XSS-safe markdown rendering                                       |
| 4  | Bundle optimization        | Code splitting, lazy loading for Cashu module, tree shaking audit        |
| 5  | IndexedDB cache eviction   | Implement LRU cache eviction for old events                              |
| 6  | Rate limiting              | Client-side rate limiting for event publishing (prevent accidental spam) |
| 7  | Error boundary coverage    | Wrap all route pages in ErrorBoundary                                    |
| 8  | Offline support            | Service worker for static assets, graceful offline mode                  |
| 9  | Deployment config          | Cloudflare Pages / Vercel config, custom domain setup, CSP headers       |
| 10 | Monitoring                 | Client-side error logging (optional: Sentry or similar)                  |

**Acceptance Criteria:**

- [ ] No XSS vulnerabilities in markdown rendering (tested with known XSS
      payloads)
- [ ] Invalid Nostr event signatures are rejected and not displayed
- [ ] Invalid Cashu tokens show warning badge, not fake amounts
- [ ] Bundle size < 400KB gzipped
- [ ] App works offline with cached data (no crashes, graceful degradation)
- [ ] Deployed and accessible at https://bounty.ninja
- [ ] CSP headers block inline scripts and unauthorized origins
- [ ] All tests (unit, integration, E2E) pass in CI

---

### Phase 6 (Post-MVP): DVM Integration & Advanced Features

**Goal:** Add DVM/ContextVM support, advanced search, reputation system, and
multi-mint support.

**Dependencies:** Phase 5 complete (production MVP deployed).

**Deliverables (scoped separately):**

- DVM (NIP-90) job request/result integration
- ContextVM bridge for MCP-powered AI solvers
- Reputation scoring based on pledge release rates, completed tasks, and
  successful solutions
- Auto-release: pledgers can pre-authorize automatic release on consensus
- Push notifications via NIP-04 DMs when consensus is reached and release is
  needed
- Multi-mint Cashu support with automatic mint selection
- Task templates and categories
- Notification system (NIP-04 DMs for task updates)
- Task sharing via NIP-19 `naddr` deep links with preview cards

---

## 19. Dependencies & External Services

### 19.1 NPM Packages (Production)

| Package               | Purpose                          | Notes                                  |
| --------------------- | -------------------------------- | -------------------------------------- |
| `applesauce-core`     | EventStore, EventFactory         | Core Nostr primitives                  |
| `applesauce-relay`    | RelayPool, relay connections     | RxJS-based                             |
| `applesauce-loaders`  | TimelineLoader, EventLoader      | Simplifies multi-relay fetching        |
| `applesauce-common`   | Helpers, models, blueprints      | Common Nostr patterns                  |
| `applesauce-signers`  | NIP-07 signer                    | Browser extension integration          |
| `applesauce-accounts` | AccountManager                   | Multi-account support                  |
| `applesauce-actions`  | Pre-built actions                | Event creation workflows               |
| `applesauce-wallet`   | NIP-60 Cashu wallet              | Cashu wallet integration               |
| `nostr-idb`           | IndexedDB cache                  | Persistent local event storage         |
| `nostr-tools`         | NIP-19 encoding, event utilities | Low-level Nostr utilities              |
| `@cashu/cashu-ts`     | Cashu protocol                   | Token creation, P2PK, mint interaction |
| `rxjs`                | Reactive streams                 | Applesauce peer dependency             |

### 19.2 NPM Packages (Development)

| Package                    | Purpose                  |
| -------------------------- | ------------------------ |
| `@sveltejs/adapter-static` | Static site generation   |
| `@sveltejs/kit`            | SvelteKit framework      |
| `svelte`                   | Svelte 5 compiler        |
| `typescript`               | Type checking            |
| `vite`                     | Build tool               |
| `tailwindcss`              | CSS framework            |
| `@tailwindcss/vite`        | Tailwind Vite plugin     |
| `shadcn-svelte`            | UI component library     |
| `vitest`                   | Unit/integration testing |
| `@playwright/test`         | E2E testing              |
| `eslint`                   | Linting                  |
| `prettier`                 | Code formatting          |
| `prettier-plugin-svelte`   | Svelte formatting        |

### 19.3 External Services

| Service                                    | Purpose                            | Required?                                            |
| ------------------------------------------ | ---------------------------------- | ---------------------------------------------------- |
| Nostr relays (public)                      | Event storage and retrieval        | Yes — app is non-functional without at least 1 relay |
| Cashu mint (public)                        | Ecash token minting and redemption | Yes — required for pledging and payout               |
| NIP-50 search relay                        | Full-text search                   | Optional — search degrades gracefully                |
| Static hosting (Cloudflare Pages / Vercel) | Serve the built static site        | Yes — for production deployment                      |

---

## 20. Out of Scope (Post-MVP)

- **DVM / ContextVM integration** — AI solver support (Phase 6)
- **Multi-mint Cashu support** — MVP uses a single configured mint
- **NIP-60 wallet UI** — Full in-app Cashu wallet management
- **Notification system** — NIP-04 DMs for task updates
- **Full reputation system** — Basic pledge release rate tracking is in-scope
  (Section 14.5.5); advanced reputation with weighted scoring is post-MVP
- **Task templates** — Pre-filled forms for common task types
- **Relay list discovery** — NIP-65 relay list metadata
- **Lightning Network payments** — Direct LN invoice support (Cashu-only for
  MVP)
- **Mobile native app** — Web-only for MVP
- **Admin/moderation tools** — Decentralized moderation via mute lists
- **Internationalization (i18n)** — English only for MVP
- **Task categories/taxonomy** — ~~Free-form tags only for MVP~~ Moved to
  Section 10.4 (auto-tag taxonomy with keyword matching)

---

## 21. Open Questions

| # | Question                                                                                                              | Impact                                  | Proposed Resolution                                                                                                                                                                                         |
| - | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 | **Which Cashu mint(s) should be the default?** The mint is a trust dependency — users trust the mint to honor tokens. | High — affects all financial operations | Default to a well-known mint (e.g., `https://mint.minibits.cash/Bitcoin`). Allow user override in settings. Display mint trust warning.                                                                     |
| 2 | **How should the payout process work when the task creator goes offline?**                                            | Low — no longer a blocker               | ✅ Resolved: Pledger-controlled escrow means the creator never holds pledge funds. Each pledger releases their own portion directly to the solver after consensus. Creator offline has no impact on payout. |
| 3 | **Should votes have a time limit?** Currently voting is open-ended.                                                   | Medium — could lead to stale tasks      | Add optional `voting_deadline` tag to Kind 37300. Default: 7 days after first solution.                                                                                                                     |
| 4 | **How to handle tasks with pledges from multiple mints?**                                                             | Medium — complicates payout             | MVP: require all pledges use the task's specified mint. Post-MVP: support cross-mint swaps.                                                                                                                 |
| 5 | **What is the exact quorum formula?**                                                                                 | Low — resolved                          | ✅ Resolved: 66% supermajority (configurable via `PUBLIC_VOTE_QUORUM_PERCENT`). Higher threshold protects pledgers and ensures broader consensus before triggering the release phase.                       |
| 6 | **Should the anti-spam fee scale with task size?**                                                                    | Low — affects UX                        | MVP: fixed range (10-100 sats). Post-MVP: percentage-based or task-creator-defined.                                                                                                                         |
| 7 | **Are event kinds 37300, 73001, 73002, 1018, 73004 registered or proposed NIPs?**                                     | Medium — interoperability               | Research existing task NIPs. If none exist, propose a NIP. Use these kinds for MVP regardless.                                                                                                              |

---

## 22. Recommendations & Risk Analysis

### 22.1 Ambiguities That Would Block an AI Coder

| Issue                              | Current State                                                                                                                                                       | Recommendation                                                                                                                                                                                     |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Applesauce API surface**         | The original PRD references `QueryStore` which doesn't exist in Applesauce v5. Applesauce uses `EventStore` with `.timeline()`, `.event()`, and `.model()` methods. | ✅ Fixed in this PRD. All code examples now use correct Applesauce v5 API (`EventStore`, `RelayPool`, `onlyEvents()`).                                                                             |
| **NDK references**                 | Original PRD imports from `./ndk` and uses `NDKEvent`/`NDKFilter` types. Applesauce is NOT NDK — they are different libraries.                                      | ✅ Fixed. All references now use Applesauce types and `nostr-tools` types (`NostrEvent`, `Filter`).                                                                                                |
| **P2PK escrow flow**               | The original PRD says tokens are "P2PK-locked" but doesn't specify: locked to whose key? How is payout orchestrated?                                                | ✅ Clarified in Section 6.3 and 6.6. Tokens locked to task creator's pubkey. Creator swaps and re-locks to solver on payout.                                                                       |
| **Event kind registration**        | Kinds 37300, 73001, 73002, 1018, 73004 are used but it's unclear if these are established NIPs or custom.                                                           | ⚠️ Flagged in Open Questions. These appear to come from the `featurestr-taskstr` project. An AI coder should treat them as custom kinds and implement accordingly.                                 |
| **Cashu token format in tags**     | The PRD says `["cashu", "<token>"]` but doesn't specify the token encoding format.                                                                                  | ✅ Clarified: use `@cashu/cashu-ts` `getEncodedToken()` which produces `cashuA...` v4 tokens.                                                                                                      |
| **Voting eligibility enforcement** | "Only pledgers can vote" — but this is client-side only. Relays will accept any Kind 1018 event.                                                                    | ⚠️ This is a fundamental limitation of client-side-only apps. The app should validate on read (ignore votes from non-pledgers) but cannot prevent publishing. Document this as a known limitation. |

### 22.2 Missing Specifications (Now Added)

- ✅ Project directory structure with exact file paths
- ✅ TypeScript interfaces for all event kinds
- ✅ Nostr filter contracts for all queries
- ✅ Route map with load functions
- ✅ Component hierarchy
- ✅ State management data flow
- ✅ Error handling matrix
- ✅ Phased implementation with acceptance criteria
- ✅ Environment setup instructions
- ✅ Dependency list with versions

### 22.3 Technical Risks

| Risk                         | Severity | Mitigation                                                                                                                                                                                                                                                         |
| ---------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Cashu mint trust**         | High     | The mint is a trusted third party. If it goes down or is malicious, pledged tokens are lost. Mitigation: allow user-selected mints, display trust warnings, support multiple mints post-MVP.                                                                       |
| **Pledger non-cooperation**  | Medium   | Pledgers retain custody and must actively release funds after consensus. If they ghost, the solver doesn't receive their portion. Mitigation: reputation scoring, social pressure via "X/Y released" UI, locktime reclaim ensures funds aren't permanently locked. |
| **Relay censorship**         | Medium   | A relay could refuse to store task events. Mitigation: publish to multiple relays, allow user-configured relay lists.                                                                                                                                              |
| **Event kind conflicts**     | Medium   | Custom kinds (37300, etc.) could conflict with other apps. Mitigation: use `client` tag for filtering, propose a NIP for standardization.                                                                                                                          |
| **Applesauce API stability** | Medium   | Applesauce is actively developed (v5 released recently). API may change. Mitigation: pin versions, wrap Applesauce calls in adapter layer.                                                                                                                         |
| **Cashu token double-spend** | Medium   | A funder could pledge the same token to multiple tasks. Mitigation: verify tokens against mint on receipt (async validation).                                                                                                                                      |
| **Large event payloads**     | Low      | Cashu tokens in tags can be large. Some relays may reject events exceeding size limits. Mitigation: compress tokens, split large pledges.                                                                                                                          |

### 22.4 Suggested Simplifications for MVP

1. **Single mint only**: Don't support multi-mint in Phase 1-4. All pledges must
   use the task's configured mint.
2. **Pledger-initiated release**: Each pledger individually releases their funds
   to the solver after 66% consensus is reached. No automatic payout — pledgers
   must actively participate in the release phase.
3. **No real-time token verification**: Verify Cashu tokens lazily (on demand)
   rather than on every event received. Show "unverified" badge until checked.
4. **Skip DVM/ContextVM entirely**: These are complex integrations that don't
   affect core task functionality. Defer to Phase 6.
5. **Simple search**: If NIP-50 search relay is unavailable, fall back to
   client-side filtering of cached events by title/tags.
6. **No multi-account**: Support only one logged-in account at a time for MVP.
7. **No offline-first sync**: Use IndexedDB as a cache for performance, not as a
   full offline database. Require connectivity for write operations.

---

## 23. Glossary

| Term                          | Definition                                                                                                                                                       |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Task**                      | A task posted on Bounty.ninja with a bitcoin reward, represented as a Kind 37300 Nostr event                                                                     |
| **Pledge**                    | A funding contribution to a task, containing P2PK-locked Cashu tokens (Kind 73002)                                                                               |
| **Solution**                  | A submission claiming to fulfill a task's requirements (Kind 73001)                                                                                              |
| **Vote**                      | A funder's approval or rejection of a solution (Kind 1018)                                                                                                       |
| **Payout**                    | The transfer of pledged tokens to the winning solver (Kind 73004)                                                                                                |
| **Cashu**                     | An open-source ecash protocol for Bitcoin, enabling bearer tokens                                                                                                |
| **P2PK**                      | Pay-to-Public-Key — a Cashu spending condition (NUT-11) that locks tokens to a specific public key                                                               |
| **NIP**                       | Nostr Implementation Possibility — a specification for Nostr protocol features                                                                                   |
| **NIP-07**                    | Browser extension signer standard for Nostr (e.g., nos2x, Alby)                                                                                                  |
| **NIP-19**                    | Bech32-encoded Nostr identifiers (npub, naddr, nevent, etc.)                                                                                                     |
| **NIP-33**                    | Parameterized Replaceable Events — events that can be updated by the same author                                                                                 |
| **NIP-40**                    | Expiration Timestamp — events with an expiration date                                                                                                            |
| **NIP-50**                    | Search Capability — relay-side full-text search                                                                                                                  |
| **NIP-90**                    | Data Vending Machine — protocol for on-demand computation services                                                                                               |
| **DVM**                       | Data Vending Machine (NIP-90)                                                                                                                                    |
| **ContextVM**                 | A bridge between Nostr and Model Context Protocol (MCP) for AI agent integration                                                                                 |
| **Applesauce**                | A collection of TypeScript libraries for building Nostr web clients (by hzrd149)                                                                                 |
| **EventStore**                | Applesauce's reactive in-memory database for Nostr events                                                                                                        |
| **RelayPool**                 | Applesauce's relay connection manager                                                                                                                            |
| **Runes**                     | Svelte 5's reactivity primitives (`$state`, `$derived`, `$effect`)                                                                                               |
| **naddr**                     | NIP-19 encoded address for parameterized replaceable events (used for task URLs)                                                                                 |
| **npub**                      | NIP-19 encoded public key (used for profile URLs)                                                                                                                |
| **Linear Voting**             | Voting mechanism where weight = pledge amount (1 sat = 1 vote weight), chosen over square-root weighting for Sybil resistance                                    |
| **Pledger-Controlled Escrow** | The escrow model where pledgers lock tokens to their own pubkey (not the creator's), retaining custody until they actively release to the solver after consensus |
| **Release**                   | The act of a pledger swapping their self-locked tokens for solver-locked tokens after vote consensus                                                             |
| **Release Rate**              | A pledger's reputation metric: percentage of pledges released on time after consensus was reached                                                                |
| **Anti-spam fee**             | A small, non-refundable Cashu token attached to solution submissions to deter spam                                                                               |
| **Tokyo Night**               | A popular dark/light color scheme used as the app's visual theme                                                                                                 |

---

## 24. Works Cited

1. Nostr — Wikipedia, accessed February 10, 2026,
   https://en.wikipedia.org/wiki/Nostr
2. How Nostr Works: Technical Deep-Dive — Nostr.co.uk, accessed February 10,
   2026, https://nostr.co.uk/learn/how-nostr-works/
3. Cashu — Open-source Ecash, accessed February 10, 2026, https://cashu.space/
4. The Nostr Protocol, accessed February 10, 2026,
   https://nostr.how/en/the-protocol
5. Exploring 6 Use Cases of Nostr Protocol | Voltage Blog, accessed February 10,
   2026,
   https://voltage.cloud/blog/exploring-6-use-cases-of-nostr-beyond-messaging
6. sebdeveloper6952/featurestr-taskstr — GitHub, accessed February 10, 2026,
   https://github.com/sebdeveloper6952/featurestr-taskstr
7. nips/01.md at master · nostr-protocol/nips — GitHub, accessed February 10,
   2026, https://github.com/nostr-protocol/nips/blob/master/01.md
8. NIP-88 — Polls — NIPs (Nostr Improvement Proposals), accessed February 10,
   2026, https://nips.nostr.com/88
9. Explanation of Weighted Voting — HathiTrust Digital Library, accessed
   February 10, 2026,
   https://www.hathitrust.org/about/governance/weighted-voting/
10. A curated, collaborative list of awesome Cashu resources — GitHub, accessed
    February 10, 2026, https://github.com/cashubtc/awesome-cashu
11. Cashu NUTs Specifications, accessed February 10, 2026,
    https://cashubtc.github.io/nuts/
12. NIPs (Nostr Improvement Proposals), accessed February 10, 2026,
    https://nips.nostr.com/
13. NIP-90 — Data Vending Machine, accessed February 10, 2026,
    https://nips.nostr.com/90
14. NIP-50 — Search Capability, accessed February 10, 2026,
    https://github.com/nostr-protocol/nips/blob/master/50.md
15. NUT-11 — Pay to Public Key (P2PK), accessed February 10, 2026,
    https://cashubtc.github.io/nuts/11/
16. Applesauce — Documentation, accessed February 10, 2026,
    https://applesauce.build/
17. Applesauce — GitHub, accessed February 10, 2026,
    https://github.com/hzrd149/applesauce
18. shadcn-svelte — Documentation, accessed February 10, 2026,
    https://next.shadcn-svelte.com/
