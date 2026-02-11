## ADDED Requirements

### Requirement: Tokyo Night Dark Theme (Default)

`src/app.css` MUST import Tailwind CSS via `@import "tailwindcss"` and define
Tokyo Night Storm color tokens using the Tailwind CSS 4 `@theme` directive. The
dark theme MUST be the default (no class required). The following semantic color
tokens MUST be defined as specified in PRD Section 12.1:

- `--color-primary`: `#7aa2f7` (Blue)
- `--color-primary-foreground`: `#1a1b26`
- `--color-secondary`: `#bb9af7` (Purple)
- `--color-secondary-foreground`: `#1a1b26`
- `--color-destructive`: `#f7768e` (Red)
- `--color-success`: `#9ece6a` (Green)
- `--color-warning`: `#e0af68` (Yellow)
- `--color-background`: `#1a1b26` (Night)
- `--color-foreground`: `#a9b1d6`
- `--color-card`: `#24283b` (Storm)
- `--color-card-foreground`: `#a9b1d6`
- `--color-muted`: `#414868`
- `--color-muted-foreground`: `#565f89`
- `--color-border`: `#414868`
- `--color-ring`: `#7aa2f7`
- `--color-accent`: `#2ac3de` (Cyan)

#### Scenario: Dark theme is applied by default

- **WHEN** the application loads without any theme class on the root element
- **THEN** the page background is `#1a1b26` (Tokyo Night Storm)
- **AND** the default text color is `#a9b1d6`
- **AND** all semantic tokens resolve to their dark mode values

#### Scenario: All semantic tokens are defined

- **WHEN** `src/app.css` is inspected
- **THEN** all 16 semantic color tokens listed above are defined within the
  `@theme` block

### Requirement: Tokyo Night Light Theme

`src/app.css` MUST define a `.light` CSS class that overrides all semantic color
tokens with Tokyo Night Day values as specified in PRD Section 12.1:

- `--color-primary`: `#2959aa`
- `--color-primary-foreground`: `#ffffff`
- `--color-secondary`: `#5a3e8e`
- `--color-secondary-foreground`: `#ffffff`
- `--color-destructive`: `#8c4351`
- `--color-success`: `#385f0d`
- `--color-warning`: `#8f5e15`
- `--color-background`: `#d5d6db`
- `--color-foreground`: `#343b58`
- `--color-card`: `#e6e7ed`
- `--color-card-foreground`: `#343b58`
- `--color-muted`: `#9699a3`
- `--color-muted-foreground`: `#6c6f7e`
- `--color-border`: `#b4b5bd`
- `--color-ring`: `#2959aa`
- `--color-accent`: `#007197`

#### Scenario: Light theme activates with .light class

- **WHEN** the `.light` class is added to the root `<html>` or `<body>` element
- **THEN** the page background changes to `#d5d6db`
- **AND** the default text color changes to `#343b58`
- **AND** all semantic tokens resolve to their light mode values

### Requirement: Tailwind CSS 4 Integration

Tailwind CSS MUST be integrated via the `@tailwindcss/vite` plugin (NOT via
PostCSS). The `@import "tailwindcss"` directive in `app.css` MUST be the entry
point for Tailwind. Tailwind utility classes MUST be available in all `.svelte`
files and MUST consume the semantic color tokens (e.g., `bg-primary`,
`text-foreground`, `border-border`).

#### Scenario: Tailwind utility classes work in components

- **WHEN** a Svelte component uses `class="bg-primary text-primary-foreground"`
- **THEN** the element renders with the Tokyo Night blue background and dark
  text

#### Scenario: Tailwind is loaded via Vite plugin

- **WHEN** `vite.config.ts` is inspected
- **THEN** `tailwindcss()` from `@tailwindcss/vite` is in the `plugins` array
- **AND** no PostCSS configuration for Tailwind exists

### Requirement: shadcn-svelte Component Initialization

shadcn-svelte (next) MUST be initialized in the project. The following base
components MUST be installed and available for use: Button, Card, Badge, Input,
and Dialog. These components MUST consume the semantic Tokyo Night color tokens
for consistent theming.

#### Scenario: shadcn-svelte Button renders with theme colors

- **WHEN** a `<Button>` component is rendered with the default variant
- **THEN** it uses `--color-primary` for its background
- **AND** `--color-primary-foreground` for its text

#### Scenario: shadcn-svelte components are importable

- **WHEN** a component imports
  `import { Button } from "$lib/components/ui/button"`
- **THEN** the import resolves without errors
- **AND** the Button component renders correctly

#### Scenario: All required base components exist

- **WHEN** the `src/lib/components/ui/` directory is inspected
- **THEN** subdirectories or files for `button`, `card`, `badge`, `input`, and
  `dialog` exist

### Requirement: WCAG 2.1 AA Color Contrast

All text rendered against background colors MUST meet WCAG 2.1 AA contrast
requirements (4.5:1 ratio for normal text, 3:1 for large text). The Tokyo Night
color token pairings (foreground on background, card-foreground on card,
primary-foreground on primary, etc.) MUST satisfy these ratios in both dark and
light modes.

#### Scenario: Primary text on background meets contrast ratio

- **WHEN** `--color-foreground` text is rendered on `--color-background`
- **THEN** the contrast ratio is at least 4.5:1 in dark mode
- **AND** the contrast ratio is at least 4.5:1 in light mode

#### Scenario: Card text on card background meets contrast ratio

- **WHEN** `--color-card-foreground` text is rendered on `--color-card`
- **THEN** the contrast ratio is at least 4.5:1 in both modes

### Requirement: Focus Ring Styling

Interactive elements MUST display a visible focus ring when focused via keyboard
navigation. The focus ring MUST use the `--color-ring` token. Focus rings MUST
be visible in both dark and light modes and MUST NOT be suppressed for keyboard
users.

#### Scenario: Button shows focus ring on keyboard focus

- **WHEN** a Button component receives keyboard focus (via Tab)
- **THEN** a visible ring is displayed using the `--color-ring` color
- **AND** the ring is clearly distinguishable from the element's background

### Requirement: Reduced Motion Support

The application MUST respect the `prefers-reduced-motion` media query. When the
user has requested reduced motion, CSS transitions and animations MUST be
disabled or minimized.

#### Scenario: Animations disabled when reduced motion preferred

- **WHEN** the user's OS is configured with `prefers-reduced-motion: reduce`
- **THEN** CSS transitions and animations are disabled or set to instant
- **AND** no decorative motion occurs on the page

### Requirement: HTML Shell Template

`src/app.html` MUST define the HTML shell with appropriate `<meta>` tags
including `charset`, `viewport`, and `color-scheme`. The `<html>` element MUST
have `lang="en"`. The template MUST include the `%sveltekit.head%` and
`%sveltekit.body%` placeholders. The body MUST apply
`bg-background text-foreground` classes for base theming.

#### Scenario: HTML shell has correct meta tags

- **WHEN** `src/app.html` is inspected
- **THEN** it includes `<meta charset="utf-8" />`
- **AND**
  `<meta name="viewport" content="width=device-width, initial-scale=1" />`
- **AND** `<html lang="en">`
