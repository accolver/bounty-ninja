## ADDED Requirements

### Requirement: Open Graph Meta Tags

The `src/app.html` file SHALL include Open Graph meta tags for social sharing
previews when the application URL is shared on social media platforms, messaging
apps, and link previews.

The following meta tags SHALL be present in the `<head>` of `app.html`:

- `<meta property="og:title" content="Bounty.ninja — Decentralized Task Board">`
- `<meta property="og:description" content="Post tasks, fund with bitcoin ecash, and pay solvers — all on Nostr. No middlemen, no accounts, no censorship.">`
- `<meta property="og:image" content="https://bounty.ninja/og-image.png">`
- `<meta property="og:url" content="https://bounty.ninja">`
- `<meta property="og:type" content="website">`
- `<meta property="og:site_name" content="Bounty.ninja">`

The following Twitter Card meta tags SHALL also be present:

- `<meta name="twitter:card" content="summary_large_image">`
- `<meta name="twitter:title" content="Bounty.ninja — Decentralized Task Board">`
- `<meta name="twitter:description" content="Post tasks, fund with bitcoin ecash, and pay solvers — all on Nostr.">`
- `<meta name="twitter:image" content="https://bounty.ninja/og-image.png">`

A general `<meta name="description">` tag SHALL be present with the same
description text.

#### Scenario: Social media share preview

- **WHEN** a user shares `https://bounty.ninja` on a social media platform
- **THEN** the platform SHALL render a preview card with the title "Bounty.ninja —
  Decentralized Task Board", the description, and the `og-image.png` image

#### Scenario: Search engine indexing

- **WHEN** a search engine crawls `https://bounty.ninja`
- **THEN** the crawler SHALL find the `<meta name="description">` tag and use it
  for search result snippets

### Requirement: Favicon

The application SHALL include a `favicon.ico` file at `static/favicon.ico`.

The `app.html` SHALL include a `<link rel="icon" href="/favicon.ico">` tag in
the `<head>`.

The favicon SHALL be recognizable at 16x16 and 32x32 pixel sizes.

For MVP, a placeholder favicon is acceptable, but it MUST be present (not the
default SvelteKit favicon).

#### Scenario: Browser tab icon

- **WHEN** a user opens Bounty.ninja in a browser tab
- **THEN** the browser tab SHALL display the Bounty.ninja favicon, not a generic or
  missing icon

### Requirement: Logo SVG

The application SHALL include a logo SVG file at `static/logo.svg`.

The logo SHALL be used in the `Header.svelte` component as the site logo linking
to `/`.

The logo SVG SHALL be optimized for web (no unnecessary metadata, reasonable
file size under 10KB).

The logo SHALL be legible at both small (24px height in Header) and large (48px
height on potential splash screens) sizes.

For MVP, a text-based SVG logo ("Bounty.ninja" in a styled font) is acceptable as a
placeholder.

The logo SHALL have sufficient contrast against both dark
(`--background: #1a1b26`) and light (`--background: #d5d6db`) theme backgrounds,
or SHALL adapt its fill color using `currentColor`.

#### Scenario: Logo in Header

- **WHEN** the Header component renders
- **THEN** the logo SVG SHALL be displayed at the left of the Header
- **THEN** clicking the logo SHALL navigate to `/`

#### Scenario: Logo theme compatibility

- **WHEN** the user switches between dark and light themes
- **THEN** the logo SHALL remain legible against the current background color

### Requirement: Open Graph Image

The application SHALL include an Open Graph preview image at
`static/og-image.png`.

The image SHALL be 1200x630 pixels (standard Open Graph recommended dimensions).

The image SHALL include the Bounty.ninja brand name and a brief tagline.

The image SHALL be optimized for web with a file size under 200KB.

For MVP, a simple branded image with the app name and tagline on a Tokyo Night
background is acceptable.

#### Scenario: OG image dimensions

- **WHEN** a social media platform fetches `https://bounty.ninja/og-image.png`
- **THEN** the image SHALL be 1200x630 pixels and render correctly in the
  preview card

### Requirement: HTML Document Title

The `app.html` SHALL set the document `<title>` to "Bounty.ninja — Decentralized
Task Board".

Individual pages MAY override the title using `<svelte:head>` to provide
page-specific titles (e.g., "Search Results — Bounty.ninja", "Settings —
Bounty.ninja").

#### Scenario: Default page title

- **WHEN** a user loads the home page
- **THEN** the browser tab title SHALL display "Bounty.ninja — Decentralized Task
  Board"

#### Scenario: Search page title

- **WHEN** a user navigates to `/search?q=lightning`
- **THEN** the browser tab title SHALL display "Search: lightning — Bounty.ninja"

### Requirement: Charset and Viewport Meta

The `app.html` SHALL include `<meta charset="utf-8">` and
`<meta name="viewport" content="width=device-width, initial-scale=1">` in the
`<head>`.

The viewport meta tag MUST NOT include `user-scalable=no` or `maximum-scale=1`
as these violate WCAG 2.1 AA Success Criterion 1.4.4 (Resize Text).

#### Scenario: Mobile viewport scaling

- **WHEN** a user pinch-zooms on a mobile device
- **THEN** the page SHALL zoom in as expected without being restricted by the
  viewport meta tag

### Requirement: Theme Color Meta

The `app.html` SHALL include a `<meta name="theme-color">` tag that matches the
current theme's background color.

For dark mode: `<meta name="theme-color" content="#1a1b26">`.

For light mode: `<meta name="theme-color" content="#d5d6db">`.

The theme-color meta tag SHALL be updated dynamically when the user toggles
themes.

#### Scenario: Mobile browser chrome color

- **WHEN** a user opens Bounty.ninja on a mobile browser that supports theme-color
- **THEN** the browser chrome (address bar area) SHALL match the app's
  background color
