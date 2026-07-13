import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	OutputData,
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
const PLEDGER = `02${getPublicKey(PRIVATE_KEY)}`;

function serializedSecret(): string {
	const options = createP2PKLock(PLEDGER);
	const output = OutputData.createSingleP2PKData(options, 1, '00aabbcc');
	return new TextDecoder().decode(output.secret);
}

function proof(secret: string): Proof {
	return { id: '00aabbcc', amount: 1, secret, C: `02${'2'.repeat(64)}` } as Proof;
}

describe('cashu-ts NUT-11 pledge fixture', () => {
	afterEach(() => vi.useRealTimers());

	it('serializes one permanent primary signer with no refund path', () => {
		const secret = serializedSecret();
		const expectedKey = toCompressedPubkey(PLEDGER);

		expect(getSecretKind(secret)).toBe('P2PK');
		expect(getSecretData(secret).data).toBe(expectedKey);
		expect(getP2PKLocktime(secret)).toBe(Infinity);
		expect(getP2PKWitnessRefundkeys(secret)).toEqual([]);
		expect(getP2PKSigFlag(secret)).toBe('SIG_INPUTS');
	});

	it('refuses locktime construction without an explicit refund signer', () => {
		expect(() => createP2PKLock(PLEDGER, 1_800_000_000)).toThrow(
			'locktime requires at least one refund key'
		);
	});

	it('requires the primary signature permanently', () => {
		const unsigned = proof(serializedSecret());
		expect(verifyP2PKSpendingConditions(unsigned)).toMatchObject({
			success: false,
			path: 'FAILED'
		});
		expect(verifyP2PKSpendingConditions(signP2PKProof(unsigned, PRIVATE_KEY))).toMatchObject({
			success: true,
			path: 'MAIN'
		});
	});
});
