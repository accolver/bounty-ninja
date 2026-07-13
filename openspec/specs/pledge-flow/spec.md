## Requirements

### Requirement: Manual Pledge Input

The pledge form SHALL collect a Minibits public payment key, exact positive
integer amount, manually created P2PK token with verifiable DLEQ issuance evidence, optional message, and bearer-risk
acknowledgement. It SHALL instruct the user to use the bounty mint, the same
payment key, no locktime, no refund keys, and permanent `SIG_INPUTS`.

#### Scenario: Valid pledge

- **WHEN** every token proof is unspent, unique, exact amount, correct mint,
  locked to the entered key, and satisfies the permanent policy
- **THEN** the application SHALL persist a prepared journal operation
- **AND** sign and publish a Kind 73002 event containing
	`['payment','cashu','<compressed-key>']`
- **AND** report success only after at least one relay accepts the exact event

#### Scenario: Invalid or unavailable pledge

- **WHEN** decoding, NUT-11 support, proof-state, amount, mint, key, signature
  policy, or duplicate-proof validation fails or is unavailable
- **THEN** no pledge event SHALL be published
- **AND** its declared amount SHALL not enter trusted financial state

### Requirement: Durable Publication

The operation journal SHALL be written before publication. A relay-rejected
operation SHALL preserve retry/recovery state and SHALL reuse its exact signed
event rather than creating a second pledge or token.

### Requirement: Disabled Payment State

When payment writes are disabled, pledging SHALL be unavailable without
preventing fee-free solution or other Nostr-only flows. Public bearer solution
fees are not part of the production protocol.
