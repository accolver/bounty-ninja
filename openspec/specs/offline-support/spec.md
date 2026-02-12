## ADDED Requirements

### Requirement: Service Worker for Static Assets

A service worker SHALL be implemented using Workbox to cache all static assets
(HTML, CSS, JavaScript, images, fonts) for offline access. The service worker
MUST use a cache-first strategy for static assets and a network-first strategy
for relay WebSocket connections. The service worker SHALL be registered in the
root layout on application startup.

#### Scenario: Static assets served from cache when offline

- **WHEN** the user has previously visited the application (service worker
  installed)
- **AND** the user's device loses network connectivity
- **THEN** navigating to any route SHALL load the cached HTML, CSS, and
  JavaScript
- **AND** the application shell SHALL render without network access

#### Scenario: Service worker installs on first visit

- **WHEN** a user visits bounty.ninja for the first time
- **THEN** the service worker SHALL be registered and begin caching static
  assets
- **AND** the service worker installation SHALL NOT block the initial page
  render

#### Scenario: Service worker updates on new deployment

- **WHEN** a new version of the application is deployed
- **AND** a user with a cached version visits the site
- **THEN** the service worker SHALL detect the update and download new assets in
  the background
- **AND** a non-intrusive banner SHALL appear: "New version available. Refresh
  to update."
- **AND** clicking the banner SHALL activate the new service worker and reload
  the page

### Requirement: Offline Data Display from IndexedDB Cache

When the application detects that all Nostr relays are unreachable, it MUST
display cached data from IndexedDB with a clear visual indicator that the data
may be stale. The application MUST NOT crash or show a blank screen when
offline.

#### Scenario: All relays unreachable on startup

- **WHEN** the application starts and cannot connect to any configured Nostr
  relay
- **THEN** the application SHALL load events from the IndexedDB cache
- **AND** display tasks, pledges, solutions, and votes from cached data
- **AND** a persistent banner SHALL appear at the top: "Offline — showing cached
  data. Reconnecting..."

#### Scenario: Relays disconnect during active session

- **WHEN** the user is actively browsing and all relay WebSocket connections
  drop
- **THEN** the currently displayed data SHALL remain visible
- **AND** the offline banner SHALL appear
- **AND** the application SHALL attempt reconnection with exponential backoff
  (1s, 2s, 4s, 8s, max 30s)

#### Scenario: Relay reconnection succeeds

- **WHEN** the application is in offline mode and a relay becomes reachable
- **THEN** the offline banner SHALL be dismissed
- **AND** the application SHALL re-subscribe to active queries
- **AND** new events from relays SHALL merge with cached data
- **AND** a brief toast SHALL appear: "Back online"

### Requirement: Write Operation Queuing When Offline

When the user attempts a write operation (create task, pledge, submit
solution, vote) while offline, the application MUST inform the user that the
action cannot be completed and SHALL NOT silently discard the input.

#### Scenario: User attempts to create task while offline

- **WHEN** the user fills out the task creation form and clicks submit while
  offline
- **THEN** the application SHALL display a toast: "You're offline. Your task
  will be published when connectivity is restored."
- **AND** the form data SHALL be preserved (not cleared)
- **AND** the form SHALL remain open so the user can retry when online

#### Scenario: User attempts to vote while offline

- **WHEN** the user clicks a vote button while offline
- **THEN** the vote button SHALL show a tooltip: "Voting requires an active
  relay connection"
- **AND** the vote SHALL NOT be recorded locally

### Requirement: Offline Status Detection

The application MUST detect offline status through two mechanisms:

1. The browser's `navigator.onLine` API for network-level connectivity
2. Relay connection state from the Applesauce `RelayPool` for Nostr-level
   connectivity

The application SHALL be considered "offline" when either all relays are
disconnected OR `navigator.onLine` is `false`.

#### Scenario: Browser reports offline

- **WHEN** `navigator.onLine` transitions from `true` to `false`
- **THEN** the application SHALL immediately show the offline banner
- **AND** disable all write operations

#### Scenario: Browser online but all relays disconnected

- **WHEN** `navigator.onLine` is `true` but all relay WebSocket connections are
  closed
- **THEN** the application SHALL show the offline banner with message: "Relays
  unreachable — showing cached data. Reconnecting..."
- **AND** write operations SHALL be disabled

#### Scenario: At least one relay connected

- **WHEN** at least one relay WebSocket connection is in the `OPEN` state
- **THEN** the application SHALL be considered online
- **AND** the offline banner SHALL NOT be displayed
- **AND** write operations SHALL be enabled

### Requirement: Graceful Degradation of Features

When offline, features that require relay connectivity MUST degrade gracefully
rather than crash or show errors.

#### Scenario: Search is unavailable offline

- **WHEN** the user attempts to use the search bar while offline
- **THEN** the search bar SHALL display placeholder text: "Search unavailable
  offline"
- **AND** the search input SHALL be disabled

#### Scenario: Profile page shows cached data

- **WHEN** the user navigates to a profile page while offline
- **AND** the profile's Kind 0 event is in the IndexedDB cache
- **THEN** the profile SHALL render with cached data
- **AND** a note SHALL appear: "Showing cached profile. Some data may be
  outdated."

#### Scenario: Profile page with no cached data

- **WHEN** the user navigates to a profile page while offline
- **AND** no Kind 0 event for that pubkey exists in the cache
- **THEN** an empty state SHALL display: "Profile unavailable offline"
