## Requirements

### Requirement: Pledger-Controlled Manual Release

After exactly one solution reaches validated consensus, each owner of an
unreleased validated pledge SHALL release only that source pledge. The bounty
creator has no authority over another pledger's proofs.

#### Scenario: Release one source

- **WHEN** the pledger selects an unreleased source
- **THEN** the application SHALL journal the intent before wallet handoff
- **AND** instruct the pledger to redeem the exact source in the same Minibits
  wallet and create an exact-amount, no-locktime permanent P2PK token to the
  winner's declared payment key
- **AND** verify every source proof is spent and every output proof is valid
  before publication

#### Scenario: Manual limitation

- **WHEN** the wallet swap is required
- **THEN** Bounty.ninja SHALL NOT claim to perform or sign that swap
- **AND** loss of the controlling wallet or pledger non-cooperation SHALL be
  disclosed as unrecoverable by the application

### Requirement: Source-Bound Payout Event

MVP SHALL publish one Kind 73004 payout per source pledge. It SHALL include the
bounty address, exactly one winning solution reference, exactly one source
pledge reference marked `source`, solver pubkey, amount, mint, token,
`['payment','cashu','<winner-x-only-key>']`, and client tag. The author SHALL own
the source pledge.

Duplicate sources, wrong authors, ambiguous winners, key redirection, wrong
mint/amount, unspent sources, and invalid output tokens SHALL not affect release
progress or reputation.

### Requirement: Solver Claim

The authenticated winning solver SHALL be able to copy the exact public payout
token. The UI SHALL direct them to the backed-up Minibits wallet matching their
solution payment key and SHALL not imply generic wallets can spend the lock.

Production release and reclaim writes SHALL remain disabled until the payment
launch gates are evidenced and the enablement change is separately reviewed.

### Requirement: Manual Reclaim

Reclaim SHALL instruct the pledger to use Minibits **Revert** on the original
pending send and warn against first importing the public source token. A pledge
retraction SHALL remain blocked until the mint reports every source proof spent.
No automatic or deadline-triggered reclaim is supported.
