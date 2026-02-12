## Why

Phases 1-2 delivered a read-only task board. Phase 3 (PRD Section 18) is the
core product — implementing all write operations that make Bounty.ninja a
functional marketplace: creating tasks, funding with Cashu ecash, submitting
solutions with anti-spam fees, voting on solutions, and orchestrating payouts.
This phase introduces the Cashu payment layer and Nostr event publishing via
Applesauce EventFactory.

## What Changes

- Implement Applesauce EventFactory blueprints for all task event kinds (Kind
  37300 task, 73002 pledge, 73001 solution, 1018 vote, 73004 payout)
- Build the Cashu payment layer: CashuMint/CashuWallet singleton initialization,
  token encoding/decoding, P2PK locking/unlocking (NUT-11), and escrow logic
- Build TaskForm component for creating tasks with title, markdown
  description, reward target, tags, deadline, mint preference, and submission
  fee
- Build PledgeButton and PledgeForm for funding tasks with Cashu tokens
  P2PK-locked to the task creator's pubkey
- Build SolutionForm for submitting solutions with anti-spam fee validation
  (between PUBLIC_MIN/MAX_SUBMISSION_FEE sats)
- Build VoteButton for approve/reject voting (restricted to pledgers only)
- Implement payout orchestration: creator collects pledge tokens, swaps at mint,
  re-locks to solver's pubkey, publishes Kind 73004
- Build ProfileMenu and ProfileAvatar for logged-in user experience
- Build toast notification system for publish success/failure feedback
- Build ErrorBoundary wrapper for graceful error handling
- Implement optimistic local updates: insert events into EventStore immediately
  on publish
- Wire up the create task page at `/task/new`
- Update task detail page with interactive pledge/solution/vote elements
- Write unit tests for P2PK operations and integration tests for task store
  reactivity and pledge flow

## Capabilities

### New Capabilities

- `event-publishing`: Applesauce EventFactory with NIP-07 signing, event
  blueprints for all task kinds, optimistic local EventStore updates,
  multi-relay broadcasting (PRD Section 11.2)
- `cashu-payments`: CashuMint/CashuWallet singleton, token encoding/decoding,
  P2PK locking (NUT-11) for escrow, token claim/refund logic (PRD Section 6.3,
  6.6)
- `task-creation`: TaskForm component, Kind 37300 event construction with
  all required/optional tags, create task page at `/task/new` (PRD Phase 3
  deliverables 7, 16)
- `pledge-flow`: PledgeButton/PledgeForm, Cashu token creation with P2PK lock to
  task creator, Kind 73002 publishing, pledge amount validation (PRD Section
  6.3)
- `solution-submission`: SolutionForm with anti-spam fee (Cashu token),
  deliverable URL field, Kind 73001 publishing, fee range validation (PRD
  Section 6.4)
- `vote-casting`: VoteButton with approve/reject, pledger-only restriction, Kind
  1018 publishing, real-time tally updates (PRD Section 6.5)
- `payout-orchestration`: Creator-initiated payout flow — collect pledge tokens,
  swap at mint, re-lock to solver, Kind 73004 publishing (PRD Section 6.6)
- `toast-notifications`: Global toast state store and Toaster component for user
  feedback on all async operations (PRD Section 13)
- `error-boundaries`: ErrorBoundary wrapper component for graceful degradation
  on component failures

### Modified Capabilities

- `task-display-components`: TaskDetail page updated with interactive
  pledge/solution/vote elements
- `app-layout`: Root layout updated with Toaster, ProfileMenu for logged-in
  users
- `authentication`: ProfileMenu and ProfileAvatar components for authenticated
  user experience

## Impact

- **New files**: ~20 files across `src/lib/task/blueprints.ts`,
  `src/lib/cashu/`, `src/lib/components/task/TaskForm.svelte`,
  `src/lib/components/pledge/PledgeButton.svelte`,
  `src/lib/components/pledge/PledgeForm.svelte`,
  `src/lib/components/solution/SolutionForm.svelte`,
  `src/lib/components/voting/VoteButton.svelte`,
  `src/lib/components/auth/ProfileMenu.svelte`,
  `src/lib/components/auth/ProfileAvatar.svelte`,
  `src/lib/stores/toast.svelte.ts`, `src/lib/components/shared/Toaster.svelte`,
  `src/lib/components/shared/ErrorBoundary.svelte`,
  `src/routes/task/new/+page.svelte`, `src/tests/unit/p2pk.test.ts`,
  `src/tests/integration/`
- **Modified files**: Task detail page, root layout, Header
- **Acceptance criteria** (from PRD Phase 3): Task creation publishes Kind
  37300, pledging creates P2PK-locked tokens + publishes Kind 73002, solution
  submission validates anti-spam fee + publishes Kind 73001, only pledgers can
  vote, vote tally updates real-time, creator can trigger payout, toast
  notifications for all operations, all unit/integration tests pass
