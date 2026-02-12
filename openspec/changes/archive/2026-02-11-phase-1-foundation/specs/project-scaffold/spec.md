## ADDED Requirements

### Requirement: SvelteKit Project Initialization

The project SHALL be initialized as a SvelteKit 2 skeleton project with
TypeScript strict mode enabled. The project MUST use `@sveltejs/adapter-static`
configured with `fallback: "index.html"`, `precompress: true`, and
`strict: true` to produce a static SPA. SSR MUST be disabled (`ssr: false`) and
prerendering MUST be disabled (`prerender: false`).

#### Scenario: Static adapter produces SPA output

- **WHEN** `bun run build` is executed
- **THEN** a `build/` directory is created containing static assets and an
  `index.html` fallback file
- **AND** no server-side routes or API endpoints exist in the output

#### Scenario: SvelteKit config matches PRD Section 4.5

- **WHEN** `svelte.config.js` is inspected
- **THEN** it imports `adapter` from `@sveltejs/adapter-static`
- **AND** it uses `vitePreprocess()` as the preprocessor
- **AND** the `$lib` alias resolves to `./src/lib`

### Requirement: Bun Package Manager

All package management operations MUST use Bun. The project MUST NOT contain
`package-lock.json`, `yarn.lock`, or `pnpm-lock.yaml`. The lock file SHALL be
`bun.lockb`.

#### Scenario: Dependencies installed with Bun

- **WHEN** `bun install` is executed in the project root
- **THEN** all dependencies from `package.json` are installed
- **AND** a `bun.lockb` file is created or updated
- **AND** no other lock files are present

### Requirement: Vite Configuration

`vite.config.ts` MUST include the `@tailwindcss/vite` plugin and the
`sveltekit()` plugin. The `optimizeDeps.exclude` array MUST include
`@noble/curves` and `@noble/hashes` for WASM compatibility with Cashu and
nostr-tools cryptographic libraries.

#### Scenario: Vite config excludes noble libraries

- **WHEN** `vite.config.ts` is inspected
- **THEN** `optimizeDeps.exclude` contains `"@noble/curves"` and
  `"@noble/hashes"`

#### Scenario: Tailwind plugin is registered

- **WHEN** `vite.config.ts` is inspected
- **THEN** the `plugins` array includes `tailwindcss()` from `@tailwindcss/vite`
  before `sveltekit()`

### Requirement: Production Dependencies

The project MUST install all Applesauce ecosystem packages (`applesauce-core`,
`applesauce-relay`, `applesauce-loaders`, `applesauce-common`,
`applesauce-signers`, `applesauce-accounts`, `applesauce-actions`,
`applesauce-wallet`), `nostr-idb`, `nostr-tools`, `@cashu/cashu-ts`, and `rxjs`
as production dependencies.

#### Scenario: All production dependencies are present

- **WHEN** `package.json` `dependencies` field is inspected
- **THEN** all packages listed in PRD Section 19.1 are present with appropriate
  version ranges

### Requirement: Development Dependencies

The project MUST install `tailwindcss`, `@tailwindcss/vite`,
`@sveltejs/adapter-static`, `@playwright/test`, `vitest`, `eslint`, `prettier`,
and `prettier-plugin-svelte` as development dependencies.

#### Scenario: All dev dependencies are present

- **WHEN** `package.json` `devDependencies` field is inspected
- **THEN** all packages listed in PRD Section 19.2 are present with appropriate
  version ranges

### Requirement: Environment Variables

A `.env` file and `.env.example` file MUST exist at the project root. Both files
MUST define the following public configuration variables:
`PUBLIC_DEFAULT_RELAYS`, `PUBLIC_DEFAULT_MINT`, `PUBLIC_APP_NAME`,
`PUBLIC_APP_URL`, `PUBLIC_MIN_SUBMISSION_FEE`, `PUBLIC_MAX_SUBMISSION_FEE`, and
`PUBLIC_SEARCH_RELAY`. The `.env` file MUST NOT contain secrets. The
`.env.example` file MUST be committed to version control.

#### Scenario: Environment variables are defined

- **WHEN** `.env.example` is inspected
- **THEN** it contains all seven `PUBLIC_*` variables with sensible default
  values matching PRD Section 4.4

#### Scenario: .env is gitignored

