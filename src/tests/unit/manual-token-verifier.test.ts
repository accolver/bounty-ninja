// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const tokenInfo = {
	mint: 'https://mint.example',
	amount: 21,
	unit: 'sat',
	proofs: [{ id: 'keyset', amount: 21, secret: 'secret', C: 'point' }]
};
const condition: {
	target: string;
	primaryKeys: string[];
	refundKeys: string[];
	locktime: number | null;
	nSigs: number;
	nSigsRefund: number;
	sigFlag: string;
} = {
	target: `02${'a'.repeat(64)}`,
	primaryKeys: [`02${'a'.repeat(64)}`],
	refundKeys: [],
	locktime: null,
	nSigs: 1,
	nSigsRefund: 1,
	sigFlag: 'SIG_INPUTS'
};

vi.mock('$lib/cashu/token', () => ({ decodeToken: vi.fn(async () => tokenInfo) }));
vi.mock('$lib/cashu/pledge-verification', () => ({
	inspectP2PKProof: vi.fn(async () => condition)
}));
vi.mock('$lib/cashu/financial-verifier', () => ({
	verifyProofIssuance: vi.fn(async () => 'valid')
}));
vi.mock('$lib/utils/env', () => ({ assertPaymentWritesEnabled: vi.fn() }));

import {
	normalizeMinibitsPaymentPubkey,
	verifyManualP2PKToken,
	verifySourceProofsSpent
} from '$lib/cashu/manual-token-verifier';

function wallet(
	states: Array<{ state: 'UNSPENT' | 'SPENT' | 'PENDING' }> = [{ state: 'UNSPENT' }]
) {
	return vi.fn(async () => ({
		getMintInfo: () => ({ isSupported: () => ({ supported: true }) }),
		checkProofsStates: vi.fn(async () => states)
	}));
}

describe('manual Minibits token verification', () => {
	beforeEach(() => {
		condition.target = `02${'a'.repeat(64)}`;
		condition.locktime = null;
		condition.refundKeys = [];
		condition.nSigs = 1;
		condition.sigFlag = 'SIG_INPUTS';
	});

	it('preserves compressed key parity and rejects parity-less keys', () => {
		const key = 'a'.repeat(64);
		expect(normalizeMinibitsPaymentPubkey(`02${key.toUpperCase()}`)).toBe(`02${key}`);
		expect(normalizeMinibitsPaymentPubkey(`03${key}`)).toBe(`03${key}`);
		expect(() => normalizeMinibitsPaymentPubkey(key)).toThrow('complete');
		expect(() => normalizeMinibitsPaymentPubkey('nsec1not-a-public-key')).toThrow();
	});

	it('accepts only an exact, unspent, permanent SIG_INPUTS P2PK token', async () => {
		await expect(
			verifyManualP2PKToken(
				'cashuBtoken',
				{
					mintUrl: tokenInfo.mint,
					amount: 21,
					paymentPubkey: `02${'a'.repeat(64)}`
				},
				wallet()
			)
		).resolves.toMatchObject({ valid: true, paymentPubkey: `02${'a'.repeat(64)}` });

		condition.locktime = 123;
		await expect(
			verifyManualP2PKToken(
				'cashuBtoken',
				{
					mintUrl: tokenInfo.mint,
					amount: 21,
					paymentPubkey: `02${'a'.repeat(64)}`
				},
				wallet()
			)
		).resolves.toMatchObject({ valid: false, error: expect.stringContaining('no locktime') });
	});

	it('fails closed on amount, target, and proof-state mismatches', async () => {
		await expect(
			verifyManualP2PKToken(
				'cashuBtoken',
				{
					mintUrl: tokenInfo.mint,
					amount: 20,
					paymentPubkey: `02${'a'.repeat(64)}`
				},
				wallet()
			)
		).resolves.toMatchObject({ valid: false, error: expect.stringContaining('exactly 20') });

		condition.target = `02${'b'.repeat(64)}`;
		await expect(
			verifyManualP2PKToken(
				'cashuBtoken',
				{
					mintUrl: tokenInfo.mint,
					amount: 21,
					paymentPubkey: `02${'a'.repeat(64)}`
				},
				wallet()
			)
		).resolves.toMatchObject({ valid: false, error: expect.stringContaining('entered Minibits') });

		condition.target = `02${'a'.repeat(64)}`;
		await expect(
			verifyManualP2PKToken(
				'cashuBtoken',
				{
					mintUrl: tokenInfo.mint,
					amount: 21,
					paymentPubkey: `02${'a'.repeat(64)}`
				},
				wallet([{ state: 'SPENT' }])
			)
		).resolves.toMatchObject({ valid: false, error: expect.stringContaining('unspent') });
	});

	it('permits retraction only after every source proof is spent', async () => {
		await expect(
			verifySourceProofsSpent('cashuBsource', tokenInfo.mint, wallet([{ state: 'SPENT' }]))
		).resolves.toEqual({ spent: true });
		await expect(
			verifySourceProofsSpent('cashuBsource', tokenInfo.mint, wallet())
		).resolves.toMatchObject({ spent: false, error: expect.stringContaining('Revert') });
	});
});
