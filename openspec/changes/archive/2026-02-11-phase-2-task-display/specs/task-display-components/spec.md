## ADDED Requirements

### Requirement: TaskCard Component

The component at `src/lib/components/task/TaskCard.svelte` SHALL render a
summary card for a single task in list views. It MUST accept a `TaskSummary`
via `$props()`.

The card MUST display:

- Task title (truncated to 2 lines with CSS)
- `TaskStatusBadge` showing the derived status
- `TaskTags` showing category tags
- `SatAmount` showing total pledged sats
- Solution count
- `TimeAgo` showing time since creation
- Reward amount (target reward from the `reward` tag)

The card MUST be an `<a>` element or contain a link navigating to
`/task/{naddr}` where `naddr` is the NIP-19 encoded address of the task.

#### Scenario: Card renders all required fields

- **WHEN** a `TaskCard` is rendered with a `TaskSummary` having
  `title: "Fix bug"`, `status: "open"`, `tags: ["dev"]`, `totalPledged: 5000`,
  `solutionCount: 2`, `createdAt: 1700000000`
- **THEN** the card MUST display the title, an "open" status badge, a "dev" tag
  pill, "5,000 sats", "2 solutions", and a relative time string

#### Scenario: Card links to task detail

- **WHEN** a user clicks the task card
- **THEN** the browser MUST navigate to `/task/naddr1...` where the naddr
  encodes the task's kind, pubkey, and d-tag

#### Scenario: Card handles long titles

- **WHEN** the task title exceeds 2 lines of text
- **THEN** the title MUST be truncated with an ellipsis via CSS (`line-clamp`)

#### Scenario: Card is keyboard accessible

- **WHEN** a user navigates to the card via Tab key
- **THEN** the card MUST receive visible focus (using `--ring` token)
- **AND** pressing Enter MUST navigate to the task detail page

---

### Requirement: TaskStatusBadge Component

The component at `src/lib/components/task/TaskStatusBadge.svelte` SHALL
render a colored badge indicating the task's derived status. It MUST accept a
`status: TaskStatus` prop via `$props()`.

Status-to-color mapping MUST use semantic Tokyo Night tokens:

- `"draft"` — muted (`--muted`)
- `"open"` — success (`--success`)
- `"in_review"` — warning (`--warning`)
- `"completed"` — primary (`--primary`)
- `"expired"` — destructive (`--destructive`)
- `"cancelled"` — destructive (`--destructive`)

#### Scenario: Badge displays correct text

- **WHEN** `status` is `"in_review"`
- **THEN** the badge MUST display the text "In Review"

#### Scenario: Badge uses correct color for open status

- **WHEN** `status` is `"open"`
- **THEN** the badge MUST use the `--success` color token for its background or
  text

#### Scenario: Badge has accessible label

- **WHEN** the badge is rendered
- **THEN** it MUST have an `aria-label` attribute like `"Status: Open"` for
  screen readers

---

### Requirement: TaskTags Component

The component at `src/lib/components/task/TaskTags.svelte` SHALL render a
horizontal list of tag pills. It MUST accept a `tags: string[]` prop via
`$props()`.

#### Scenario: Tags render as pills

- **WHEN** `tags` is `["development", "lightning", "hardware"]`
- **THEN** three pill elements MUST be rendered with the text "development",
  "lightning", "hardware"

#### Scenario: Empty tags array

- **WHEN** `tags` is `[]`
- **THEN** no tag elements MUST be rendered (component renders nothing)

---

### Requirement: TaskDetail Component

The component at `src/lib/components/task/TaskDetail.svelte` SHALL render
the full task detail view. It MUST accept a `TaskDetail` object via
`$props()`.

The component MUST display:

- Task title as a heading
- `TaskStatusBadge` with derived status
- `Markdown` component rendering the task description (sanitized)
- `TaskTags` with category tags
- `TaskTimer` if a deadline exists
- `SatAmount` showing total pledged sats and target reward
- Creator profile info (name, avatar) if available, linking to `/profile/{npub}`
- `PledgeList` showing all pledges
- `SolutionList` showing all solutions with vote progress
- `VoteResults` if voting is complete (status is `"completed"`)

#### Scenario: Detail renders sanitized markdown description

- **WHEN** the task description contains markdown with `**bold**` and
  `[link](http://example.com)`
- **THEN** the `Markdown` component MUST render formatted HTML
- **AND** any `<script>` tags or event handlers in the markdown MUST be stripped
  (XSS prevention)

#### Scenario: Detail shows creator profile

- **WHEN** `creatorProfile` is not null
- **THEN** the creator's display name and avatar MUST be shown
- **AND** the name MUST link to `/profile/{npub}` where npub is the NIP-19
  encoded pubkey

#### Scenario: Detail shows empty state for no pledges

- **WHEN** `pledges` is an empty array
- **THEN** an `EmptyState` component MUST be shown with a message like "No
  pledges yet"

---

