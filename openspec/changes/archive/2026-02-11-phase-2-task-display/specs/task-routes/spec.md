## ADDED Requirements

### Requirement: Home Page — Task Card Grid

The route at `src/routes/+page.svelte` SHALL be updated to display a grid of
task cards fetched from Nostr relays. The page MUST consume the singleton
`TaskListStore` from `src/lib/stores/tasks.svelte.ts`.

The page MUST:

1. Display task cards sorted by `totalPledged` descending (most funded first)
   by default
2. Show a `LoadingSpinner` while `taskList.loading` is `true`
3. Show an `EmptyState` component when `taskList.items` is empty and loading
   is complete
4. Render each task as a `TaskCard` component in a responsive grid layout (1
   column on mobile, 2 on tablet, 3 on desktop)

The route load function at `src/routes/+page.ts` MUST set `ssr = false` and
`prerender = false`.

#### Scenario: Home page shows loading state

- **WHEN** the home page is first loaded and task data is being fetched
- **THEN** a `LoadingSpinner` MUST be displayed

#### Scenario: Home page shows task cards

- **WHEN** task data has loaded with 5 tasks
- **THEN** 5 `TaskCard` components MUST be rendered in a grid

#### Scenario: Home page sorts by total pledged

- **WHEN** tasks have varying `totalPledged` values (e.g., 1000, 5000, 3000)
- **THEN** the cards MUST be ordered 5000, 3000, 1000 (descending)

#### Scenario: Home page shows empty state

- **WHEN** no tasks exist on connected relays
- **THEN** an `EmptyState` MUST be displayed with a message like "No tasks
  yet. Be the first to create one!"

#### Scenario: Responsive grid layout

- **WHEN** the viewport is mobile-sized (< 640px)
- **THEN** the grid MUST display 1 column
- **WHEN** the viewport is tablet-sized (640px–1024px)
- **THEN** the grid MUST display 2 columns
- **WHEN** the viewport is desktop-sized (> 1024px)
- **THEN** the grid MUST display 3 columns

---

### Requirement: Task Detail Page — naddr Routing

The route at `src/routes/task/[naddr]/+page.svelte` SHALL render the full
task detail view. The route parameter `naddr` MUST be a NIP-19 encoded address
(`naddr1...`).

The load function at `src/routes/task/[naddr]/+page.ts` MUST:

1. Decode the `naddr` parameter using `nip19.decode()` from `nostr-tools`
2. Validate that the decoded type is `"naddr"`
3. Extract `kind`, `pubkey`, `identifier` (d-tag), and optional `relays` from
   the decoded data
4. Construct the task address as `"${kind}:${pubkey}:${identifier}"`
5. Return the decoded data to the page component
6. Throw a 400 error if the naddr is invalid
7. Throw a 404 error if decoding fails entirely

The load function MUST set `ssr = false` and `prerender = false`.

```typescript
export const load: PageLoad = ({ params }) => {
  const decoded = nip19.decode(params.naddr);
  if (decoded.type !== "naddr") throw error(400, "Invalid task address");
  return {
    taskAddress:
      `${decoded.data.kind}:${decoded.data.pubkey}:${decoded.data.identifier}`,
    kind: decoded.data.kind,
    pubkey: decoded.data.pubkey,
    dTag: decoded.data.identifier,
    relays: decoded.data.relays ?? [],
  };
};
```

#### Scenario: Valid naddr decodes successfully

- **WHEN** the URL contains a valid `naddr1...` parameter encoding kind 37300
- **THEN** the load function MUST return the decoded task address, kind,
  pubkey, dTag, and relays

#### Scenario: Invalid naddr returns 400

- **WHEN** the URL contains a valid NIP-19 string but the type is `"npub"`
  instead of `"naddr"`
- **THEN** the load function MUST throw a 400 error with message "Invalid task
  address"

#### Scenario: Malformed parameter returns 404

- **WHEN** the URL contains a string that cannot be decoded by `nip19.decode()`
- **THEN** the load function MUST throw a 404 error with message "Task not
  found"

