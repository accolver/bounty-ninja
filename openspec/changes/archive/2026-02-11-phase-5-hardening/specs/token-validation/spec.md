## ADDED Requirements

### Requirement: Cashu Token Verification Service

A `TokenValidator` service SHALL be created at
`src/lib/cashu/token-validator.svelte.ts` that asynchronously verifies Cashu
tokens embedded in Kind 73002 pledge events against the issuing mint. The
service MUST expose reactive state for each token's verification status using
Svelte 5 runes. Token verification MUST be lazy — triggered only when a pledge
becomes visible in the viewport or when a user navigates to a bounty detail
page.

The validator MUST use `@cashu/cashu-ts` `CashuMint.check()` (or equivalent
proof state check) to determine whether token proofs are still spendable. The
service MUST cache verification results in memory keyed by the serialized token
hash to avoid redundant mint requests.

#### Scenario: Valid token is verified against mint

- **WHEN** a Kind 73002 pledge event containing a `cashu` tag is loaded into the
  bounty detail view
- **THEN** the `TokenValidator` SHALL asynchronously contact the mint URL from
  the pledge's `mint` tag
- **AND** verify the token proofs are spendable
- **AND** set the pledge's verification status to `"verified"`

#### Scenario: Double-spent token is detected

- **WHEN** the mint responds that one or more proofs in the token have already
  been spent
- **THEN** the pledge's verification status SHALL be set to `"invalid"`
- **AND** the pledge amount SHALL NOT be included in the bounty's `totalPledged`
  calculation
- **AND** the UI SHALL display a warning badge: "This token has already been
  claimed"

#### Scenario: Mint is unreachable during verification

- **WHEN** the mint URL is unreachable (network error, timeout, HTTP error)
- **THEN** the service SHALL retry up to 3 times with a 2-second delay between
  attempts
- **AND** if all retries fail, the pledge's verification status SHALL be set to
  `"unverified"`
- **AND** the pledge amount SHALL still be displayed but with an "Unverified
  pledge" badge

#### Scenario: Malformed token structure

- **WHEN** the `cashu` tag contains a value that cannot be decoded as a valid
  Cashu token (invalid base64, missing required fields, unsupported version)
- **THEN** the pledge's verification status SHALL be set to `"invalid"`
- **AND** the pledge amount SHALL NOT be included in `totalPledged`
- **AND** the UI SHALL display: "Invalid token"

### Requirement: Token Verification Status Types

A `TokenVerificationStatus` type SHALL be defined as a union of
`"pending" | "verified" | "unverified" | "invalid" | "expired"`. All pledge
display components MUST consume this status to render the appropriate badge.

#### Scenario: Pending state shown during verification

- **WHEN** a pledge is first loaded and verification has not yet completed
- **THEN** the pledge SHALL display a `"pending"` status with a subtle loading
  indicator
- **AND** the pledge amount SHALL be displayed in a muted style

#### Scenario: Expired token detected via locktime

- **WHEN** the token's P2PK lock includes a `locktime` field and that timestamp
  is in the past
- **THEN** the pledge's verification status SHALL be set to `"expired"`
- **AND** the UI SHALL display: "Pledge expired. Reclaim your tokens."
- **AND** if the current user is the pledge funder, a "Reclaim" action SHALL be
  available

### Requirement: Verification Result Caching

Token verification results MUST be cached in memory for the duration of the
browser session. The cache key SHALL be derived from a hash of the serialized
token string. Cached results MUST have a TTL of 5 minutes, after which
re-verification SHALL occur on next access.

#### Scenario: Cached result avoids redundant mint request

- **WHEN** a pledge token was verified within the last 5 minutes
- **AND** the user navigates away from and back to the bounty detail page
- **THEN** the cached verification result SHALL be used without contacting the
  mint

#### Scenario: Cache entry expires and triggers re-verification

- **WHEN** a cached verification result is older than 5 minutes
- **AND** the pledge becomes visible again
- **THEN** a fresh verification request SHALL be sent to the mint

### Requirement: Pledge Display Integration

The `PledgeItem.svelte` and `PledgeList.svelte` components MUST integrate with
the `TokenValidator` to display verification badges. The `BountyCard.svelte`
total pledged amount MUST only include pledges with `"verified"` or
`"unverified"` status — never `"invalid"` pledges.

#### Scenario: Bounty card shows adjusted total

- **WHEN** a bounty has 3 pledges: one verified (1000 sats), one unverified (500
  sats), and one invalid (2000 sats)
- **THEN** the `BountyCard` SHALL display a total of 1500 sats
- **AND** the bounty detail page SHALL show all 3 pledges with their respective
  badges
