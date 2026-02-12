## ADDED Requirements

### Requirement: SatAmount Component

The component at `src/lib/components/shared/SatAmount.svelte` SHALL render a
formatted satoshi amount with an appropriate icon or label. It MUST accept an
`amount: number` prop via `$props()`.

The component MUST format the number with locale-aware thousand separators
(e.g., `10,000` not `10000`). The component MUST append "sats" as a unit label.

#### Scenario: Standard amount formatting

- **WHEN** `amount` is `50000`
- **THEN** the component MUST render "50,000 sats" (or equivalent
  locale-formatted string)

#### Scenario: Zero amount

- **WHEN** `amount` is `0`
- **THEN** the component MUST render "0 sats"

#### Scenario: Large amount formatting

- **WHEN** `amount` is `1000000`
- **THEN** the component MUST render "1,000,000 sats"

#### Scenario: Amount uses accent color

- **WHEN** the component is rendered
- **THEN** the amount number MUST use the `--accent` color token for visual
  emphasis

---

### Requirement: TimeAgo Component

The component at `src/lib/components/shared/TimeAgo.svelte` SHALL render a
human-readable relative time string from a Unix timestamp. It MUST accept a
`timestamp: number` prop via `$props()`.

The component MUST display relative time in a human-readable format (e.g., "5
minutes ago", "2 hours ago", "3 days ago"). The component MUST include a
`<time>` HTML element with the `datetime` attribute set to the ISO 8601 string
for accessibility and SEO.

#### Scenario: Recent timestamp

- **WHEN** `timestamp` is 30 seconds before the current time
- **THEN** the component MUST render "just now" or "less than a minute ago"

#### Scenario: Hours ago

- **WHEN** `timestamp` is 7200 seconds (2 hours) before the current time
- **THEN** the component MUST render "2 hours ago"

#### Scenario: Days ago

- **WHEN** `timestamp` is 259200 seconds (3 days) before the current time
- **THEN** the component MUST render "3 days ago"

#### Scenario: Accessible time element

- **WHEN** the component is rendered with `timestamp: 1700000000`
- **THEN** it MUST contain a `<time datetime="2023-11-14T22:13:20.000Z">`
  element (or equivalent ISO string)

---

### Requirement: Markdown Component

The component at `src/lib/components/shared/Markdown.svelte` SHALL render
sanitized HTML from a markdown string. It MUST accept a `content: string` prop
via `$props()`.

The component MUST:

1. Parse the markdown string into HTML
2. Sanitize the HTML output to prevent XSS attacks — all `<script>` tags,
   `onerror`/`onclick`/etc. event handlers, `javascript:` URLs, and `<iframe>`
   elements MUST be stripped
3. Render the sanitized HTML using Svelte's `{@html}` directive

#### Scenario: Standard markdown rendering

- **WHEN** `content` is `"**bold** and *italic*"`
- **THEN** the rendered HTML MUST contain `<strong>bold</strong>` and
  `<em>italic</em>`

#### Scenario: Code blocks render correctly

- **WHEN** `content` contains a fenced code block with language identifier
- **THEN** the rendered HTML MUST contain a `<pre><code>` element

#### Scenario: XSS prevention — script tags stripped

- **WHEN** `content` is `"Hello <script>alert('xss')</script> world"`
- **THEN** the rendered HTML MUST NOT contain any `<script>` element
- **AND** the text "Hello world" MUST still be displayed

#### Scenario: XSS prevention — event handlers stripped

- **WHEN** `content` is `'<img src="x" onerror="alert(1)">'`
- **THEN** the rendered HTML MUST NOT contain the `onerror` attribute

#### Scenario: XSS prevention — javascript URLs stripped

- **WHEN** `content` is `'[click me](javascript:alert(1))'`
- **THEN** the rendered link MUST NOT have `href="javascript:alert(1)"`

#### Scenario: Links open in new tab

- **WHEN** `content` contains `[link](https://example.com)`
- **THEN** the rendered `<a>` element MUST have `target="_blank"` and
  `rel="noopener noreferrer"`

---

### Requirement: EmptyState Component

The component at `src/lib/components/shared/EmptyState.svelte` SHALL render a
placeholder UI when no data is available. It MUST accept `message: string` and
optionally `icon` and `action` props via `$props()`.

#### Scenario: Empty state with message

- **WHEN** `message` is `"No tasks yet. Be the first to create one!"`
- **THEN** the component MUST render the message text centered in the available
  space

#### Scenario: Empty state with action

- **WHEN** an `action` prop is provided (e.g.,
  `{ label: "Create Task", href: "/task/new" }`)
- **THEN** the component MUST render a call-to-action button or link

#### Scenario: Empty state is visually distinct

- **WHEN** the component is rendered
- **THEN** it MUST use muted colors (`--muted-foreground`) to indicate the
  absence of content

---

### Requirement: LoadingSpinner Component

The component at `src/lib/components/shared/LoadingSpinner.svelte` SHALL render
an animated loading indicator. It MUST optionally accept a `size` prop
(`"sm" | "md" | "lg"`) via `$props()` defaulting to `"md"`.

#### Scenario: Default spinner renders

- **WHEN** `LoadingSpinner` is rendered with no props
- **THEN** a medium-sized animated spinner MUST be visible

#### Scenario: Spinner respects reduced motion

- **WHEN** the user has `prefers-reduced-motion: reduce` set
- **THEN** the spinner animation MUST be disabled or replaced with a static
  indicator

#### Scenario: Spinner has accessible label

- **WHEN** the spinner is rendered
- **THEN** it MUST have `role="status"` and an `aria-label="Loading"` attribute
  for screen readers

---

### Requirement: All Shared Components Use $props()

All components in `src/lib/components/shared/` MUST use `$props()` for prop
declarations. They MUST NOT use `export let`, `$$props`, or `$$restProps`.

#### Scenario: Props use Svelte 5 syntax

- **WHEN** any component in `src/lib/components/shared/` is inspected
- **THEN** it MUST use `let { propName, ...rest } = $props()` syntax
