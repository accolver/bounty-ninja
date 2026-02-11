## ADDED Requirements

### Requirement: Creator-Initiated Payout Flow

The system SHALL implement a creator-initiated manual payout flow. Only the
bounty creator (the pubkey that published the Kind 37300 event) SHALL be able to
trigger payout. The payout flow is described in PRD Section 6.6 and consists of
five steps: (1) collect pledge tokens, (2) swap/consolidate at mint, (3) create
solver-locked tokens, (4) publish Kind 73004, (5) solver claims tokens.

#### Scenario: Payout trigger visibility

- **WHEN** a solution has reached consensus (approved via vote tally) and the
  current user is the bounty creator
- **THEN** a "Trigger Payout" button SHALL be displayed on the bounty detail
  page next to the approved solution

#### Scenario: Payout trigger hidden for non-creators

- **WHEN** the current user is NOT the bounty creator
- **THEN** the "Trigger Payout" button SHALL NOT be rendered
- **AND** the UI SHALL display: "Awaiting payout from bounty creator"

#### Scenario: Payout trigger hidden before consensus

- **WHEN** no solution has reached consensus approval
- **THEN** the "Trigger Payout" button SHALL NOT be rendered

### Requirement: Pledge Token Collection

When the bounty creator triggers payout, the system SHALL collect all valid
Cashu tokens from Kind 73002 pledge events referencing the bounty.

#### Scenario: Collect all pledge tokens

- **WHEN** the creator clicks "Trigger Payout"
- **THEN** the system SHALL query the `EventStore` for all Kind 73002 events
  with `["a", "<bounty-address>"]`
- **AND** SHALL extract the `["cashu", "<token>"]` tag from each pledge event
- **AND** SHALL decode each token using `getDecodedToken()`

#### Scenario: Skip invalid or already-spent tokens

- **WHEN** a pledge token fails to decode or the mint reports it as already
  spent
- **THEN** the system SHALL skip that token
- **AND** SHALL log a warning: "Pledge <event-id> contains an invalid or spent
  token"
- **AND** SHALL subtract the invalid pledge amount from the total payout

### Requirement: Token Swap and Consolidation at Mint

The bounty creator SHALL swap the collected P2PK-locked pledge tokens at the
Cashu mint. Since the tokens are locked to the creator's pubkey, the creator's
NIP-07 signer provides the signing capability needed to unlock them during the
swap.

#### Scenario: Successful token swap

- **WHEN** the creator's wallet swaps pledge tokens at the mint
- **THEN** the mint SHALL verify the P2PK signature (proving the creator holds
  the key)
- **AND** SHALL return fresh proofs (unlocked) to the creator
- **AND** the creator SHALL consolidate all proofs into a single token set

#### Scenario: Partial swap failure

- **WHEN** some pledge tokens fail to swap (already spent, mint error)
- **THEN** the system SHALL continue with the successfully swapped tokens
- **AND** SHALL display a warning: "N of M pledge tokens could not be redeemed.
  Payout amount reduced."
- **AND** SHALL show the adjusted payout amount before the creator confirms

#### Scenario: Total swap failure

- **WHEN** all pledge tokens fail to swap
- **THEN** the system SHALL abort the payout
- **AND** SHALL display a toast: "Payout failed. No pledge tokens could be
  redeemed."

### Requirement: Solver-Locked Token Creation

After swapping, the creator SHALL create new Cashu tokens P2PK-locked to the
winning solver's pubkey (extracted from the approved solution's Kind 73001
event).

#### Scenario: Create solver-locked payout tokens

- **WHEN** the creator has successfully swapped pledge tokens
- **THEN** the system SHALL create new tokens from the consolidated proofs
- **AND** SHALL apply a P2PK spending condition locking the tokens to the
  solver's hex pubkey
- **AND** the solver SHALL be the only party able to claim these tokens

#### Scenario: Payout amount matches swapped total

- **WHEN** solver-locked tokens are created
- **THEN** the total amount of the payout tokens SHALL equal the total amount of
  successfully swapped pledge tokens (minus any mint fees)

### Requirement: Kind 73004 Payout Event Construction

The system SHALL construct a Kind 73004 event with the following tag structure
as defined in PRD Section 6.6:

**Required tags:**

- `["a", "37300:<bounty-creator-pubkey>:<d-tag>", "<relay-hint>"]` — bounty
  reference
- `["e", "<solution-event-id>", "<relay-hint>"]` — winning solution reference
- `["p", "<solver-pubkey>"]` — recipient (solver's pubkey)
- `["amount", "<sats>"]` — payout amount in sats
- `["cashu", "<serialized-cashu-token>"]` — P2PK-locked token for the solver
- `["client", "tasks.fyi"]` — application identifier

**Content field:** Optional payout note from the creator.

#### Scenario: Complete payout event with all required tags

- **WHEN** a payout event is constructed
- **THEN** the event MUST contain `a`, `e`, `p`, `amount`, `cashu`, and `client`
  tags
- **AND** the `e` tag SHALL reference the winning solution's event ID
- **AND** the `p` tag SHALL contain the solver's pubkey
- **AND** the `amount` tag SHALL reflect the actual payout amount
- **AND** the `cashu` tag SHALL contain the solver-locked encoded token

### Requirement: Payout Confirmation Dialog

Before executing the payout, the system SHALL display a confirmation dialog
showing the payout details for the creator to review.

#### Scenario: Payout confirmation display

- **WHEN** the creator clicks "Trigger Payout"
- **THEN** a confirmation dialog SHALL display:
  - The winning solution summary
  - The solver's pubkey (formatted as npub)
  - The total payout amount in sats
  - The number of pledge tokens being consolidated
  - A warning: "This action is irreversible. Tokens will be locked to the
    solver."
- **AND** the creator MUST click "Confirm Payout" to proceed

#### Scenario: Creator cancels payout

- **WHEN** the creator clicks "Cancel" on the payout confirmation dialog
- **THEN** no tokens SHALL be swapped
- **AND** no event SHALL be published
- **AND** the dialog SHALL close

### Requirement: Payout Publishing and Status Transition

After token creation and event construction, the system SHALL sign the Kind
73004 event via NIP-07, publish to all connected relays, and optimistically
update the local `EventStore`.

#### Scenario: Successful payout end-to-end

- **WHEN** the creator confirms the payout
- **THEN** the system SHALL: (1) collect pledge tokens, (2) swap at mint, (3)
  create solver-locked tokens, (4) construct Kind 73004 event, (5) sign via
  NIP-07, (6) add to `EventStore` optimistically, (7) publish to all relays
- **AND** the bounty status SHALL transition to `completed`
- **AND** a success toast SHALL display: "Payout of N sats sent to solver!"
- **AND** the `BountyStatusBadge` SHALL update to "Completed"

#### Scenario: Payout event from non-creator ignored

- **WHEN** a Kind 73004 event is received from a pubkey that is NOT the bounty
  creator
- **THEN** the system SHALL ignore the event per PRD Section 13.4
- **AND** the bounty status SHALL NOT change

### Requirement: Solver Token Claim Notification

After a Kind 73004 payout event is published, the solver SHALL see a
notification on the bounty detail page indicating they have tokens to claim.

#### Scenario: Solver views bounty after payout

- **WHEN** the solver (the pubkey in the payout's `p` tag) views the bounty
  detail page
- **THEN** the UI SHALL display: "You have been awarded N sats! Claim your
  tokens."
- **AND** SHALL provide instructions or a mechanism to claim the P2PK-locked
  tokens using their Cashu wallet
