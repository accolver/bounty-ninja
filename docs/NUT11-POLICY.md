# NUT-11 Pledge Policy

Bounty.ninja uses the NUT-11 `P2PK` condition implemented by
`@cashu/cashu-ts` 3.4.1. Payment writes remain disabled while external signer
and recovery work is incomplete.

## Required Conditions

Every pledge and payout proof must contain:

- Exactly one primary compressed public key, including its `02`/`03` parity.
- No additional `pubkeys`.
- No `locktime`.
- No `refund` keys.
- `n_sigs`: 1.
- `sigflag`: `SIG_INPUTS`.

Validation parses the raw NUT-11 secret. Duplicate policy tags, duplicate
additional keys, non-canonical integer strings, unknown tags, and conflicting
refund/locktime policy are rejected rather than normalized by convenience
accessors.

This is a permanent lock. A bounty deadline never changes Cashu authorization.
Parity-less x-only keys and npubs are rejected because inventing an `02` prefix
can redirect an odd-parity Minibits key.

## Mint Contract

The mint must advertise NUT-11 support through `MintInfo.isSupported(11)` before
the app creates any P2PK output. Missing or negative support fails closed.
Received pledge proofs must also pass the shared validation policy before they
can contribute financial value. Every proof must carry NUT-12 DLEQ evidence and
cashu-ts must verify it against the exact mint keyset. NUT-07 `UNSPENT` is only
mutable spend state and never proves mint issuance.

## Verification

`src/tests/integration/nut11-policy.test.ts` creates real cashu-ts `OutputData`
and verifies permanent signature behavior. `issuance-evidence.test.ts` verifies
a real NUT-12 fixture and rejects fabricated proof signatures.

Canonical protocol: `https://github.com/cashubtc/nuts/blob/main/11.md`.