### Requirement: TaskTimer Component

The component at `src/lib/components/task/TaskTimer.svelte` SHALL render a
countdown timer for tasks with a deadline. It MUST accept a
`deadline: number | null` prop via `$props()`.

#### Scenario: Timer shows countdown

- **WHEN** `deadline` is a future Unix timestamp
- **THEN** the component MUST display a countdown in the format "Xd Xh Xm" or
  similar human-readable format

#### Scenario: Timer shows expired

- **WHEN** `deadline` is a past Unix timestamp
- **THEN** the component MUST display "Expired" with the destructive color token

#### Scenario: No deadline

- **WHEN** `deadline` is `null`
- **THEN** the component MUST render nothing or display "No deadline"

#### Scenario: Timer updates periodically

- **WHEN** the countdown is active
- **THEN** the displayed time MUST update at least every 60 seconds

---

### Requirement: PledgeList and PledgeItem Components

The component at `src/lib/components/pledge/PledgeList.svelte` SHALL render a
list of pledges. It MUST accept a `pledges: Pledge[]` prop. Each pledge MUST be
rendered by `PledgeItem.svelte`.

`PledgeItem.svelte` at `src/lib/components/pledge/PledgeItem.svelte` MUST
display:

- Funder's pubkey (truncated npub or profile name if available)
- `SatAmount` showing the pledge amount
- `TimeAgo` showing when the pledge was made
- Optional message from the funder

#### Scenario: Pledge list renders all pledges

- **WHEN** `pledges` contains 3 pledge objects
- **THEN** 3 `PledgeItem` components MUST be rendered

#### Scenario: Pledge item shows formatted amount

- **WHEN** a pledge has `amount: 10000`
- **THEN** the `SatAmount` component MUST display "10,000 sats" (or equivalent
  formatted display)

#### Scenario: Empty pledge list

- **WHEN** `pledges` is `[]`
- **THEN** an `EmptyState` MUST be shown with appropriate messaging

---

### Requirement: SolutionList and SolutionItem Components

The component at `src/lib/components/solution/SolutionList.svelte` SHALL render
a list of solutions. It MUST accept `solutions: Solution[]` and
`votesBySolution: Map<string, Vote[]>` props. Each solution MUST be rendered by
`SolutionItem.svelte`.

`SolutionItem.svelte` at `src/lib/components/solution/SolutionItem.svelte` MUST
display:

- Solver's pubkey (truncated npub or profile name)
- Solution description (rendered markdown, sanitized)
- Deliverable URL as a link (if present)
- `TimeAgo` showing submission time
- `VoteProgress` showing the current vote tally for this solution

#### Scenario: Solution item shows vote progress

- **WHEN** a solution has votes in `votesBySolution`
- **THEN** a `VoteProgress` component MUST be rendered showing the weighted vote
  tally

#### Scenario: Solution with deliverable URL

- **WHEN** a solution has `deliverableUrl: "https://github.com/example/pr/1"`
- **THEN** a clickable link MUST be rendered pointing to that URL with
  `target="_blank"` and `rel="noopener noreferrer"`

---

### Requirement: VoteProgress Component

The component at `src/lib/components/voting/VoteProgress.svelte` SHALL render a
visual representation of the weighted vote tally for a solution. It MUST accept
a `VoteTally` object via `$props()`.

The component MUST display:

- A progress bar showing approve vs reject weight ratio
- Approve weight and reject weight as numbers
- Quorum threshold indicator
- Whether the solution is approved, rejected, or pending

#### Scenario: Progress bar reflects vote weights

- **WHEN** `approveWeight` is `75` and `rejectWeight` is `25`
- **THEN** the progress bar MUST show approximately 75% green and 25% red

#### Scenario: Quorum indicator

- **WHEN** `quorumPercent` is `60`
- **THEN** the component MUST indicate that 60% of quorum has been reached

#### Scenario: Approved solution

- **WHEN** `isApproved` is `true`
- **THEN** the component MUST display an "Approved" indicator using the success
  color token

---

### Requirement: VoteResults Component

The component at `src/lib/components/voting/VoteResults.svelte` SHALL render the
final vote outcome for a completed task. It MUST accept the winning solution
and payout information.

#### Scenario: Shows winning solution

- **WHEN** a task is completed with a payout
- **THEN** the component MUST display which solution won and the payout amount

#### Scenario: Shows payout recipient

- **WHEN** a payout exists
- **THEN** the solver's pubkey (or profile name) and payout amount MUST be
  displayed

---

### Requirement: All Components Use $props()

All Svelte components in `src/lib/components/task/`,
`src/lib/components/pledge/`, `src/lib/components/solution/`, and
`src/lib/components/voting/` MUST use `$props()` for prop declarations. They
MUST NOT use `export let` or `$$props`.

#### Scenario: Props use Svelte 5 syntax

- **WHEN** any component in the task display directories is inspected
- **THEN** it MUST use `let { propName } = $props()` syntax for all props
