## ADDED Requirements

### Requirement: ErrorBoundary Wrapper Component

The system SHALL provide an `ErrorBoundary.svelte` component at
`src/lib/components/shared/ErrorBoundary.svelte` that catches rendering errors
in child components and displays a fallback UI instead of crashing the entire
page. The component SHALL use Svelte 5's `{@render children()}` pattern for
content projection.

#### Scenario: Child component throws during render

- **WHEN** a child component within the ErrorBoundary throws an error during
  rendering
- **THEN** the ErrorBoundary SHALL catch the error
- **AND** SHALL render a fallback UI instead of the failed component
- **AND** the fallback SHALL display: "Something went wrong" with a "Try again"
  button
- **AND** the rest of the page outside the ErrorBoundary SHALL continue to
  function

#### Scenario: Try again resets the error state

- **WHEN** the user clicks "Try again" on the fallback UI
- **THEN** the ErrorBoundary SHALL clear its error state
- **AND** SHALL attempt to re-render the child components

#### Scenario: Error logging

- **WHEN** an error is caught by the ErrorBoundary
- **THEN** the error SHALL be logged to `console.error` with the component
  context
- **AND** the error details SHALL NOT be displayed to the user in production
  (only the friendly fallback message)

### Requirement: ErrorBoundary Placement

The ErrorBoundary SHALL be used to wrap critical interactive sections of the
task detail page to prevent a failure in one section from breaking the entire
page.

#### Scenario: Pledge section error isolation

- **WHEN** the PledgeForm or PledgeList component throws an error
- **THEN** only the pledge section SHALL show the fallback UI
- **AND** the task description, solution list, and vote sections SHALL remain
  functional

#### Scenario: Solution section error isolation

- **WHEN** the SolutionForm or SolutionList component throws an error
- **THEN** only the solution section SHALL show the fallback UI
- **AND** the task description, pledge list, and vote sections SHALL remain
  functional

#### Scenario: Vote section error isolation

- **WHEN** the VoteButton or VoteProgress component throws an error
- **THEN** only the vote section SHALL show the fallback UI
- **AND** other sections SHALL remain functional

### Requirement: ErrorBoundary Props

The ErrorBoundary component SHALL accept the following props via `$props()`:

- `fallback`: Optional custom fallback snippet/component to render on error
  (defaults to the built-in "Something went wrong" UI)
- `onError`: Optional callback function invoked when an error is caught,
  receiving the error object

#### Scenario: Custom fallback rendering

- **WHEN** an ErrorBoundary is configured with a custom `fallback` prop
- **THEN** the custom fallback SHALL be rendered instead of the default error UI
  when an error occurs

#### Scenario: onError callback invocation

- **WHEN** an error is caught and an `onError` callback is provided
- **THEN** the callback SHALL be invoked with the caught error
- **AND** this can be used for error reporting or analytics

### Requirement: ErrorBoundary Accessibility

The ErrorBoundary fallback UI SHALL be accessible.

#### Scenario: Screen reader announcement

- **WHEN** the fallback UI is rendered due to an error
- **THEN** the fallback container SHALL use `role="alert"` to announce the error
  to screen readers
- **AND** the "Try again" button SHALL be keyboard-focusable and have a clear
  accessible label
