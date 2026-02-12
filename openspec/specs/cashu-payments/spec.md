## ADDED Requirements

### Requirement: CashuMint and CashuWallet Singleton

The system SHALL initialize a singleton `CashuMint` and `CashuWallet` instance
in `src/lib/cashu/mint.ts` using `@cashu/cashu-ts`. The mint URL SHALL default
to `PUBLIC_DEFAULT_MINT` from environment variables. The wallet SHALL be lazily
initialized on first Cashu operation.

#### Scenario: Singleton initialization

- **WHEN** the first Cashu operation is requested (pledge, solution fee, or
  payout)
- **THEN** a `CashuMint` instance SHALL be created with the configured mint URL
- **AND** a `CashuWallet` instance SHALL be created from that mint
- **AND** subsequent operations SHALL reuse the same instances

#### Scenario: Mint URL from task preference

- **WHEN** a task specifies a `["mint", "<url>"]` tag
- **THEN** pledge and solution operations for that task SHALL use the task's
  specified mint URL
- **AND** if the task's mint differs from the default, a new
  `CashuMint`/`CashuWallet` pair SHALL be created for that mint

#### Scenario: Mint unreachable

- **WHEN** the configured Cashu mint is unreachable
- **THEN** the system SHALL retry 3 times with 2-second delays between attempts
- **AND** if all retries fail, SHALL display a toast: "Mint unavailable. Try a
  different mint?"
- **AND** SHALL prevent the user from proceeding with the Cashu operation

### Requirement: Token Encoding and Decoding

The system SHALL provide token encoding/decoding utilities in
`src/lib/cashu/token.ts` using `@cashu/cashu-ts` `getEncodedToken()` and
`getDecodedToken()`. All tokens stored in Nostr event `["cashu", "<token>"]`
tags MUST use Cashu v4 token encoding (`cashuA...` prefix).

#### Scenario: Encode a token for event storage

- **WHEN** a Cashu proof set is created (from minting or receiving)
- **THEN** the system SHALL encode it using `getEncodedToken()` producing a
  `cashuA...` string
- **AND** this encoded string SHALL be placed in the `["cashu", "<token>"]` tag
  of the Nostr event

#### Scenario: Decode a token from an event

- **WHEN** a Nostr event containing a `["cashu", "<token>"]` tag is received
- **THEN** the system SHALL decode the token using `getDecodedToken()`
- **AND** SHALL extract the mint URL, proof set, and total amount
- **AND** SHALL handle malformed tokens gracefully by displaying a "Invalid
  token" warning

#### Scenario: Token amount extraction

- **WHEN** a decoded token's proofs are inspected
- **THEN** the total amount SHALL be computed as the sum of all proof amounts
- **AND** this amount SHALL be used for display and validation purposes

### Requirement: P2PK Locking for Escrow (NUT-11)

The system SHALL implement P2PK (Pay-to-Public-Key) locking in
`src/lib/cashu/p2pk.ts` per Cashu NUT-11 specification. Pledge tokens MUST be
locked to the task creator's pubkey so that only the creator can swap them at
the mint. Payout tokens MUST be re-locked to the winning solver's pubkey.

#### Scenario: Lock pledge tokens to task creator

- **WHEN** a funder creates a pledge for a task
- **THEN** the Cashu token SHALL be minted with a P2PK spending condition
  locking it to the task creator's hex pubkey
- **AND** the NUT-11 `P2PKSecret` SHALL specify the creator's pubkey as the
  required signer
- **AND** only the task creator's corresponding private key SHALL be able to
  unlock (swap) the token at the mint

#### Scenario: Lock payout tokens to solver

- **WHEN** the task creator initiates payout to the winning solver
- **THEN** the creator SHALL swap the collected pledge tokens at the mint
  (unlocking with their key)
- **AND** SHALL create new tokens P2PK-locked to the solver's hex pubkey
- **AND** the solver SHALL be able to claim these tokens using their private key

#### Scenario: Refund after locktime expiration

- **WHEN** a pledge token includes a NUT-11 refund condition with a locktime
- **AND** the locktime has passed without a payout occurring
- **THEN** the original funder's pubkey SHALL be able to reclaim the token
- **AND** the UI SHALL display a "Pledge expired. Reclaim your tokens." option

### Requirement: Escrow Logic

The system SHALL implement escrow operations in `src/lib/cashu/escrow.ts`
covering: creating locked tokens for pledges, collecting pledge tokens for
payout, swapping tokens at the mint, and creating solver-locked payout tokens.

#### Scenario: Create escrow token for pledge

- **WHEN** a funder specifies a pledge amount
- **THEN** the system SHALL mint new Cashu tokens for the specified amount
- **AND** SHALL apply P2PK lock to the task creator's pubkey
- **AND** SHALL encode the locked token for inclusion in the Kind 73002 event's
  `["cashu", "<token>"]` tag

#### Scenario: Collect and swap pledge tokens for payout

- **WHEN** the task creator initiates payout
- **THEN** the system SHALL extract all `["cashu", "<token>"]` values from Kind
  73002 pledge events for the task
- **AND** SHALL decode each token and swap/consolidate them at the mint using
  the creator's signing capability
- **AND** SHALL create new consolidated tokens P2PK-locked to the solver's
  pubkey

#### Scenario: Token double-spend detection

- **WHEN** a pledge token is swapped at the mint
- **AND** the mint returns an error indicating the token has already been spent
- **THEN** the system SHALL mark that pledge as invalid
- **AND** SHALL display a toast: "This token has already been claimed"
- **AND** SHALL exclude the invalid pledge amount from the payout total

### Requirement: Cashu Type Definitions

The system SHALL define Cashu-specific TypeScript types in
`src/lib/cashu/types.ts` covering token structures, P2PK lock parameters, escrow
state, and mint interaction results.

#### Scenario: Type safety for Cashu operations

- **WHEN** any Cashu operation is performed in the codebase
- **THEN** all function parameters and return values SHALL use the defined types
  from `src/lib/cashu/types.ts`
- **AND** the types SHALL align with `@cashu/cashu-ts` library types where
  applicable

### Requirement: Bearer Instrument Warning

The system SHALL warn users that Cashu tokens are bearer instruments (equivalent
to cash) before any token creation or transfer operation. Users MUST acknowledge
the risk that tokens, once created, can be lost if not properly handled.

#### Scenario: Warning before pledge creation

- **WHEN** a user initiates a pledge operation
- **THEN** the PledgeForm SHALL display a warning: "Cashu tokens are like cash.
  Once sent, they cannot be reversed. Ensure you trust this task creator."
- **AND** the user MUST confirm before proceeding
