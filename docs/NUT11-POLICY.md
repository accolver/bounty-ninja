# NUT-11 Pledge Policy

Bounty.ninja uses the NUT-11 `P2PK` condition implemented by
`@cashu/cashu-ts` 3.4.1. Payment writes remain disabled while external signer
and recovery work is incomplete.

## Required Conditions

Every deadline-bearing pledge output must contain:

- Primary `data`: the pledger's compressed payment public key.
- `locktime`: the bounty deadline as a positive Unix timestamp.
- `refund`: the same pledger payment public key.
- `n_sigs`: 1.
- `n_sigs_refund`: 1.
- `sigflag`: `SIG_INPUTS`.

Before locktime, the primary signature path is required. At or after locktime,
NUT-11 also permits the refund path. Because both paths name the pledger's key,
the public proof never becomes unsigned or anyone-spendable. The primary path
remains valid after locktime and cashu-ts may report it as `MAIN` when the same
signature satisfies both key sets.

A locktime without refund keys is forbidden. Under NUT-11 and cashu-ts it
becomes `UNLOCKED` at `now >= locktime`, allowing anyone who sees the public
pledge event to spend it.

## Mint Contract

The mint must advertise NUT-11 support through `MintInfo.isSupported(11)` before
the app creates any P2PK output. Missing or negative support fails closed.
Received pledge proofs must also pass the shared validation policy before they
can contribute financial value.

## Verification

`src/tests/integration/nut11-policy.test.ts` creates real cashu-ts `OutputData`,
inspects its serialized NUT-11 secret, and tests the before/at-locktime spending
boundary. It also demonstrates that the forbidden no-refund condition becomes
`UNLOCKED` at locktime.

Canonical protocol: `https://github.com/cashubtc/nuts/blob/main/11.md`.
