## ADDED Requirements

### Requirement: Cloudflare Pages Static Hosting

The application SHALL be deployed to Cloudflare Pages as a static site. A
deployment configuration file SHALL exist at the project root (e.g.,
`wrangler.toml` or Cloudflare Pages project settings) that configures the build
command (`bun run build`), output directory (`build/`), and Node.js
compatibility.

#### Scenario: Production build deploys to Cloudflare Pages

- **WHEN** a commit is pushed to the `main` branch
- **THEN** Cloudflare Pages SHALL trigger a build using `bun run build`
- **AND** deploy the contents of the `build/` directory
- **AND** the site SHALL be accessible at the configured domain

#### Scenario: Preview deployments for pull requests

- **WHEN** a pull request is opened against the `main` branch
- **THEN** Cloudflare Pages SHALL create a preview deployment
- **AND** the preview SHALL be accessible at a unique URL

### Requirement: Custom Domain Configuration

The production deployment MUST be accessible at `https://tasks.fyi`. The domain
MUST be configured with:

- HTTPS enforced (automatic via Cloudflare)
- `www.tasks.fyi` redirecting to `tasks.fyi`
- HSTS (HTTP Strict Transport Security) enabled with `max-age=31536000`

#### Scenario: HTTPS is enforced

- **WHEN** a user navigates to `http://tasks.fyi`
- **THEN** the request SHALL be redirected to `https://tasks.fyi` with a 301
  status

#### Scenario: www subdomain redirects

- **WHEN** a user navigates to `https://www.tasks.fyi`
- **THEN** the request SHALL be redirected to `https://tasks.fyi` with a 301
  status

### Requirement: Security Headers Configuration

The hosting platform MUST be configured to serve security headers on all
responses. These headers SHALL be defined in a `_headers` file (Cloudflare Pages
convention) or equivalent configuration.

Required headers:

- `Content-Security-Policy` as specified in the content-security spec
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`

#### Scenario: Headers file is included in build output

- **WHEN** `bun run build` completes
- **THEN** a `_headers` file SHALL exist in the `build/` output directory
- **AND** it SHALL contain all required security headers

#### Scenario: CSP header is served on all HTML responses

- **WHEN** a browser requests any HTML page from tasks.fyi
- **THEN** the response SHALL include a `Content-Security-Policy` header
- **AND** the policy SHALL match the specification in the content-security spec

### Requirement: SPA Fallback Routing

The hosting platform MUST be configured to serve `index.html` for all routes
that do not match a static file. This enables SvelteKit's client-side routing
for paths like `/bounty/naddr1...` and `/profile/npub1...`.

#### Scenario: Deep link to bounty detail page

- **WHEN** a user navigates directly to `https://tasks.fyi/bounty/naddr1abc123`
- **THEN** the server SHALL respond with `index.html`
- **AND** SvelteKit's client-side router SHALL handle the route
- **AND** the bounty detail page SHALL render correctly

#### Scenario: 404 for truly missing resources

- **WHEN** a browser requests a non-existent static file (e.g.,
  `/missing-file.js`)
- **THEN** the server SHALL respond with a 404 status

### Requirement: Build Optimization for Production

The production build MUST include the following optimizations:

- Precompressed assets (`.gz` and `.br` files) via `adapter-static`
  `precompress: true`
- Minified JavaScript and CSS
- Content-hashed filenames for cache busting (Vite default behavior)
- Long-lived cache headers for hashed assets
  (`Cache-Control: public, max-age=31536000, immutable`)
- Short cache for `index.html`
  (`Cache-Control: public, max-age=0, must-revalidate`)

#### Scenario: Hashed assets have immutable cache headers

- **WHEN** a browser requests a JavaScript file with a content hash in its
  filename (e.g., `app.a1b2c3d4.js`)
- **THEN** the response SHALL include
  `Cache-Control: public, max-age=31536000, immutable`

#### Scenario: index.html is not aggressively cached

- **WHEN** a browser requests `/index.html` or `/`
- **THEN** the response SHALL include
  `Cache-Control: public, max-age=0, must-revalidate`
- **AND** the browser SHALL revalidate on every visit to pick up new deployments

### Requirement: Redirects Configuration

A `_redirects` file SHALL exist in the `static/` directory (copied to `build/`
at build time) to handle SPA fallback routing and domain redirects.

#### Scenario: SPA fallback redirect

- **WHEN** a request arrives for a path that does not match a static file
- **THEN** the `_redirects` rule SHALL serve `index.html` with a 200 status

### Requirement: Lighthouse Audit Targets

The deployed production site MUST achieve the following Lighthouse scores:

- Performance > 90
- Accessibility > 90
- Best Practices > 90

#### Scenario: Lighthouse Performance audit passes

- **WHEN** a Lighthouse audit is run against `https://tasks.fyi`
- **THEN** the Performance score SHALL be greater than 90

#### Scenario: Lighthouse Accessibility audit passes

- **WHEN** a Lighthouse audit is run against `https://tasks.fyi`
- **THEN** the Accessibility score SHALL be greater than 90

#### Scenario: Lighthouse Best Practices audit passes

- **WHEN** a Lighthouse audit is run against `https://tasks.fyi`
- **THEN** the Best Practices score SHALL be greater than 90

### Requirement: CI/CD Pipeline

The deployment pipeline MUST run the full test suite before deploying to
production. The pipeline SHALL execute in order:

1. `bun install` — install dependencies
2. `bun run check` — TypeScript and Svelte type checking
3. `bun run lint` — ESLint
4. `bun run test:unit` — unit tests
5. `bun run test:integration` — integration tests
6. `bun run build` — production build
7. Bundle size check (fail if > 200KB gzipped)
8. Deploy to Cloudflare Pages

#### Scenario: Tests must pass before deployment

- **WHEN** a unit test or integration test fails in the CI pipeline
- **THEN** the deployment SHALL be aborted
- **AND** the pipeline SHALL report the failure

#### Scenario: Build succeeds and deploys

- **WHEN** all checks, tests, and the build succeed
- **THEN** the `build/` output SHALL be deployed to Cloudflare Pages
- **AND** the deployment SHALL be accessible at `https://tasks.fyi`
