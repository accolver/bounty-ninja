import { describe, expect, it } from 'vitest';
import type { Proof, ProofState } from '@cashu/cashu-ts';
import type { Pledge } from '$lib/bounty/types';
import type { PledgeValidationInput, P2PKProofCondition } from '$lib/cashu/pledge-verification';
import { validatePledge } from '$lib/cashu/pledge-verification';
import type { ProofIdentity, TokenInfo } from '$lib/cashu/types';

const BOUNTY_ADDRESS = `37300:${'a'.repeat(64)}:bounty`;
const TARGET = `02${'b'.repeat(64)}`;
const IDENTITY = 'https://mint.example#proof-y' as ProofIdentity;

const proof = { id: 'keyset', amount: 100, secret: 'secret', C: 'point' } as Proof;
const pledge = {
	event: {} as Pledge['event'],
	id: 'pledge-1',
	pubkey: 'b'.repeat(64),
	paymentPubkey: 'b'.repeat(64),
	bountyAddress: BOUNTY_ADDRESS,
	amount: 100,
	cashuToken: 'cashuBtoken',
	mintUrl: 'https://mint.example/',
	createdAt: 1,
	message: ''
} satisfies Pledge;
const decoded = {
	mint: 'https://MINT.example',
	amount: 100,
	proofs: [proof],
	unit: 'sat'
} satisfies TokenInfo;
const state = { Y: 'proof-y', state: 'UNSPENT', witness: null } satisfies ProofState;
const condition = {
	target: TARGET,
	refundKeys: [],
	locktime: null,
	nSigs: 1,
	nSigsRefund: 1,
	sigFlag: 'SIG_INPUTS'
} satisfies P2PKProofCondition;

function input(overrides: Partial<PledgeValidationInput> = {}): PledgeValidationInput {
	return {
		pledge,
		bountyAddress: BOUNTY_ADDRESS,
		bountyMint: 'https://mint.example',
		decoded,
		proofStates: [state],
		proofIdentities: [IDENTITY],
		duplicateProofs: new Set(),
		conditions: [condition],
		checkedAt: 1_900_000_000,
		validUntil: 1_900_000_300,
		...overrides
	};
}

describe('validatePledge', () => {
	it('accepts exact sat, mint, amount, state, identity, and P2PK policy matches', () => {
		const result = validatePledge(input());
		expect(result.status).toBe('valid');
		expect(result.normalizedMint).toBe('https://mint.example');
		expect(result.decodedAmount).toBe(100);
		expect(result.reasons).toEqual([]);
	});

	it('rejects malformed tokens and non-sat units', () => {
		expect(validatePledge(input({ decoded: null })).reasons).toContain('decode_failed');
		const result = validatePledge(input({ decoded: { ...decoded, unit: 'usd' } }));
		expect(result.status).toBe('invalid');
		expect(result.reasons).toContain('wrong_unit');
	});

	it('rejects event, token, and bounty mint mismatches', () => {
		const result = validatePledge(input({ bountyMint: 'https://other.example' }));
		expect(result.status).toBe('invalid');
		expect(result.reasons).toContain('mint_mismatch');
	});

	it('rejects declared and decoded amount mismatches', () => {
		const result = validatePledge(input({ decoded: { ...decoded, amount: 99 } }));
		expect(result.status).toBe('invalid');
		expect(result.reasons).toContain('amount_mismatch');
		expect(
			validatePledge(input({ decoded: { ...decoded, proofs: [{ ...proof, amount: 99 }] } })).reasons
		).toContain('amount_mismatch');
	});

	it('rejects empty, non-positive, fractional, or unsafe proof values', () => {
		const empty = validatePledge(input({ decoded: { ...decoded, proofs: [], amount: 0 } }));
		expect(empty.reasons).toEqual(expect.arrayContaining(['missing_proofs', 'invalid_amount']));
		const fractionalProof = { ...proof, amount: 1.5 };
		expect(
			validatePledge(input({ decoded: { ...decoded, proofs: [fractionalProof] } })).reasons
		).toContain('invalid_amount');
	});

	it('marks mint outages and pending proofs unavailable', () => {
		const outage = validatePledge(input({ proofStates: null, mintUnavailable: true }));
		expect(outage.status).toBe('unavailable');
		expect(outage.reasons).toContain('mint_unavailable');
		const pending = validatePledge(input({ proofStates: [{ ...state, state: 'PENDING' }] }));
		expect(pending.status).toBe('unavailable');
		expect(pending.reasons).toContain('pending_proof');
	});

	it('rejects spent proofs and proof-state cardinality mismatches', () => {
		expect(
			validatePledge(input({ proofStates: [{ ...state, state: 'SPENT' }] })).reasons
		).toContain('spent_proof');
		expect(validatePledge(input({ proofStates: [] })).reasons).toContain('proof_state_mismatch');
	});

	it('rejects duplicate proof identities within or across pledges', () => {
		const secondProof = { ...proof, secret: 'second' };
		const internal = validatePledge(
			input({
				decoded: { ...decoded, proofs: [proof, secondProof], amount: 100 },
				proofStates: [state, state],
				proofIdentities: [IDENTITY, IDENTITY],
				conditions: [condition, condition]
			})
		);
		expect(internal.reasons).toContain('duplicate_proof');
		expect(validatePledge(input({ duplicateProofs: new Set([IDENTITY]) })).reasons).toContain(
			'duplicate_proof'
		);
	});

	it('rejects ordinary proofs and wrong P2PK targets', () => {
		expect(validatePledge(input({ conditions: [null] })).reasons).toContain('not_p2pk');
		expect(
			validatePledge(input({ conditions: [{ ...condition, target: `02${'d'.repeat(64)}` }] }))
				.reasons
		).toContain('p2pk_target_mismatch');
	});

	it('rejects unsafe locktime and refund policies', () => {
		expect(
			validatePledge(input({ conditions: [{ ...condition, locktime: 1 }] })).reasons
		).toContain('locktime_mismatch');
		expect(
			validatePledge(input({ conditions: [{ ...condition, refundKeys: [`02${'c'.repeat(64)}`] }] }))
				.reasons
		).toContain('refund_policy_mismatch');
		expect(validatePledge(input({ conditions: [{ ...condition, nSigs: 0 }] })).reasons).toContain(
			'signature_policy_mismatch'
		);
		expect(
			validatePledge(input({ conditions: [{ ...condition, sigFlag: 'SIG_ALL' }] })).reasons
		).toContain('signature_policy_mismatch');
	});

	it('rejects legacy pledges without an explicit payment key', () => {
		const result = validatePledge(input({ pledge: { ...pledge, paymentPubkey: null } }));
		expect(result.status).toBe('invalid');
		expect(result.reasons).toContain('missing_payment_key');
	});

	it('rejects mixed proof conditions', () => {
		const secondProof = { ...proof, secret: 'second' };
		const result = validatePledge(
			input({
				decoded: { ...decoded, proofs: [proof, secondProof], amount: 100 },
				proofStates: [state, state],
				proofIdentities: [IDENTITY, 'https://mint.example#second' as ProofIdentity],
				conditions: [condition, { ...condition, sigFlag: 'SIG_ALL' }]
			})
		);
		expect(result.reasons).toContain('inconsistent_proof_conditions');
	});

	it('rejects cross-bounty pledges before they gain value', () => {
		const result = validatePledge(input({ bountyAddress: `${BOUNTY_ADDRESS}-other` }));
		expect(result.status).toBe('invalid');
		expect(result.reasons).toContain('wrong_bounty');
	});
});
