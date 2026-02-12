/**
 * Unit tests for $lib/cashu/token.ts — encoding, decoding, validation.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Proof, Token } from '@cashu/cashu-ts';

// Mock @cashu/cashu-ts so we don't need a real mint
vi.mock('@cashu/cashu-ts', () => ({
	getEncodedTokenV4: vi.fn(),
	getDecodedToken: vi.fn()
}));

import { getEncodedTokenV4, getDecodedToken } from '@cashu/cashu-ts';
import { encodeToken, decodeToken, getTokenAmount, getProofsAmount, isValidToken } from '$lib/cashu/token';

const mockedGetEncodedTokenV4 = vi.mocked(getEncodedTokenV4);
const mockedGetDecodedToken = vi.mocked(getDecodedToken);

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
	it('encodes proofs into a v4 token string', () => {
		mockedGetEncodedTokenV4.mockReturnValue('cashuBencoded123');
		const proofs = [mockProof(100)];

		const result = encodeToken(proofs, MINT_URL);

		expect(result).toBe('cashuBencoded123');
		expect(mockedGetEncodedTokenV4).toHaveBeenCalledWith(
			expect.objectContaining({
				mint: MINT_URL,
				proofs,
				unit: 'sat'
			})
		);
	});

	it('includes memo when provided', () => {
		mockedGetEncodedTokenV4.mockReturnValue('cashuBwithmemo');

		encodeToken([mockProof(50)], MINT_URL, 'test memo');

		expect(mockedGetEncodedTokenV4).toHaveBeenCalledWith(
			expect.objectContaining({ memo: 'test memo' })
		);
	});

	it('omits memo when not provided', () => {
		mockedGetEncodedTokenV4.mockReturnValue('cashuBnomemo');

		encodeToken([mockProof(50)], MINT_URL);

		const call = mockedGetEncodedTokenV4.mock.calls[0][0];
		expect(call).not.toHaveProperty('memo');
	});

	it('handles empty proofs array', () => {
		mockedGetEncodedTokenV4.mockReturnValue('cashuBempty');

		const result = encodeToken([], MINT_URL);
		expect(result).toBe('cashuBempty');
	});

	it('handles multiple proofs of different denominations', () => {
		mockedGetEncodedTokenV4.mockReturnValue('cashuBmulti');
		const proofs = [mockProof(1), mockProof(2), mockProof(4), mockProof(8)];

		const result = encodeToken(proofs, MINT_URL);

		expect(result).toBe('cashuBmulti');
		const call = mockedGetEncodedTokenV4.mock.calls[0][0];
		expect(call.proofs).toHaveLength(4);
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// decodeToken
// ═══════════════════════════════════════════════════════════════════════════

describe('decodeToken', () => {
	it('decodes a valid token string', () => {
		mockedGetDecodedToken.mockReturnValue({
			mint: MINT_URL,
			proofs: [mockProof(100), mockProof(50)],
			memo: 'test',
			unit: 'sat'
		} as Token);

		const result = decodeToken('cashuBvalid');

		expect(result).not.toBeNull();
		expect(result!.mint).toBe(MINT_URL);
		expect(result!.amount).toBe(150);
		expect(result!.proofs).toHaveLength(2);
		expect(result!.memo).toBe('test');
		expect(result!.unit).toBe('sat');
	});

	it('returns null for malformed token', () => {
		mockedGetDecodedToken.mockImplementation(() => {
			throw new Error('Invalid token format');
		});

		const result = decodeToken('not-a-token');
		expect(result).toBeNull();
	});

	it('computes amount from proof sum', () => {
		mockedGetDecodedToken.mockReturnValue({
			mint: MINT_URL,
			proofs: [mockProof(1), mockProof(2), mockProof(4), mockProof(8), mockProof(16)],
			unit: 'sat'
		} as Token);

		const result = decodeToken('cashuBsum');
		expect(result!.amount).toBe(31);
	});

	it('handles token with zero proofs', () => {
		mockedGetDecodedToken.mockReturnValue({
			mint: MINT_URL,
			proofs: [],
			unit: 'sat'
		} as Token);

		const result = decodeToken('cashuBempty');
		expect(result).not.toBeNull();
		expect(result!.amount).toBe(0);
		expect(result!.proofs).toHaveLength(0);
	});

	it('handles token without memo', () => {
		mockedGetDecodedToken.mockReturnValue({
			mint: MINT_URL,
			proofs: [mockProof(42)],
			unit: 'sat'
		} as Token);

		const result = decodeToken('cashuBnomemo');
		expect(result!.memo).toBeUndefined();
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// getTokenAmount
// ═══════════════════════════════════════════════════════════════════════════

describe('getTokenAmount', () => {
	it('returns total amount for valid token', () => {
		mockedGetDecodedToken.mockReturnValue({
			mint: MINT_URL,
			proofs: [mockProof(100), mockProof(50)],
			unit: 'sat'
		} as Token);

		expect(getTokenAmount('cashuBvalid')).toBe(150);
	});

	it('returns 0 for malformed token', () => {
		mockedGetDecodedToken.mockImplementation(() => {
			throw new Error('Bad token');
		});

		expect(getTokenAmount('garbage')).toBe(0);
	});

	it('returns 0 for token with no proofs', () => {
		mockedGetDecodedToken.mockReturnValue({
			mint: MINT_URL,
			proofs: [],
			unit: 'sat'
		} as Token);

		expect(getTokenAmount('cashuBempty')).toBe(0);
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
	it('returns true for valid token with amount > 0', () => {
		mockedGetDecodedToken.mockReturnValue({
			mint: MINT_URL,
			proofs: [mockProof(100)],
			unit: 'sat'
		} as Token);

		expect(isValidToken('cashuBvalid')).toBe(true);
	});

	it('returns false for malformed token', () => {
		mockedGetDecodedToken.mockImplementation(() => {
			throw new Error('Invalid');
		});

		expect(isValidToken('garbage')).toBe(false);
	});

	it('returns false for token with zero amount', () => {
		mockedGetDecodedToken.mockReturnValue({
			mint: MINT_URL,
			proofs: [],
			unit: 'sat'
		} as Token);

		expect(isValidToken('cashuBzeroproofs')).toBe(false);
	});

	it('returns false for token with empty proofs', () => {
		mockedGetDecodedToken.mockReturnValue({
			mint: MINT_URL,
			proofs: [],
			unit: 'sat'
		} as Token);

		expect(isValidToken('cashuBnoproofs')).toBe(false);
	});

	it('returns true for token with multiple proofs', () => {
		mockedGetDecodedToken.mockReturnValue({
			mint: MINT_URL,
			proofs: [mockProof(1), mockProof(2), mockProof(4)],
			unit: 'sat'
		} as Token);

		expect(isValidToken('cashuBmulti')).toBe(true);
	});
});
