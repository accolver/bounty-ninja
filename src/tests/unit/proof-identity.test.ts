import { describe, expect, it } from 'vitest';
import type { Proof } from '@cashu/cashu-ts';
import { getProofIdentity, getProofIdentities, normalizeMintUrl } from '$lib/cashu/proof-identity';

describe('normalizeMintUrl', () => {
	it('normalizes host casing and trailing slashes', () => {
		expect(normalizeMintUrl('https://MINT.example/path///')).toBe('https://mint.example/path');
	});

	it.each([
		'http://mint.example',
		'https://user:pass@mint.example',
		'https://mint.example?secret=1',
		'https://mint.example/#fragment',
		'not a URL'
	])('rejects unsafe or unstable mint URL %s', (url) => {
		expect(() => normalizeMintUrl(url)).toThrow();
	});
});

describe('proof identity', () => {
	const proof = { id: 'keyset', amount: 8, secret: 'same secret', C: 'point' } as Proof;

	it('is stable for the same normalized mint and secret', async () => {
		const first = await getProofIdentity('https://mint.example/', proof);
		const sameSecretDifferentCarrier = {
			...proof,
			id: 'another-keyset',
			amount: 1,
			C: 'another-point'
		} as Proof;
		const second = await getProofIdentity('https://MINT.example', sameSecretDifferentCarrier);
		expect(first).toBe(second);
		expect(first).toMatch(/^https:\/\/mint\.example#0[23][0-9a-f]{64}$/);
	});

	it('scopes identical secrets to their mint', async () => {
		const first = await getProofIdentity('https://one.example', proof);
		const second = await getProofIdentity('https://two.example', proof);
		expect(first).not.toBe(second);
	});

	it('distinguishes different proof secrets', async () => {
		const identities = await getProofIdentities('https://mint.example', [
			proof,
			{ ...proof, secret: 'different secret' }
		]);
		expect(new Set(identities)).toHaveLength(2);
	});
});
