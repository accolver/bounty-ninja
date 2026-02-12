/**
 * Unit tests for $lib/cashu/token.ts — encoding, decoding, validation.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Proof, Token } from '@cashu/cashu-ts';

// Mock the lazy loader so we don't need the real @cashu/cashu-ts module
const mockGetEncodedTokenV4 = vi.fn();
const mockGetDecodedToken = vi.fn();

vi.mock('$lib/cashu/lazy', () => ({
	getCashu: vi.fn(async () => ({
		getEncodedTokenV4: mockGetEncodedTokenV4,
		getDecodedToken: mockGetDecodedToken
	}))
}));

import { encodeToken, decodeToken, getTokenAmount, getProofsAmount, isValidToken } from '$lib/cashu/token';

const MINT_URL = 'https://mint.example.com';

function mockProof(amount: number): Proof {
	return { id: 'proof-id', amount, secret: 'secret', C: 'c' } as Proof;
}

beforeEach(() => {
	vi.clearAllMocks();
});

// ═══════════════════════════════════════════════════════════════════════════
// encodeToken
// ═══════════════════════════════════════════════════════════════════════════

describe('encodeToken', () => {
	it('encodes proofs into a v4 token string', async () => {
		mockGetEncodedTokenV4.mockReturnValue('cashuBencoded123');
		const proofs = [mockProof(100)];

		const result = await encodeToken(proofs, MINT_URL);

		expect(result).toBe('cashuBencoded123');
		expect(mockGetEncodedTokenV4).toHaveBeenCalledWith(
			expect.objectContaining({
				mint: MINT_URL,
				proofs,
				unit: 'sat'
			})
		);
	});

	it('includes memo when provided', async () => {
		mockGetEncodedTokenV4.mockReturnValue('cashuBwithmemo');

		await encodeToken([mockProof(50)], MINT_URL, 'test memo');

		expect(mockGetEncodedTokenV4).toHaveBeenCalledWith(
			expect.objectContaining({ memo: 'test memo' })
		);
	});

	it('omits memo when not provided', async () => {
		mockGetEncodedTokenV4.mockReturnValue('cashuBnomemo');

		await encodeToken([mockProof(50)], MINT_URL);

		const call = mockGetEncodedTokenV4.mock.calls[0][0];
		expect(call).not.toHaveProperty('memo');
	});

	it('handles empty proofs array', async () => {
		mockGetEncodedTokenV4.mockReturnValue('cashuBempty');

		const result = await encodeToken([], MINT_URL);
		expect(result).toBe('cashuBempty');
	});

	it('handles multiple proofs of different denominations', async () => {
		mockGetEncodedTokenV4.mockReturnValue('cashuBmulti');
		const proofs = [mockProof(1), mockProof(2), mockProof(4), mockProof(8)];

		const result = await encodeToken(proofs, MINT_URL);

		expect(result).toBe('cashuBmulti');
		const call = mockGetEncodedTokenV4.mock.calls[0][0];
		expect(call.proofs).toHaveLength(4);
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// decodeToken
// ═══════════════════════════════════════════════════════════════════════════

describe('decodeToken', () => {
	it('decodes a valid token string', async () => {
		mockGetDecodedToken.mockReturnValue({
			mint: MINT_URL,
			proofs: [mockProof(100), mockProof(50)],
			memo: 'test',
			unit: 'sat'
		} as Token);

		const result = await decodeToken('cashuBvalid');

		expect(result).not.toBeNull();
		expect(result!.mint).toBe(MINT_URL);
		expect(result!.amount).toBe(150);
		expect(result!.proofs).toHaveLength(2);
		expect(result!.memo).toBe('test');
		expect(result!.unit).toBe('sat');
	});

	it('returns null for malformed token', async () => {
		mockGetDecodedToken.mockImplementation(() => {
			throw new Error('Invalid token format');
		});

		const result = await decodeToken('not-a-token');
		expect(result).toBeNull();
	});

	it('computes amount from proof sum', async () => {
		mockGetDecodedToken.mockReturnValue({
			mint: MINT_URL,
			proofs: [mockProof(1), mockProof(2), mockProof(4), mockProof(8), mockProof(16)],
			unit: 'sat'
		} as Token);

		const result = await decodeToken('cashuBsum');
		expect(result!.amount).toBe(31);
	});

	it('handles token with zero proofs', async () => {
		mockGetDecodedToken.mockReturnValue({
			mint: MINT_URL,
			proofs: [],
			unit: 'sat'
		} as Token);

		const result = await decodeToken('cashuBempty');
		expect(result).not.toBeNull();
		expect(result!.amount).toBe(0);
		expect(result!.proofs).toHaveLength(0);
	});

	it('handles token without memo', async () => {
		mockGetDecodedToken.mockReturnValue({
			mint: MINT_URL,
			proofs: [mockProof(42)],
			unit: 'sat'
		} as Token);

		const result = await decodeToken('cashuBnomemo');
		expect(result!.memo).toBeUndefined();
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// getTokenAmount
// ═══════════════════════════════════════════════════════════════════════════

describe('getTokenAmount', () => {
	it('returns total amount for valid token', async () => {
		mockGetDecodedToken.mockReturnValue({
			mint: MINT_URL,
			proofs: [mockProof(100), mockProof(50)],
			unit: 'sat'
		} as Token);

		expect(await getTokenAmount('cashuBvalid')).toBe(150);
	});

	it('returns 0 for malformed token', async () => {
		mockGetDecodedToken.mockImplementation(() => {
			throw new Error('Bad token');
		});

		expect(await getTokenAmount('garbage')).toBe(0);
	});

	it('returns 0 for token with no proofs', async () => {
		mockGetDecodedToken.mockReturnValue({
			mint: MINT_URL,
			proofs: [],
			unit: 'sat'
		} as Token);

		expect(await getTokenAmount('cashuBempty')).toBe(0);
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// getProofsAmount
// ═══════════════════════════════════════════════════════════════════════════

describe('getProofsAmount', () => {
	it('sums proof amounts', () => {
		expect(getProofsAmount([mockProof(100), mockProof(50), mockProof(25)])).toBe(175);
	});

	it('returns 0 for empty array', () => {
		expect(getProofsAmount([])).toBe(0);
	});

	it('handles single proof', () => {
		expect(getProofsAmount([mockProof(42)])).toBe(42);
	});

	it('handles proofs with zero amounts', () => {
		expect(getProofsAmount([mockProof(0), mockProof(0)])).toBe(0);
	});

	it('handles large denomination proofs', () => {
		expect(getProofsAmount([mockProof(1000000), mockProof(500000)])).toBe(1500000);
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// isValidToken
// ═══════════════════════════════════════════════════════════════════════════

describe('isValidToken', () => {
	it('returns true for valid token with amount > 0', async () => {
		mockGetDecodedToken.mockReturnValue({
			mint: MINT_URL,
			proofs: [mockProof(100)],
			unit: 'sat'
		} as Token);

		expect(await isValidToken('cashuBvalid')).toBe(true);
	});

	it('returns false for malformed token', async () => {
		mockGetDecodedToken.mockImplementation(() => {
			throw new Error('Invalid');
		});

		expect(await isValidToken('garbage')).toBe(false);
	});

	it('returns false for token with zero amount', async () => {
		mockGetDecodedToken.mockReturnValue({
			mint: MINT_URL,
			proofs: [],
			unit: 'sat'
		} as Token);

		expect(await isValidToken('cashuBzeroproofs')).toBe(false);
	});

	it('returns false for token with empty proofs', async () => {
		mockGetDecodedToken.mockReturnValue({
			mint: MINT_URL,
			proofs: [],
			unit: 'sat'
		} as Token);

		expect(await isValidToken('cashuBnoproofs')).toBe(false);
	});

	it('returns true for token with multiple proofs', async () => {
		mockGetDecodedToken.mockReturnValue({
			mint: MINT_URL,
			proofs: [mockProof(1), mockProof(2), mockProof(4)],
			unit: 'sat'
		} as Token);

		expect(await isValidToken('cashuBmulti')).toBe(true);
	});
});
