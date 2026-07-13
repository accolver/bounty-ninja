## Requirements

### Requirement: Manual Minibits NUT-11 Policy

New pledges and payouts SHALL use exact-amount P2PK tokens created manually in
Minibits at the bounty mint. Every proof SHALL target the declared Cashu payment
key, have no locktime or refund keys, and permanently require one `SIG_INPUTS`
signature. The complete compressed key parity SHALL be preserved. Additional
primary keys and parity-less keys SHALL be rejected.
Validation SHALL inspect exact raw NUT-11 tags and reject duplicate policy tags,
duplicate additional keys, malformed numeric strings, unknown critical tags,
and conflicting locktime/refund policy without accessor normalization.

#### Scenario: Safe permanent proof

- **WHEN** a user submits a manually created token
- **THEN** the application SHALL verify unit, amount, mint, proof uniqueness and
  state, P2PK target, absent locktime/refund keys, and one-signature
  `SIG_INPUTS` policy before publication
- **AND** any mismatch SHALL block the financial event

#### Scenario: Bounty expires

- **WHEN** the bounty deadline passes
- **THEN** its Cashu proofs SHALL remain locked to the declared payment key
- **AND** expiry SHALL NOT be described as a NUT-11 unlock or refund timer

### Requirement: Identity And Payment Key Separation

NIP-07/NIP-46 SHALL sign Nostr events only. Cashu proof authorization SHALL stay
inside an external Cashu wallet. UI and Cashu modules MUST NOT request or accept
a Nostr identity secret or Cashu payment secret.

#### Scenario: Wallet authorization is needed

- **WHEN** a pledge must be released or reclaimed
- **THEN** the user SHALL complete the operation in the same backed-up Minibits
  wallet
- **AND** the application SHALL accept only public keys and public serialized
  tokens needed for verification and publication

### Requirement: External Wallet Scope

The supported production behavior SHALL be described as a manual Minibits
handoff. Generic wallet import, NIP-60, automated NUT-11 signing, and other
wallets SHALL NOT be claimed supported until named-version interoperability
tests and independent review pass.

### Requirement: Payment Safety Flag

Payment writes SHALL default disabled through
	`PUBLIC_PAYMENT_WRITES_ENABLED=false`. Disabled pledge, required fee, release,
and reclaim controls SHALL not invoke a mint. Production enablement requires the
evidenced gates in `LAUNCH_CHECKLIST.md` and a separately reviewed build change.
Every exported lower-level mint mutation helper SHALL independently enforce the
same write gate before validation, signer requests, mint connection, or swap.

### Requirement: Fee-Free Solutions

Production bounty and solution events SHALL NOT publish public bearer anti-spam
fees or unlocked Cashu tokens. Solution submission remains fee-free.
