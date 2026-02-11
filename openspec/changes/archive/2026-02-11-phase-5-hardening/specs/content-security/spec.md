## ADDED Requirements

### Requirement: XSS-Safe Markdown Sanitization

The `Markdown.svelte` component MUST sanitize all rendered HTML output using
DOMPurify before inserting it into the DOM. The markdown rendering pipeline
SHALL be: raw markdown string -> markdown-to-HTML parser -> DOMPurify
sanitization -> DOM insertion. DOMPurify MUST be configured to strip all
`<script>`, `<iframe>`, `<object>`, `<embed>`, `<form>`, and `<style>` tags.
Event handler attributes (`onclick`, `onerror`, `onload`, etc.) MUST be stripped
from all elements.

#### Scenario: Script tag in bounty description is stripped

- **WHEN** a bounty's `content` field contains `<script>alert('xss')</script>`
- **THEN** the rendered output SHALL NOT contain any `<script>` element
- **AND** no JavaScript SHALL execute

#### Scenario: Image tag with onerror handler is sanitized

- **WHEN** a bounty's `content` field contains
  `<img src="x" onerror="alert('xss')">`
- **THEN** the rendered output SHALL contain the `<img>` tag with the `src`
  attribute
- **AND** the `onerror` attribute SHALL be stripped

#### Scenario: Markdown link with javascript protocol is neutralized

- **WHEN** a bounty's `content` field contains
  `[click me](javascript:alert('xss'))`
- **THEN** the rendered link SHALL NOT have an `href` starting with
  `javascript:`
- **AND** the link SHALL either be stripped or have its href removed

#### Scenario: Nested encoding attack is blocked

- **WHEN** a bounty's `content` field contains double-encoded or nested XSS
  payloads such as `<img src="x" onerror="&#x61;lert('xss')">`
- **THEN** DOMPurify SHALL decode and strip the malicious attribute

#### Scenario: Legitimate markdown renders correctly

- **WHEN** a bounty's `content` field contains standard markdown (headings,
  bold, italic, code blocks, links, images, lists, tables)
- **THEN** all standard markdown elements SHALL render correctly
- **AND** external image URLs SHALL render as `<img>` tags
- **AND** external links SHALL render as `<a>` tags with `target="_blank"` and
  `rel="noopener noreferrer"`

### Requirement: DOMPurify Configuration

DOMPurify SHALL be configured with the following options:

- `ALLOWED_TAGS`: Standard HTML elements produced by markdown rendering (p,
  h1-h6, a, img, ul, ol, li, code, pre, blockquote, table, thead, tbody, tr, th,
  td, em, strong, del, br, hr, details, summary)
- `ALLOWED_ATTR`: `href`, `src`, `alt`, `title`, `class`, `id`, `target`, `rel`
- `ALLOW_DATA_ATTR`: `false`
- `ADD_ATTR`: `["target"]` (for links opening in new tab)
- `FORBID_TAGS`:
  `["script", "iframe", "object", "embed", "form", "style", "input",
  "textarea", "select", "button"]`
- `FORBID_ATTR`:
  `["onerror", "onclick", "onload", "onmouseover", "onfocus",
  "onblur"]`

#### Scenario: Data attributes are stripped

- **WHEN** markdown output contains elements with `data-*` attributes
- **THEN** all `data-*` attributes SHALL be removed from the sanitized output

#### Scenario: Iframe injection is blocked

- **WHEN** a bounty's `content` field contains
  `<iframe src="https://evil.com"></iframe>`
- **THEN** the `<iframe>` element SHALL be completely removed from the output

### Requirement: Input Validation for User-Submitted Content

All user-submitted text fields (bounty title, bounty description, solution
content, pledge message) MUST be validated for maximum length before event
signing. The bounty title MUST NOT exceed 200 characters. The bounty description
MUST NOT exceed 50,000 characters. Solution content MUST NOT exceed 100,000
characters.

#### Scenario: Bounty title exceeds maximum length

- **WHEN** a user enters a bounty title longer than 200 characters
- **THEN** the form SHALL display a validation error: "Title must be 200
  characters or less"
- **AND** the form SHALL NOT allow submission

#### Scenario: Bounty description at maximum length

- **WHEN** a user enters a bounty description of exactly 50,000 characters
- **THEN** the form SHALL accept the input without error

### Requirement: Content Security Policy Headers

The production deployment MUST serve Content Security Policy headers that
restrict resource loading to trusted origins. The CSP policy SHALL include:

- `default-src 'self'`
- `script-src 'self'` (no `'unsafe-inline'`, no `'unsafe-eval'`)
- `style-src 'self' 'unsafe-inline'` (required for Tailwind CSS runtime styles)
- `img-src 'self' https: data:` (allow external images in markdown and data
  URIs)
- `connect-src 'self' wss: https:` (allow WebSocket connections to Nostr relays
  and HTTPS to Cashu mints)
- `font-src 'self'`
- `object-src 'none'`
- `frame-src 'none'`
- `base-uri 'self'`
- `form-action 'none'`

#### Scenario: Inline script blocked by CSP

- **WHEN** a malicious inline script somehow bypasses DOMPurify
- **THEN** the browser's CSP enforcement SHALL block its execution
- **AND** a CSP violation report SHALL appear in the browser console

#### Scenario: WebSocket connections to relays are allowed

- **WHEN** the app attempts to connect to a Nostr relay via
  `wss://relay.example.com`
- **THEN** the CSP `connect-src` directive SHALL allow the connection

#### Scenario: Cashu mint HTTPS requests are allowed

- **WHEN** the app sends an HTTPS request to a Cashu mint for token verification
- **THEN** the CSP `connect-src` directive SHALL allow the request

### Requirement: Additional Security Headers

The production deployment MUST serve the following additional security headers:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`

#### Scenario: App cannot be embedded in iframe

- **WHEN** a third-party site attempts to embed tasks.fyi in an iframe
- **THEN** the browser SHALL block the embedding due to `X-Frame-Options: DENY`
