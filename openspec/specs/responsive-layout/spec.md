## ADDED Requirements

### Requirement: Responsive Breakpoint Strategy

The application SHALL use Tailwind CSS responsive breakpoints for a mobile-first
layout strategy:

- **Mobile** (default): 0–639px — single-column layout, bottom navigation
- **Tablet** (`sm`): 640px–1023px — single-column layout, top navigation
- **Desktop** (`lg`): 1024px+ — two-column layout with sidebar, top navigation

All layout components SHALL be implemented mobile-first, with progressive
enhancement for larger screens using Tailwind responsive prefixes (`sm:`,
`lg:`).

#### Scenario: Mobile viewport

- **WHEN** the viewport width is below 640px
- **THEN** the layout SHALL display a single-column content area
- **THEN** the `MobileNav` bottom navigation SHALL be visible
- **THEN** the `Header` SHALL hide the inline SearchBar and show a search icon
  that expands to a full-width search overlay
- **THEN** the `Sidebar` SHALL NOT be rendered

#### Scenario: Tablet viewport

- **WHEN** the viewport width is between 640px and 1023px
- **THEN** the layout SHALL display a single-column content area
- **THEN** the `Header` SHALL display the inline compact SearchBar
- **THEN** the `MobileNav` SHALL NOT be rendered
- **THEN** the `Sidebar` SHALL NOT be rendered

#### Scenario: Desktop viewport

- **WHEN** the viewport width is 1024px or greater
- **THEN** the layout SHALL display a two-column layout: `Sidebar` on the left
  (fixed width 256px) and main content on the right
- **THEN** the `Header` SHALL display the inline compact SearchBar
- **THEN** the `MobileNav` SHALL NOT be rendered

### Requirement: Sidebar Component

The application SHALL provide a `Sidebar.svelte` component at
`src/lib/components/layout/Sidebar.svelte` for desktop category and tag
filtering.

The Sidebar SHALL be rendered only on viewports 1024px and wider (`lg:`
breakpoint).

The Sidebar SHALL display a list of category/tag filters derived from the `t`
tags of bounty events in the `EventStore`.

Each category item SHALL display the tag name and a count of bounties with that
tag.

Selecting a category in the Sidebar SHALL filter the home page bounty list to
show only bounties with the matching `t` tag.

The Sidebar SHALL include a "Popular Tags" section showing the top 10 most-used
tags sorted by frequency.

#### Scenario: Sidebar category selection

- **WHEN** a user clicks "development" in the Sidebar on desktop
- **THEN** the home page bounty list SHALL filter to show only bounties tagged
  "development"
- **THEN** the selected category SHALL be visually highlighted

#### Scenario: Sidebar tag counts

- **WHEN** the EventStore contains bounties with tags ["development" x 5,
  "design" x 3, "writing" x 2]
- **THEN** the Sidebar SHALL display "development (5)", "design (3)", "writing
  (2)"

### Requirement: MobileNav Component

The application SHALL provide a `MobileNav.svelte` component at
`src/lib/components/layout/MobileNav.svelte` for bottom navigation on mobile
screens.

The MobileNav SHALL be rendered only on viewports below 640px (hidden at `sm:`
breakpoint and above).

The MobileNav SHALL be fixed to the bottom of the viewport with a solid
background and a top border.

The MobileNav SHALL contain navigation items for: Home (`/`), Search
(`/search`), Create (`/bounty/new`), and Settings (`/settings`).

Each navigation item SHALL display an icon and a label.

The active route SHALL be visually highlighted using the `--primary` color
token.

The MobileNav SHALL have a minimum touch target size of 44x44 pixels for each
navigation item per WCAG 2.1 AA guidelines.

#### Scenario: Mobile navigation

- **WHEN** a user is on a mobile device viewing the home page
- **THEN** the MobileNav SHALL be visible at the bottom of the screen
- **THEN** the "Home" item SHALL be highlighted as active
- **THEN** tapping "Search" SHALL navigate to `/search`

#### Scenario: MobileNav hidden on desktop

- **WHEN** the viewport width is 640px or greater
- **THEN** the MobileNav SHALL NOT be rendered in the DOM (using Tailwind
  `sm:hidden` or conditional rendering)

#### Scenario: Create button requires auth

- **WHEN** an unauthenticated user taps the "Create" navigation item
- **THEN** the application SHALL prompt the user to log in via NIP-07 before
  navigating to `/bounty/new`

### Requirement: Responsive Header

The `Header.svelte` component SHALL be updated to support responsive behavior
across all breakpoints.

On mobile (below 640px), the Header SHALL display: the logo (left), a search
icon button (right), and a login/profile button (right).

On tablet and desktop (640px+), the Header SHALL display: the logo (left), the
compact SearchBar (center), and the login/profile area (right).

The search icon on mobile SHALL expand to a full-width search overlay when
tapped, with a close button to dismiss.

#### Scenario: Mobile header search

- **WHEN** a user taps the search icon in the mobile Header
- **THEN** a full-width search input overlay SHALL appear over the Header
- **THEN** the user SHALL be able to type a query and press Enter to navigate to
  `/search?q=<query>`
- **THEN** tapping the close button or pressing Escape SHALL dismiss the overlay

#### Scenario: Desktop header layout

- **WHEN** the viewport is 640px or wider
- **THEN** the Header SHALL display the compact SearchBar inline between the
  logo and the auth controls

### Requirement: Content Area Padding for MobileNav

On mobile viewports where the MobileNav is displayed, the main content area
SHALL include bottom padding equal to the height of the MobileNav (minimum 64px)
to prevent content from being obscured by the fixed bottom navigation.

#### Scenario: Content not obscured by MobileNav

- **WHEN** a user scrolls to the bottom of the page on mobile
- **THEN** the last content item SHALL be fully visible above the MobileNav

### Requirement: Touch-Friendly Interactive Elements

All interactive elements (buttons, links, form controls) SHALL have a minimum
touch target size of 44x44 CSS pixels on mobile viewports, per WCAG 2.1 AA
Success Criterion 2.5.5.

#### Scenario: Button touch targets

- **WHEN** the viewport is below 640px
- **THEN** all buttons and tappable elements SHALL have a minimum size of
  44x44px (including padding)

### Requirement: Responsive Bounty Cards

`BountyCard.svelte` SHALL adapt its layout based on viewport width.

On mobile, bounty cards SHALL use a stacked vertical layout with title, status
badge, tags, reward amount, and time ago.

On desktop, bounty cards SHALL use a horizontal layout with more information
visible (e.g., solution count, pledge count alongside reward).

#### Scenario: Mobile bounty card

- **WHEN** the viewport is below 640px
- **THEN** the BountyCard SHALL display in a compact vertical stack layout
- **THEN** the card SHALL be full-width with appropriate padding

#### Scenario: Desktop bounty card

- **WHEN** the viewport is 640px or wider
- **THEN** the BountyCard SHALL display additional metadata inline (solution
  count, pledge count)
