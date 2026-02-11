## ADDED Requirements

### Requirement: Bundle Size Target

The production build output MUST be less than 200KB gzipped total for all
JavaScript assets. The build pipeline SHALL use Vite's built-in code splitting
and tree shaking. Bundle size MUST be measured using `bun run build` followed by
gzip size analysis of all `.js` files in the `build/` output directory.

#### Scenario: Production build meets size target

- **WHEN** `bun run build` is executed and the output JavaScript files are
  gzipped
- **THEN** the total gzipped size of all `.js` files SHALL be less than 200KB

#### Scenario: Bundle size regression is detected

- **WHEN** a code change causes the gzipped bundle to exceed 200KB
- **THEN** the CI pipeline SHALL fail with a clear error message indicating the
  current size and the 200KB target

### Requirement: Dynamic Import for Cashu Module

The `@cashu/cashu-ts` library and all Cashu-related modules (`src/lib/cashu/*`)
MUST be loaded via dynamic `import()` and SHALL NOT be included in the initial
bundle. The Cashu module SHALL be loaded on demand when a user first interacts
with pledge or payout functionality (e.g., opening the PledgeForm, viewing
pledge details, or initiating a payout).

#### Scenario: Initial page load does not include Cashu code

- **WHEN** the home page loads for the first time
- **THEN** no JavaScript chunk containing `@cashu/cashu-ts` code SHALL be loaded
- **AND** the initial bundle SHALL only contain Nostr connectivity, routing, and
  UI framework code

#### Scenario: Cashu module loads on pledge interaction

- **WHEN** a user clicks "Fund this bounty" to open the PledgeForm
- **THEN** the Cashu module chunk SHALL be dynamically imported
- **AND** a brief loading indicator SHALL be shown while the module loads
- **AND** subsequent Cashu interactions SHALL use the already-loaded module

#### Scenario: Cashu module loads for token validation

- **WHEN** a user navigates to a bounty detail page with pledges
- **THEN** the Cashu module SHALL be dynamically imported to enable token
  validation
- **AND** pledge amounts SHALL display with "pending" verification status until
  the module is loaded and verification completes

### Requirement: Route-Based Code Splitting

Each SvelteKit route page SHALL be a separate chunk. The Vite build MUST produce
separate chunks for:

- Home page (`/`)
- Bounty detail page (`/bounty/[naddr]`)
- Create bounty page (`/bounty/new`)
- Profile page (`/profile/[npub]`)
- Search page (`/search`)
- Settings page (`/settings`)

#### Scenario: Navigating to a new route loads only that route's chunk

- **WHEN** a user navigates from the home page to a bounty detail page
- **THEN** only the bounty detail chunk SHALL be loaded (not the create bounty
  or settings chunks)

### Requirement: Precompressed Static Assets

The `@sveltejs/adapter-static` MUST be configured with `precompress: true` to
generate `.gz` and `.br` (Brotli) compressed versions of all static assets at
build time. The hosting platform MUST be configured to serve precompressed
assets when the client supports them via `Accept-Encoding`.

#### Scenario: Brotli-compressed assets are served

- **WHEN** a browser sends a request with `Accept-Encoding: br, gzip`
- **THEN** the server SHALL respond with the `.br` precompressed version
- **AND** the `Content-Encoding: br` header SHALL be present

#### Scenario: Gzip fallback for older clients

- **WHEN** a browser sends a request with `Accept-Encoding: gzip` (no Brotli
  support)
- **THEN** the server SHALL respond with the `.gz` precompressed version

### Requirement: Tree Shaking Audit

The Vite build MUST be configured to maximize tree shaking effectiveness.
Imports from large libraries (`nostr-tools`, `rxjs`, `@cashu/cashu-ts`) MUST use
named imports from specific subpaths where available (e.g.,
`import { verifyEvent } from 'nostr-tools'` rather than
`import * as nostrTools from 'nostr-tools'`).

#### Scenario: Unused nostr-tools modules are excluded

- **WHEN** the production build is analyzed
- **THEN** only the specific `nostr-tools` functions actually imported in the
  source code SHALL be present in the output bundle
- **AND** unused NIP implementations SHALL NOT be included

### Requirement: Performance Metrics Targets

The deployed application MUST meet the following Lighthouse performance metrics:

- Lighthouse Performance score > 90
- First Contentful Paint < 1.5 seconds
- Time to Interactive < 3 seconds
- Cumulative Layout Shift < 0.1

#### Scenario: Lighthouse audit passes performance threshold

- **WHEN** a Lighthouse audit is run against the deployed production site
- **THEN** the Performance score SHALL be greater than 90

#### Scenario: First Contentful Paint meets target

- **WHEN** the home page is loaded on a simulated 4G connection
- **THEN** the First Contentful Paint SHALL occur within 1.5 seconds

### Requirement: Image and Asset Optimization

All static images (logo, favicon, Open Graph image) MUST be optimized for web
delivery. SVG files MUST be minified. The Open Graph image MUST be served in an
appropriate resolution (1200x630 pixels) without exceeding 200KB.

#### Scenario: Logo SVG is minified

- **WHEN** the production build is inspected
- **THEN** `logo.svg` SHALL have unnecessary whitespace, comments, and metadata
  removed
