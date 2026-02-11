## ADDED Requirements

### Requirement: NIP-50 Search State Store

The application SHALL provide a reactive search state store at
`src/lib/stores/search.svelte.ts` that manages NIP-50 full-text search queries
against a dedicated search relay.

The store SHALL be implemented as a class-based Svelte 5 runes store using
`$state` and `$derived` for reactivity.

The store SHALL connect to the relay specified by the `PUBLIC_SEARCH_RELAY`
environment variable (default: `wss://relay.nostr.band`) to issue NIP-50 search
subscriptions.

The store SHALL construct Nostr filters with the `search` field set to the
user's query string and `kinds` set to `[37300]` (bounty events only), as
defined in `searchBountiesFilter()` from `src/lib/bounty/filters.ts`.

The store SHALL expose the following reactive properties: `results` (array of
`BountySummary`), `loading` (boolean), `error` (string or null), and `query`
(current search string).

The store SHALL cancel any in-flight search subscription when a new query is
issued.

#### Scenario: Successful NIP-50 search

- **WHEN** a user submits a search query and the search relay supports NIP-50
- **THEN** the store SHALL issue a REQ with
  `{ kinds: [37300], search: "<query>", limit: 20 }` to `PUBLIC_SEARCH_RELAY`
- **THEN** the store SHALL parse returned events into `BountySummary` objects
  and expose them via the `results` property
- **THEN** the `loading` property SHALL transition from `true` to `false` upon
  receiving EOSE

#### Scenario: Search relay unavailable — client-side fallback

- **WHEN** the search relay is unreachable or does not respond within 5 seconds
- **THEN** the store SHALL fall back to client-side filtering of events already
  cached in the Applesauce `EventStore`
- **THEN** the client-side filter SHALL match the query string against bounty
  `title` and `tags` fields (case-insensitive substring match)
- **THEN** the `error` property SHALL be set to a descriptive message indicating
  fallback mode

#### Scenario: Empty search results

- **WHEN** a search query returns zero matching events from both NIP-50 and
  client-side fallback
- **THEN** the `results` property SHALL be an empty array
- **THEN** the `loading` property SHALL be `false`

### Requirement: SearchBar Component

The application SHALL provide a `SearchBar.svelte` component at
`src/lib/components/search/SearchBar.svelte` that accepts user text input and
triggers NIP-50 search queries.

The SearchBar SHALL debounce user input by 300 milliseconds before dispatching a
search query to the search store.

The SearchBar SHALL support two visual variants: a "hero" variant for the home
page (larger, centered) and a "compact" variant for the Header (smaller,
inline).

The SearchBar SHALL navigate to `/search?q=<encoded-query>` on form submission
(Enter key or submit button).

The SearchBar SHALL be accessible with `role="search"`, an associated `<label>`
(visually hidden if needed), and `aria-label="Search bounties"`.

#### Scenario: User types a search query

- **WHEN** a user types into the SearchBar input field
- **THEN** the component SHALL wait 300ms after the last keystroke before
  updating the search store query
- **THEN** the component SHALL display a loading indicator while the search is
  in progress

#### Scenario: User submits search form

- **WHEN** a user presses Enter or clicks the search button
- **THEN** the browser SHALL navigate to `/search?q=<url-encoded-query>`

#### Scenario: Empty input

- **WHEN** the search input is cleared
- **THEN** the search store SHALL reset its results to an empty array and clear
  any error state

### Requirement: Search Results Page

The application SHALL provide a search results page at
`src/routes/search/+page.svelte` that displays bounties matching the user's
query.

The page load function at `src/routes/search/+page.ts` SHALL read the `q` query
parameter from the URL and initialize the search store with that query.

The SearchResults component at `src/lib/components/search/SearchResults.svelte`
SHALL render matching bounties as `BountyCard` components.

The search results page SHALL provide filter controls for: bounty status (open,
completed, all) and minimum reward amount.

The search results page SHALL display the total number of results found.

#### Scenario: Search results with filters

- **WHEN** a user navigates to `/search?q=lightning` and selects status filter
  "open"
- **THEN** the page SHALL display only bounties matching "lightning" that have
  status `draft` or `open`
- **THEN** the result count SHALL reflect the filtered total

#### Scenario: Search results loading state

- **WHEN** the search page is loading results
- **THEN** the page SHALL display skeleton placeholder cards (minimum 3) to
  indicate loading

#### Scenario: Search results empty state

- **WHEN** no bounties match the search query
- **THEN** the page SHALL display an `EmptyState` component with the message "No
  bounties found for '<query>'" and a suggestion to try different keywords

#### Scenario: Direct URL access

- **WHEN** a user navigates directly to `/search?q=cashu`
- **THEN** the page SHALL execute the search immediately on load and display
  results without requiring additional user interaction

### Requirement: Home Page Category Filtering

The home page SHALL display category filter tabs derived from the `t` tags of
cached bounty events.

The category tabs SHALL include an "All" tab (default, showing all bounties)
plus tabs for the most common tags (e.g., "development", "design",
"documentation", "writing").

Selecting a category tab SHALL filter the displayed bounty list to only show
bounties with a matching `t` tag.

Category filtering SHALL be performed client-side against events in the
Applesauce `EventStore`.

#### Scenario: Category tab selection

- **WHEN** a user clicks the "development" category tab on the home page
- **THEN** only bounties with a `["t", "development"]` tag SHALL be displayed
- **THEN** the "development" tab SHALL be visually highlighted as active

#### Scenario: All tab resets filter

- **WHEN** a user clicks the "All" category tab
- **THEN** all bounties SHALL be displayed regardless of tags

### Requirement: Home Page Hero Search

The home page SHALL display a hero-variant SearchBar component prominently above
the bounty list.

The hero SearchBar SHALL be visually larger than the Header SearchBar and
include placeholder text "Search bounties...".

#### Scenario: Hero search interaction

- **WHEN** a user types a query into the hero SearchBar and presses Enter
- **THEN** the browser SHALL navigate to `/search?q=<query>`
