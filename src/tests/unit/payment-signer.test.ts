import { describe, expect, it, vi } from 'vitest';
import type { Proof } from '@cashu/cashu-ts';
import {
	CASHU_PAYMENT_SIGNER_PROTOCOL,
	PaymentSigningError,
	requestP2PKSignatures,
	type CashuPaymentSigner
} from '$lib/cashu/payment-signer';

function proof(id: string, amount = 10): Proof {
	return { id, amount, secret: `secret-${id}`, C: `c-${id}` };
}

function signer(sign: CashuPaymentSigner['signP2PKProofs']): CashuPaymentSigner {
	return {
		protocol: CASHU_PAYMENT_SIGNER_PROTOCOL,
		getPublicKey: vi.fn(async () => `02${'a'.repeat(64)}`),
		signP2PKProofs: sign
	};
}

describe('requestP2PKSignatures', () => {
	it('rejects capabilities outside manual-minibits-v1', async () => {
		const incompatible = {
			...signer(vi.fn(async ({ proofs }) => [...proofs])),
			protocol: 'other-protocol'
		} as unknown as CashuPaymentSigner;
		await expect(
			requestP2PKSignatures(incompatible, {
				mintUrl: 'https://mint.example',
				proofs: [proof('a')],
				purpose: 'release'
			})
		).rejects.toThrow('Unsupported Cashu payment signer protocol');
	});
	it('accepts witness-only proof copies from an asynchronous payment capability', async () => {
		const source = [proof('a'), proof('b', 20)];
		const paymentSigner = signer(
			vi.fn(async ({ proofs }) =>
				proofs.map((item: Proof) => ({ ...item, witness: { signatures: ['signature'] } }))
			)
		);

		const result = await requestP2PKSignatures(paymentSigner, {
			mintUrl: 'https://mint.example',
			proofs: source,
			purpose: 'release'
		});

		expect(result).toHaveLength(2);
		expect(result.every((item) => item.witness !== undefined)).toBe(true);
		expect(source.every((item) => item.witness === undefined)).toBe(true);
	});

	it('rejects altered, reordered, missing, or unwitnessed proofs', async () => {
		const source = [proof('a'), proof('b')];
		const invalidResults: Proof[][] = [
			[
				{ ...source[0], amount: 11, witness: 'witness' },
				{ ...source[1], witness: 'witness' }
			],
			[
				{ ...source[1], witness: 'witness' },
				{ ...source[0], witness: 'witness' }
			],
			[{ ...source[0], witness: 'witness' }],
			[source[0], { ...source[1], witness: 'witness' }]
		];

		for (const signedProofs of invalidResults) {
			await expect(
				requestP2PKSignatures(signer(vi.fn(async () => signedProofs)), {
					mintUrl: 'https://mint.example',
					proofs: source,
					purpose: 'reclaim'
				})
			).rejects.toBeInstanceOf(PaymentSigningError);
		}
	});

	it('propagates wallet authorization failures', async () => {
		const paymentSigner = signer(
			vi.fn(async () => {
				throw new Error('User rejected payment authorization');
			})
		);

		await expect(
			requestP2PKSignatures(paymentSigner, {
				mintUrl: 'https://mint.example',
				proofs: [proof('a')],
				purpose: 'release'
			})
		).rejects.toThrow('User rejected payment authorization');
	});
});
