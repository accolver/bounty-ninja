import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	OutputData,
	createP2PKsecret,
	getP2PKLocktime,
	getP2PKSigFlag,
	getP2PKWitnessRefundkeys,
	getSecretData,
	getSecretKind,
	signP2PKProof,
	verifyP2PKSpendingConditions,
	type Proof
} from '@cashu/cashu-ts';
import { createP2PKLock, toCompressedPubkey } from '$lib/cashu/p2pk';
import { getPublicKey } from 'nostr-tools';

const PRIVATE_KEY = new Uint8Array(32).fill(0x11);
const PLEDGER = getPublicKey(PRIVATE_KEY);
const LOCKTIME = 1_800_000_000;

function serializedSecret(): string {
	const options = createP2PKLock(PLEDGER, LOCKTIME, [PLEDGER]);
	const output = OutputData.createSingleP2PKData(options, 1, '00aabbcc');
	return new TextDecoder().decode(output.secret);
}

function proof(secret: string): Proof {
	return { id: '00aabbcc', amount: 1, secret, C: `02${'2'.repeat(64)}` } as Proof;
}

describe('cashu-ts NUT-11 pledge fixture', () => {
	afterEach(() => vi.useRealTimers());

	it('serializes the pledger as both primary and post-locktime refund signer', () => {
		const secret = serializedSecret();
		const expectedKey = toCompressedPubkey(PLEDGER);

		expect(getSecretKind(secret)).toBe('P2PK');
		expect(getSecretData(secret).data).toBe(expectedKey);
		expect(getP2PKLocktime(secret)).toBe(LOCKTIME);
		expect(getP2PKWitnessRefundkeys(secret)).toEqual([expectedKey]);
		expect(getP2PKSigFlag(secret)).toBe('SIG_INPUTS');
	});

	it('refuses to construct publicly unlocked post-locktime proofs', () => {
		expect(() => createP2PKLock(PLEDGER, LOCKTIME)).toThrow(
			'locktime requires at least one refund key'
		);
	});

	it('requires a signature before and after locktime when the refund key is present', () => {
		vi.useFakeTimers({ toFake: ['Date'] });
		const unsigned = proof(serializedSecret());

		vi.setSystemTime(new Date((LOCKTIME - 1) * 1000));
		expect(verifyP2PKSpendingConditions(unsigned)).toMatchObject({
			success: false,
			path: 'FAILED'
		});

		vi.setSystemTime(new Date(LOCKTIME * 1000));
		expect(verifyP2PKSpendingConditions(unsigned)).toMatchObject({
			success: false,
			path: 'FAILED'
		});
		expect(verifyP2PKSpendingConditions(signP2PKProof(unsigned, PRIVATE_KEY))).toMatchObject({
			success: true,
			path: 'MAIN'
		});
	});

	it('demonstrates that cashu-ts unlocks a no-refund proof at locktime', () => {
		vi.useFakeTimers({ toFake: ['Date'] });
		vi.setSystemTime(new Date(LOCKTIME * 1000));
		const unsafeSecret = createP2PKsecret(toCompressedPubkey(PLEDGER), [
			['locktime', String(LOCKTIME)],
			['sigflag', 'SIG_INPUTS']
		]);

		expect(verifyP2PKSpendingConditions(proof(unsafeSecret))).toMatchObject({
			success: true,
			path: 'UNLOCKED'
		});
	});
});
