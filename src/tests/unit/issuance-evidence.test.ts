// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { Proof, Wallet } from '@cashu/cashu-ts';
import { verifyProofIssuance } from '$lib/cashu/financial-verifier';

// Deterministic NUT-12 fixture produced by cashu-ts blindMessage,
// createBlindSignature, createDLEQProof, and unblindSignature.
const proof: Proof = {
	id: 'id',
	amount: 1,
	secret: 'fixture',
	C: '0253bbbbab74d876d8782848212e82d177d7da7269b0a9b423ae2f323fce9356a7',
	dleq: {
		e: 'e00c8c203819389ef731e4c3d9841497616178ae3b67f77139797f3b06d7bed5',
		s: 'defe3d7d2bdf6d8e2409b641c8a2e94bb57af7becbb3d5b897fefd8b51719577',
		r: '0000000000000000000000000000000000000000000000000000000000000002'
	}
};
const keyset = {
	id: 'id',
	keys: { 1: '031b84c5567b126440995d3ed5aaba0565d71e1834604819ff9c17f5e9d5dd078f' }
};
const wallet = {
	keyChain: { ensureKeysetKeys: async () => keyset }
} as unknown as Wallet;

describe('mint issuance evidence', () => {
	it('cryptographically verifies a real cashu-ts NUT-12 fixture', async () => {
		await expect(verifyProofIssuance(proof, wallet)).resolves.toBe('valid');
	});

	it('rejects a fabricated unknown proof even when it claims an existing keyset', async () => {
		const fabricated = { ...proof, C: `02${'4'.repeat(64)}` };
		await expect(verifyProofIssuance(fabricated, wallet)).resolves.toBe('invalid');
	});

	it('fails closed when issuance evidence is absent', async () => {
		const { dleq: _dleq, ...withoutDleq } = proof;
		await expect(verifyProofIssuance(withoutDleq, wallet)).resolves.toBe('missing');
	});
});
