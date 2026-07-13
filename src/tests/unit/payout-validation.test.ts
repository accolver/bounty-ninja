import { describe, expect, it } from 'vitest';
import type { NostrEvent } from 'nostr-tools';
import type { Payout, Pledge, Solution } from '$lib/bounty/types';
import type { CashuTokenVerification, PledgeVerification, ProofIdentity } from '$lib/cashu/types';
import { validatePayout, type PayoutValidationContext } from '$lib/bounty/payout-validation';

const OWNER = 'a'.repeat(64);
const SOLVER = 'b'.repeat(64);
const OTHER = 'c'.repeat(64);
const PAYMENT_KEY = `02${'d'.repeat(64)}`;
const ADDRESS = `37300:${'d'.repeat(64)}:bounty`;
const NOW = 1_000;
const SOURCE_PROOF = 'https://mint.example#source' as ProofIdentity;
const PAYOUT_PROOF = 'https://mint.example#payout' as ProofIdentity;
const event = {} as NostrEvent;

const pledge = {
	event,
	id: '1'.repeat(64),
	pubkey: OWNER,
	paymentPubkey: `02${'e'.repeat(64)}`,
	bountyAddress: ADDRESS,
	amount: 100,
	cashuToken: 'source-token',
	mintUrl: 'https://mint.example',
	createdAt: 1,
	message: ''
} satisfies Pledge;
const winner = {
	event,
	id: '2'.repeat(64),
	pubkey: SOLVER,
	paymentPubkey: PAYMENT_KEY,
	bountyAddress: ADDRESS,
	description: '',
	antiSpamTokens: [],
	antiSpamAmount: 0,
	deliverableUrl: null,
	createdAt: 2,
	voteWeight: 0
} satisfies Solution;
const payout = {
	event,
	id: '3'.repeat(64),
	pubkey: OWNER,
	bountyAddress: ADDRESS,
	solutionId: winner.id,
	solverPubkey: SOLVER,
	paymentPubkey: PAYMENT_KEY,
	amount: 100,
	cashuToken: 'payout-token',
	sourcePledgeId: pledge.id,
	mintUrl: 'https://mint.example/',
	createdAt: 3
} satisfies Payout;
const token = {
	status: 'valid',
	policyVersion: 1,
	checkedAt: NOW,
	validUntil: NOW + 300,
	normalizedMint: 'https://mint.example',
	decodedAmount: 100,
	proofIdentities: [PAYOUT_PROOF],
	issuanceAuthentic: true,
	proofState: 'unspent',
	p2pkTarget: PAYMENT_KEY,
	reasons: []
} satisfies CashuTokenVerification;

function context(overrides: Partial<PayoutValidationContext> = {}): PayoutValidationContext {
	return {
		bountyAddress: ADDRESS,
		bountyMint: 'https://mint.example',
		winner,
		activePledgesById: new Map([[pledge.id, pledge]]),
		payoutTokenVerifications: new Map([[payout.id, token]]),
		pledgeVerifications: new Map([
			[
				pledge.id,
				{
					pledgeId: pledge.id,
					status: 'valid',
					policyVersion: 1,
					checkedAt: NOW,
					validUntil: NOW + 300,
					normalizedMint: 'https://mint.example',
					decodedAmount: 100,
					proofIdentities: [SOURCE_PROOF],
					issuanceAuthentic: true,
					proofState: 'spent',
					reasons: []
				} satisfies PledgeVerification
			]
		]),
		alreadyReleasedPledgeIds: new Set(),
		globalProofOwners: new Map([[PAYOUT_PROOF, payout.id]]),
		globalProofSetComplete: true,
		now: NOW,
		...overrides
	};
}

