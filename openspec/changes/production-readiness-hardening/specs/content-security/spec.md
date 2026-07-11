## ADDED Requirements

### Requirement: Production Markdown Sanitization Path

`src/lib/components/shared/MarkdownViewer.svelte` SHALL disable raw HTML where supported and sanitize the final rendered output with the centralized DOMPurify policy before untrusted content reaches the DOM. Tests SHALL exercise the actual component rather than only the sanitizer utility.

#### Scenario: Unsafe Markdown protocol
- **WHEN** rendered Markdown contains a JavaScript, data-document, or encoded executable URL
- **THEN** the final DOM SHALL contain no executable link or handler

### Requirement: Event-Derived Resource Safety

Non-Markdown links and resources derived from Nostr events SHALL use the same safe URL policy. External links SHALL use `noopener noreferrer` and untrusted profile images SHALL not create script-capable resources.

#### Scenario: Unsafe solution link
- **WHEN** a solution deliverable URL has a disallowed scheme
- **THEN** it SHALL render without a clickable `href`

### Requirement: Hardened Script Policy

Production CSP SHALL include `script-src-attr 'none'` and SHALL remove broad inline script execution by moving, hashing, or otherwise explicitly authorizing the theme bootstrap. HTML and service-worker responses SHALL require revalidation.

#### Scenario: Inline event handler
- **WHEN** markup contains an inline event handler
- **THEN** CSP SHALL block execution even if sanitization regresses