- **WHEN** `.gitignore` is inspected
- **THEN** `.env` is listed (but `.env.example` is NOT listed)

### Requirement: mise.toml Tool Management

A `mise.toml` file MUST exist at the project root defining tool versions for
`node` (22), `bun` (latest), and `nak` (latest via Go install). It MUST define
environment variables mirroring `.env` and MUST define tasks for `dev`, `build`,
`preview`, `test`, `test:unit`, `test:integration`, `test:e2e`, `relay`, `seed`,
`lint`, `format`, `check`, and `clean`.

#### Scenario: mise installs required tools

- **WHEN** `mise install` is executed
- **THEN** Node.js 22, Bun, and nak are installed and available on `$PATH`

#### Scenario: mise tasks run correctly

- **WHEN** `mise run dev` is executed
- **THEN** the SvelteKit dev server starts at `localhost:5173`

### Requirement: TypeScript Configuration

TypeScript MUST be configured in strict mode. The `tsconfig.json` MUST extend
SvelteKit's default TypeScript configuration. The `src/app.d.ts` file MUST
declare the `window.nostr` NIP-07 interface for type-safe signer access.

#### Scenario: TypeScript compiles without errors

- **WHEN** `bun run check` (svelte-check) is executed
- **THEN** zero TypeScript errors are reported

#### Scenario: NIP-07 types are declared

- **WHEN** `src/app.d.ts` is inspected
- **THEN** it declares `window.nostr` with `getPublicKey(): Promise<string>` and
  `signEvent(event: object): Promise<object>` methods

### Requirement: Utility Modules

The project MUST create the following utility modules at the paths specified in
PRD Section 5:

- `src/lib/utils/constants.ts` — App-wide constants including the `CLIENT_TAG`
  value `"bounty.ninja"`
- `src/lib/utils/env.ts` — Typed access to `PUBLIC_*` environment variables with
  fallback defaults
- `src/lib/utils/format.ts` — Number formatting (sats with locale-aware
  separators), date formatting, and npub truncation utilities

#### Scenario: Constants module exports CLIENT_TAG

- **WHEN** `src/lib/utils/constants.ts` is imported
- **THEN** it exports a `CLIENT_TAG` constant with value `"bounty.ninja"`

#### Scenario: Env module provides typed access

- **WHEN** `src/lib/utils/env.ts` is imported
- **THEN** it exports typed accessor functions for all `PUBLIC_*` variables
- **AND** each accessor returns a sensible default if the variable is undefined

#### Scenario: Format module truncates npub

- **WHEN** `formatNpub("npub1abcdef...xyz")` is called
- **THEN** it returns a truncated form like `"npub1abc...xyz"`

### Requirement: Event Kind Constants

`src/lib/task/kinds.ts` MUST export named constants for all five task event
kinds as specified in PRD Section 6.1: `TASK_KIND` (37300), `SOLUTION_KIND`
(73001), `PLEDGE_KIND` (73002), `VOTE_KIND` (1018), and `PAYOUT_KIND` (73004).

#### Scenario: Kind constants match PRD values

- **WHEN** `src/lib/task/kinds.ts` is imported
- **THEN** `TASK_KIND === 37300`
- **AND** `SOLUTION_KIND === 73001`
- **AND** `PLEDGE_KIND === 73002`
- **AND** `VOTE_KIND === 1018`
- **AND** `PAYOUT_KIND === 73004`

### Requirement: Project Directory Structure

The project directory structure MUST follow the layout defined in PRD Section 5.
All directories under `src/lib/` MUST exist: `nostr/`, `nostr/loaders/`,
`task/`, `cashu/`, `stores/`, `components/layout/`, `components/task/`,
`components/pledge/`, `components/solution/`, `components/voting/`,
`components/auth/`, `components/search/`, `components/shared/`, and `utils/`.
The `src/routes/` directory MUST contain the root layout files and the home page
files.

#### Scenario: Core directories exist

- **WHEN** the `src/lib/` directory is listed
- **THEN** subdirectories `nostr/`, `task/`, `stores/`, `components/`, and
  `utils/` exist

#### Scenario: Dev server starts without errors

- **WHEN** `bun run dev` is executed
- **THEN** the SvelteKit dev server starts at `localhost:5173` without
  TypeScript or build errors