describe('validatePayout', () => {
	it('accepts an exact source-owner, winner, mint, amount, and target match', () => {
		expect(validatePayout(payout, context())).toMatchObject({
			status: 'valid',
			sourcePledgeId: pledge.id,
			reasons: []
		});
	});

	it('rejects a publisher who is not the exact source owner', () => {
		const result = validatePayout({ ...payout, pubkey: OTHER }, context());
		expect(result.status).toBe('invalid');
		expect(result.reasons).toContain('unauthorized_source_owner');
	});

	it('rejects missing, unknown, inactive, and cross-bounty sources', () => {
		expect(validatePayout({ ...payout, sourcePledgeId: null }, context()).reasons).toContain(
			'missing_source_pledge'
		);
		expect(
			validatePayout({ ...payout, sourcePledgeId: '9'.repeat(64) }, context()).reasons
		).toContain('unknown_or_inactive_source_pledge');
		expect(
			validatePayout({ ...payout, bountyAddress: `${ADDRESS}-other` }, context()).reasons
		).toContain('wrong_bounty');
	});

	it('rejects payouts when consensus is absent or ambiguous', () => {
		const result = validatePayout(payout, context({ winner: null }));
		expect(result.status).toBe('invalid');
		expect(result.reasons).toContain('consensus_not_unique');
	});

	it('rejects non-winning solution references and recipient redirection', () => {
		expect(validatePayout({ ...payout, solutionId: '9'.repeat(64) }, context()).reasons).toContain(
			'wrong_solution'
		);
		expect(validatePayout({ ...payout, solverPubkey: OTHER }, context()).reasons).toContain(
			'wrong_recipient'
		);
	});

	it('rejects payout payment-key redirection independently of solver identity', () => {
		const result = validatePayout({ ...payout, paymentPubkey: OTHER }, context());
		expect(result.reasons).toContain('payment_key_mismatch');
	});

	it('rejects legacy winners and payouts without payment keys', () => {
		expect(validatePayout({ ...payout, paymentPubkey: null }, context()).reasons).toContain(
			'missing_payment_key'
		);
		expect(
			validatePayout(payout, context({ winner: { ...winner, paymentPubkey: null } })).reasons
		).toContain('winner_missing_payment_key');
	});

	it('rejects payout, source, bounty, and token mint mismatches', () => {
		expect(
			validatePayout({ ...payout, mintUrl: 'https://other.example' }, context()).reasons
		).toEqual(expect.arrayContaining(['mint_mismatch', 'token_mint_mismatch']));
		expect(
			validatePayout(
				payout,
				context({
					payoutTokenVerifications: new Map([
						[payout.id, { ...token, normalizedMint: 'https://other.example' }]
					])
				})
			).reasons
		).toContain('token_mint_mismatch');
	});

	it('rejects partial, excessive, zero, and token-mismatched amounts', () => {
		expect(validatePayout({ ...payout, amount: 50 }, context()).reasons).toContain(
			'source_amount_mismatch'
		);
		expect(validatePayout({ ...payout, amount: 101 }, context()).reasons).toContain(
			'source_amount_mismatch'
		);
		expect(validatePayout({ ...payout, amount: 0 }, context()).reasons).toContain('invalid_amount');
		expect(
			validatePayout(
				payout,
				context({
					payoutTokenVerifications: new Map([[payout.id, { ...token, decodedAmount: 99 }]])
				})
			).reasons
		).toContain('token_amount_mismatch');
	});

	it('rejects tokens not locked to the winning solver', () => {
		const result = validatePayout(
			payout,
			context({
				payoutTokenVerifications: new Map([[payout.id, { ...token, p2pkTarget: `02${OTHER}` }]])
			})
		);
		expect(result.reasons).toContain('token_target_mismatch');
	});

	it('marks missing, pending, unavailable, or stale verification unavailable', () => {
		expect(validatePayout(payout, context({ payoutTokenVerifications: new Map() })).status).toBe(
			'unavailable'
		);
		expect(
			validatePayout(
				payout,
				context({
					payoutTokenVerifications: new Map([[payout.id, { ...token, status: 'pending' }]])
				})
			).status
		).toBe('unavailable');
		expect(
			validatePayout(
				payout,
				context({ payoutTokenVerifications: new Map([[payout.id, { ...token, validUntil: NOW }]]) })
			).status
		).toBe('unavailable');
	});

	it('deduplicates release progress by source pledge id', () => {
		const result = validatePayout(
			payout,
			context({ alreadyReleasedPledgeIds: new Set([pledge.id]) })
		);
		expect(result.status).toBe('invalid');
		expect(result.reasons).toContain('duplicate_source_payout');
	});

	it('rejects globally replayed payout outputs and source/output identity overlap', () => {
		const replayed = validatePayout(
			payout,
			context({ globalProofOwners: new Map([[PAYOUT_PROOF, null]]) })
		);
		expect(replayed.reasons).toContain('globally_replayed_proof');

		const overlappingToken = { ...token, proofIdentities: [SOURCE_PROOF] };
		const overlap = validatePayout(
			payout,
			context({
				payoutTokenVerifications: new Map([[payout.id, overlappingToken]]),
				globalProofOwners: new Map([[SOURCE_PROOF, null]])
			})
		);
		expect(overlap.reasons).toEqual(
			expect.arrayContaining(['globally_replayed_proof', 'source_output_proof_overlap'])
		);
	});

	it('fails closed until global payout ownership is complete', () => {
		const result = validatePayout(payout, context({ globalProofSetComplete: false }));
		expect(result.status).toBe('invalid');
		expect(result.reasons).toContain('globally_replayed_proof');
	});
});
