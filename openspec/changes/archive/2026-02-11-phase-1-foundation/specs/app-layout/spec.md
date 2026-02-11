## ADDED Requirements

### Requirement: Root Layout Structure

`src/routes/+layout.svelte` MUST define the root layout shell containing a
`Header` component, a `<main>` content area that renders the page slot via
`{@render children()}`, and a `Footer` component. The layout MUST NOT use the
legacy `<slot />` syntax. The layout MUST apply a responsive container with
appropriate max-width and padding.

#### Scenario: Layout renders Header, content, and Footer

- **WHEN** any page in the application loads
- **THEN** the Header component is rendered at the top
- **AND** the page content is rendered in the `<main>` area
- **AND** the Footer component is rendered at the bottom

#### Scenario: Layout uses Svelte 5 render syntax

- **WHEN** `src/routes/+layout.svelte` is inspected
- **THEN** it uses `{@render children()}` for the content slot
- **AND** it does NOT contain `<slot />`

### Requirement: Root Layout Initialization

`src/routes/+layout.ts` MUST initialize the Nostr connectivity layer on app
load. It MUST call `connectDefaultRelays()` to establish relay connections and
initialize the IndexedDB cache. It MUST export `ssr = false` and
`prerender = false` to enforce client-side-only rendering.

#### Scenario: Nostr connectivity initializes on app load

- **WHEN** the application loads for the first time
- **THEN** `connectDefaultRelays()` is called
- **AND** the IndexedDB cache is initialized
- **AND** relay connections begin

#### Scenario: SSR is disabled

- **WHEN** `src/routes/+layout.ts` is inspected
- **THEN** it exports `export const ssr = false`
- **AND** it exports `export const prerender = false`

### Requirement: Header Component

`src/lib/components/layout/Header.svelte` MUST render a top navigation bar
containing:

1. The Tasks.fyi logo/wordmark linking to the home page (`/`)
2. A `LoginButton` component when the user is logged out
3. The user's truncated npub when the user is logged in

The Header MUST be responsive and MUST use semantic HTML (`<header>`, `<nav>`).
The Header MUST be keyboard navigable.

#### Scenario: Header shows login button when logged out

- **WHEN** the user is not authenticated
- **THEN** the Header displays the `LoginButton` component
- **AND** the logo links to `/`

#### Scenario: Header shows npub when logged in

- **WHEN** the user is authenticated with a pubkey
- **THEN** the Header displays the user's truncated npub (e.g.,
  `npub1abc...xyz`)
- **AND** the `LoginButton` is not rendered

#### Scenario: Header uses semantic HTML

- **WHEN** `Header.svelte` is inspected
- **THEN** it uses `<header>` as the root element
- **AND** navigation links are within a `<nav>` element

#### Scenario: Header logo navigates to home

- **WHEN** the user clicks the Tasks.fyi logo in the Header
- **THEN** the application navigates to `/`

### Requirement: Footer Component

`src/lib/components/layout/Footer.svelte` MUST render a footer containing the
`RelayStatus` component that displays the connection status of each configured
relay. The Footer MUST use semantic HTML (`<footer>`).

#### Scenario: Footer displays relay status

- **WHEN** the application is running with relay connections
- **THEN** the Footer renders the `RelayStatus` component
- **AND** each configured relay's connection state is visible

#### Scenario: Footer uses semantic HTML

- **WHEN** `Footer.svelte` is inspected
- **THEN** it uses `<footer>` as the root element

### Requirement: RelayStatus Component

`src/lib/components/shared/RelayStatus.svelte` MUST display the connection
status of each relay in the `RelayPool`. Each relay MUST be represented with its
URL (or a shortened form) and a color-coded indicator: green (`--color-success`)
for connected, red (`--color-destructive`) for disconnected. The component MUST
update reactively as relay connection states change.

#### Scenario: Connected relay shows green indicator

- **WHEN** a relay WebSocket connection is established and open
- **THEN** the relay's status indicator is green (using `--color-success`)
- **AND** the relay URL is displayed

#### Scenario: Disconnected relay shows red indicator

- **WHEN** a relay WebSocket connection fails or is closed
- **THEN** the relay's status indicator is red (using `--color-destructive`)

#### Scenario: Status updates reactively

- **WHEN** a relay connection transitions from connected to disconnected (or
  vice versa)
- **THEN** the indicator color updates without requiring a page reload

#### Scenario: RelayStatus is accessible

- **WHEN** the `RelayStatus` component is rendered
- **THEN** each relay status has an `aria-label` describing the relay name and
  its connection state (e.g., "relay.damus.io: connected")

### Requirement: Responsive Layout

The root layout MUST be responsive across viewport sizes. On mobile viewports (<
640px), the layout MUST stack vertically with appropriate padding. On desktop
viewports (>= 1024px), the content area MUST be centered with a max-width
constraint. The layout MUST NOT have horizontal overflow at any viewport width.

#### Scenario: Mobile layout is single-column

- **WHEN** the viewport width is less than 640px
- **THEN** the layout renders in a single column
- **AND** content has appropriate horizontal padding (at least 16px)
- **AND** no horizontal scrollbar appears

#### Scenario: Desktop layout is centered

- **WHEN** the viewport width is 1280px or greater
- **THEN** the main content area is centered with a max-width constraint
- **AND** the Header and Footer span the full width

### Requirement: Keyboard Navigation

All interactive elements in the layout (Header links, LoginButton, RelayStatus
indicators) MUST be reachable via keyboard Tab navigation in a logical order.
The Tab order MUST follow the visual layout: Header elements first, then page
content, then Footer elements.

#### Scenario: Tab order follows visual layout

- **WHEN** the user presses Tab repeatedly from the top of the page
- **THEN** focus moves through Header elements (logo, login/profile)
- **AND** then through page content interactive elements
- **AND** then through Footer elements

#### Scenario: All interactive elements are focusable

- **WHEN** the user navigates the page using only the keyboard
- **THEN** every clickable element (links, buttons) is reachable via Tab
- **AND** every focusable element displays a visible focus indicator
