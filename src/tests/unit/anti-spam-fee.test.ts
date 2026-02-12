/**
 * Unit tests for anti-spam fee validation ($lib/cashu/token.ts — validateAntiSpamFee).
 *
 * Tests the async validation function that checks whether a pasted Cashu token
 * is valid and meets the minimum fee requirement for bounty solution submissions.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Proof, Token } from '@cashu/cashu-ts';

// Mock the lazy loader so we don't need the real @cashu/cashu-ts module
const mockGetDecodedToken = vi.fn();

vi.mock('$lib/cashu/lazy', () => ({
	getCashu: vi.fn(async () => ({
		getEncodedTokenV4: vi.fn(),
		getDecodedToken: mockGetDecodedToken
	}))
}));

import { validateAntiSpamFee } from '$lib/cashu/token';

const MINT_URL = 'https://mint.example.com';

function mockProof(amount: number): Proof {
	return { id: 'proof-id', amount, secret: 'secret', C: 'c' } as Proof;
}

function mockDecodedToken(amount: number): Token {
	// Create proofs that sum to the desired amount
	const proofs = amount > 0 ? [mockProof(amount)] : [];
	return {
		mint: MINT_URL,
		proofs,
		unit: 'sat'
	} as Token;
}

beforeEach(() => {
	vi.clearAllMocks();
});

// =============================================================================
// No fee required — skips validation
// =============================================================================

describe('validateAntiSpamFee — no fee required', () => {
	it('returns valid when requiredFee is 0', async () => {
		const result = await validateAntiSpamFee('', 0);
		expect(result.valid).toBe(true);
		expect(result.error).toBeUndefined();
	});

	it('returns valid when requiredFee is negative', async () => {
		const result = await validateAntiSpamFee('', -5);
		expect(result.valid).toBe(true);
	});

	it('does not attempt to decode token when no fee required', async () => {
		await validateAntiSpamFee('cashuAsome_token', 0);
		expect(mockGetDecodedToken).not.toHaveBeenCalled();
	});
});

// =============================================================================
// Empty token when fee is required
// =============================================================================

describe('validateAntiSpamFee — empty token', () => {
	it('fails when token is empty string and fee is required', async () => {
		const result = await validateAntiSpamFee('', 10);
		expect(result.valid).toBe(false);
		expect(result.error).toBe('Anti-spam fee token is required');
	});

	it('fails when token is whitespace only and fee is required', async () => {
		const result = await validateAntiSpamFee('   ', 10);
		expect(result.valid).toBe(false);
		expect(result.error).toBe('Anti-spam fee token is required');
	});
});

// =============================================================================
// Invalid token format
// =============================================================================

describe('validateAntiSpamFee — invalid format', () => {
	it('fails when token does not start with cashuA or cashuB', async () => {
		const result = await validateAntiSpamFee('not-a-token', 10);
		expect(result.valid).toBe(false);
		expect(result.error).toBe('Token must start with cashuA or cashuB');
	});

	it('fails for random string that looks nothing like a token', async () => {
		const result = await validateAntiSpamFee('hello world', 10);
		expect(result.valid).toBe(false);
		expect(result.error).toBe('Token must start with cashuA or cashuB');
	});

	it('fails when token has correct prefix but cannot be decoded', async () => {
		mockGetDecodedToken.mockImplementation(() => {
			throw new Error('Invalid token format');
		});

		const result = await validateAntiSpamFee('cashuAinvalid_data', 10);
		expect(result.valid).toBe(false);
		expect(result.error).toBe('Invalid Cashu token — could not decode');
	});

	it('fails when cashuB token cannot be decoded', async () => {
		mockGetDecodedToken.mockImplementation(() => {
			throw new Error('Bad base64');
		});

		const result = await validateAntiSpamFee('cashuBcorrupted', 10);
		expect(result.valid).toBe(false);
		expect(result.error).toBe('Invalid Cashu token — could not decode');
	});
});

// =============================================================================
// Insufficient amount
// =============================================================================

describe('validateAntiSpamFee — insufficient amount', () => {
	it('fails when token amount is less than required fee', async () => {
		mockGetDecodedToken.mockReturnValue(mockDecodedToken(5));

		const result = await validateAntiSpamFee('cashuAvalid_5sats', 10);
		expect(result.valid).toBe(false);
		expect(result.error).toContain('5 sats');
		expect(result.error).toContain('10 sats');
		expect(result.tokenInfo).toBeDefined();
		expect(result.tokenInfo!.amount).toBe(5);
	});

	it('fails when token has zero amount', async () => {
		mockGetDecodedToken.mockReturnValue(mockDecodedToken(0));

		const result = await validateAntiSpamFee('cashuAzero', 10);
		expect(result.valid).toBe(false);
		expect(result.error).toContain('0 sats');
		expect(result.error).toContain('10 sats');
	});

	it('provides decoded tokenInfo even on insufficient amount', async () => {
		mockGetDecodedToken.mockReturnValue(mockDecodedToken(3));

		const result = await validateAntiSpamFee('cashuAlow', 50);
		expect(result.valid).toBe(false);
		expect(result.tokenInfo).not.toBeNull();
		expect(result.tokenInfo!.mint).toBe(MINT_URL);
		expect(result.tokenInfo!.amount).toBe(3);
	});
});

// =============================================================================
// Valid token with sufficient amount
// =============================================================================

describe('validateAntiSpamFee — valid token', () => {
	it('passes when token amount equals required fee', async () => {
		mockGetDecodedToken.mockReturnValue(mockDecodedToken(10));

		const result = await validateAntiSpamFee('cashuAexact', 10);
		expect(result.valid).toBe(true);
		expect(result.error).toBeUndefined();
		expect(result.tokenInfo).toBeDefined();
		expect(result.tokenInfo!.amount).toBe(10);
	});

	it('passes when token amount exceeds required fee', async () => {
		mockGetDecodedToken.mockReturnValue(mockDecodedToken(100));

		const result = await validateAntiSpamFee('cashuAgenerous', 10);
		expect(result.valid).toBe(true);
		expect(result.error).toBeUndefined();
		expect(result.tokenInfo!.amount).toBe(100);
	});

	it('passes with cashuB prefix token', async () => {
		mockGetDecodedToken.mockReturnValue(mockDecodedToken(50));

		const result = await validateAntiSpamFee('cashuBv4token', 10);
		expect(result.valid).toBe(true);
		expect(result.tokenInfo!.amount).toBe(50);
	});

	it('trims whitespace from token input', async () => {
		mockGetDecodedToken.mockReturnValue(mockDecodedToken(20));

		const result = await validateAntiSpamFee('  cashuApadded  ', 10);
		expect(result.valid).toBe(true);
		expect(result.tokenInfo!.amount).toBe(20);
	});

	it('returns mint URL in tokenInfo', async () => {
		mockGetDecodedToken.mockReturnValue(mockDecodedToken(10));

		const result = await validateAntiSpamFee('cashuAtoken', 10);
		expect(result.tokenInfo!.mint).toBe(MINT_URL);
	});
});