---

### Requirement: Task Detail Page — Component Composition

The page component at `src/routes/task/[naddr]/+page.svelte` MUST:

1. Instantiate or use a `TaskDetailStore` and call `load()` with the decoded
   task address
2. Display a `LoadingSpinner` while the store is loading
3. Display the `TaskDetail` component when data is available
4. Display an error message if the store has an error
5. Call `destroy()` on the store when the component is destroyed (cleanup
   subscriptions)

#### Scenario: Detail page loads task data

- **WHEN** the detail page is navigated to with a valid naddr
- **THEN** the `TaskDetailStore` MUST be loaded with the decoded task
  address
- **AND** relay subscriptions for pledges, solutions, votes, and payouts MUST be
  initiated

#### Scenario: Detail page shows loading state

- **WHEN** the task detail is being fetched
- **THEN** a `LoadingSpinner` MUST be displayed

#### Scenario: Detail page shows task content

- **WHEN** the task detail has loaded
- **THEN** the `TaskDetail` component MUST be rendered with the full task
  data

#### Scenario: Detail page cleans up on navigation

- **WHEN** the user navigates away from the task detail page
- **THEN** all relay subscriptions for that task MUST be unsubscribed

---

### Requirement: Profile Page — npub Routing

The route at `src/routes/profile/[npub]/+page.svelte` SHALL render a user
profile showing their tasks and solutions.

The load function at `src/routes/profile/[npub]/+page.ts` MUST:

1. Decode the `npub` parameter using `nip19.decode()` from `nostr-tools`
2. Validate that the decoded type is `"npub"`
3. Extract the hex pubkey from the decoded data
4. Return the pubkey to the page component
5. Throw a 400 error if the npub is invalid

The load function MUST set `ssr = false` and `prerender = false`.

#### Scenario: Valid npub decodes successfully

- **WHEN** the URL contains a valid `npub1...` parameter
- **THEN** the load function MUST return the decoded hex pubkey

#### Scenario: Invalid npub returns 400

- **WHEN** the URL contains a valid NIP-19 string but the type is `"naddr"`
  instead of `"npub"`
- **THEN** the load function MUST throw a 400 error with message "Invalid
  profile address"

---

### Requirement: Profile Page — Content Display

The profile page component MUST:

1. Fetch the user's Kind 0 profile metadata (name, display name, picture, nip05)
2. Fetch the user's Kind 37300 tasks using `taskByAuthorFilter(pubkey)`
3. Display the user's profile information (avatar, name, npub)
4. Display a list of the user's tasks as `TaskCard` components
5. Show loading and empty states appropriately

#### Scenario: Profile shows user's tasks

- **WHEN** a user has published 3 tasks
- **THEN** the profile page MUST display 3 `TaskCard` components

#### Scenario: Profile shows empty state for no tasks

- **WHEN** a user has published no tasks
- **THEN** an `EmptyState` MUST be shown with a message like "No tasks
  created yet"

#### Scenario: Profile shows user metadata

- **WHEN** a Kind 0 profile event exists for the pubkey with `name: "alice"` and
  `picture: "https://example.com/avatar.jpg"`
- **THEN** the profile page MUST display the name "alice" and the avatar image

#### Scenario: Profile shows truncated npub as fallback

- **WHEN** no Kind 0 profile event exists for the pubkey
- **THEN** the profile page MUST display the truncated npub (e.g.,
  `npub1abc...xyz`)

---

### Requirement: All Route Load Functions Disable SSR

All `+page.ts` load functions created in Phase 2 MUST export `ssr = false` and
`prerender = false` to ensure client-side only execution, consistent with the
static SPA architecture.

#### Scenario: SSR is disabled on all new routes

- **WHEN** any `+page.ts` file in `src/routes/task/[naddr]/` or
  `src/routes/profile/[npub]/` is inspected
- **THEN** it MUST contain `export const ssr = false` and
  `export const prerender = false`
