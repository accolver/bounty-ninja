import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the decodeToken function from $lib/cashu/token
vi.mock('$lib/cashu/token', () => ({
	decodeToken: vi.fn()
}));

// Mock the mint module so #verifyWithMint doesn't contact a real mint
vi.mock('$lib/cashu/mint', () => ({
	getWallet: vi.fn()
}));

import { decodeToken } from '$lib/cashu/token';
import { getWallet } from '$lib/cashu/mint';
import type { TokenInfo } from '$lib/cashu/types';

const mockedDecodeToken = vi.mocked(decodeToken);
const mockedGetWallet = vi.mocked(getWallet);

// We need to dynamically import the module after mocking
async function getTokenValidator() {
	// Reset modules to get a fresh singleton each time
	const mod = await import('$lib/cashu/token-validator.svelte');
	return mod;
}

const MINT_URL = 'https://mint.example.com';
const MINT_URL_TRAILING = 'https://mint.example.com/';

function makeTokenInfo(overrides: Partial<TokenInfo> = {}): TokenInfo {
	return {
		mint: MINT_URL,
		amount: 100,
		proofs: [
			{ id: 'proof-1', amount: 100, secret: 'test-secret', C: 'test-c' }
		] as TokenInfo['proofs'],
		memo: undefined,
		unit: 'sat',
		...overrides
	};
}

function makeP2PKProof(locktime: number) {
	const secret = JSON.stringify([
		'P2PK',
		{
			nonce: 'abc123',
			data: 'a'.repeat(64),
			tags: [['locktime', locktime.toString()]]
		}
	]);
	return { id: 'p2pk-proof', amount: 50, secret, C: 'test-c' };
}

/** Create a mock wallet that returns all proofs as UNSPENT */
function makeMockWallet(allSpendable = true) {
	return {
		checkProofsStates: vi.fn().mockResolvedValue(
			allSpendable
				? [{ state: 'UNSPENT' }]
				: [{ state: 'SPENT' }]
		)
	};
}

// ── TokenValidator Tests ────────────────────────────────────────────────────

describe('TokenValidator', () => {
	let tokenValidator: Awaited<ReturnType<typeof getTokenValidator>>['tokenValidator'];

	beforeEach(async () => {
		vi.clearAllMocks();

		// Default: getWallet returns a mock wallet with all proofs spendable
		mockedGetWallet.mockResolvedValue(makeMockWallet(true) as any);

		const mod = await getTokenValidator();
		tokenValidator = mod.tokenValidator;
		tokenValidator.reset();
	});

	afterEach(() => {
		tokenValidator.reset();
	});

	// ── getStatus ──────────────────────────────────────────────────────────

	describe('getStatus', () => {
		it('returns pending for unknown tokens', () => {
			const status = tokenValidator.getStatus('cashuAunknown');
			expect(status).toBe('pending');
		});
	});

	// ── verify — valid tokens ──────────────────────────────────────────────

	describe('verify — valid tokens', () => {
		it('sets status to verified for valid cashuA token', async () => {
			const token = 'cashuAvalidtoken123';
			mockedDecodeToken.mockReturnValue(makeTokenInfo());

			tokenValidator.verify(token, MINT_URL);

			// Wait for async verification to complete
			await vi.waitFor(() => {
				expect(tokenValidator.getStatus(token)).toBe('verified');
			});
		});

		it('sets status to verified for valid cashuB token', async () => {
			const token = 'cashuBvalidtoken456';
			mockedDecodeToken.mockReturnValue(makeTokenInfo());

			tokenValidator.verify(token, MINT_URL);

			await vi.waitFor(() => {
				expect(tokenValidator.getStatus(token)).toBe('verified');
			});
		});

		it('normalizes trailing slashes in mint URL comparison', async () => {
			const token = 'cashuAvalidtoken789';
			mockedDecodeToken.mockReturnValue(makeTokenInfo({ mint: MINT_URL_TRAILING }));

			tokenValidator.verify(token, MINT_URL);

			await vi.waitFor(() => {
				expect(tokenValidator.getStatus(token)).toBe('verified');
			});
		});
	});

	// ── verify — invalid tokens ────────────────────────────────────────────

	describe('verify — invalid tokens', () => {
		it('sets status to invalid when decodeToken returns null', async () => {
			const token = 'cashuAgarbage';
			mockedDecodeToken.mockReturnValue(null);

			tokenValidator.verify(token, MINT_URL);

			await vi.waitFor(() => {
				expect(tokenValidator.getStatus(token)).toBe('invalid');
			});
		});

		it('sets status to invalid for zero-amount token', async () => {
			const token = 'cashuAzeroproofs';
			mockedDecodeToken.mockReturnValue(makeTokenInfo({ amount: 0, proofs: [] }));

			tokenValidator.verify(token, MINT_URL);

			await vi.waitFor(() => {
				expect(tokenValidator.getStatus(token)).toBe('invalid');
			});
		});

		it('sets status to invalid for token with empty proofs', async () => {
			const token = 'cashuAnoproofs';
			mockedDecodeToken.mockReturnValue(makeTokenInfo({ proofs: [], amount: 0 }));

			tokenValidator.verify(token, MINT_URL);

			await vi.waitFor(() => {
				expect(tokenValidator.getStatus(token)).toBe('invalid');
			});
		});
	});

	// ── verify — unverified tokens ─────────────────────────────────────────

	describe('verify — unverified tokens', () => {
		it('sets status to unverified for non-cashu prefix', async () => {
			const token = 'notacashutoken';
			mockedDecodeToken.mockReturnValue(makeTokenInfo());

			tokenValidator.verify(token, MINT_URL);

			await vi.waitFor(() => {
				expect(tokenValidator.getStatus(token)).toBe('unverified');
			});
		});

		it('sets status to unverified when mint URLs do not match', async () => {
			const token = 'cashuAmismatchedmint';
			mockedDecodeToken.mockReturnValue(makeTokenInfo({ mint: 'https://other-mint.example.com' }));

			tokenValidator.verify(token, MINT_URL);

			await vi.waitFor(() => {
				expect(tokenValidator.getStatus(token)).toBe('unverified');
			});
		});

		it('sets status to unverified when mint returns SPENT proofs', async () => {
			const token = 'cashuAspenttoken';
			mockedDecodeToken.mockReturnValue(makeTokenInfo());
			mockedGetWallet.mockResolvedValue(makeMockWallet(false) as any);

			tokenValidator.verify(token, MINT_URL);

			await vi.waitFor(() => {
				expect(tokenValidator.getStatus(token)).toBe('unverified');
			});
		});

		it('sets status to unverified when mint is unreachable after retries', async () => {
			const token = 'cashuAunreachable';
			mockedDecodeToken.mockReturnValue(makeTokenInfo());
			mockedGetWallet.mockRejectedValue(new Error('Connection refused'));

			tokenValidator.verify(token, MINT_URL);

			await vi.waitFor(
				() => {
					expect(tokenValidator.getStatus(token)).toBe('unverified');
				},
				{ timeout: 15000 }
			);
		}, 20000);
	});

	// ── verify — expired tokens ────────────────────────────────────────────

	describe('verify — expired tokens', () => {
		it('sets status to expired when P2PK locktime is in the past', async () => {
			const pastLocktime = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
			const token = 'cashuAexpiredtoken';
			mockedDecodeToken.mockReturnValue(
				makeTokenInfo({
					proofs: [makeP2PKProof(pastLocktime)] as TokenInfo['proofs']
				})
			);

			tokenValidator.verify(token, MINT_URL);

			await vi.waitFor(() => {
				expect(tokenValidator.getStatus(token)).toBe('expired');
			});
		});

		it('does not mark as expired when locktime is in the future', async () => {
			const futureLocktime = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
			const token = 'cashuAfuturelock';
			mockedDecodeToken.mockReturnValue(
				makeTokenInfo({
					proofs: [makeP2PKProof(futureLocktime)] as TokenInfo['proofs']
				})
			);

			tokenValidator.verify(token, MINT_URL);

			await vi.waitFor(() => {
				expect(tokenValidator.getStatus(token)).toBe('verified');
			});
		});
	});

	// ── verify — caching ───────────────────────────────────────────────────

	describe('verify — caching', () => {
		it('does not re-verify a cached token within TTL', async () => {
			const token = 'cashuAcachedtoken';
			mockedDecodeToken.mockReturnValue(makeTokenInfo());

			tokenValidator.verify(token, MINT_URL);

			await vi.waitFor(() => {
				expect(tokenValidator.getStatus(token)).toBe('verified');
			});

			// Clear mock call count
			mockedDecodeToken.mockClear();

			// Verify again — should be a no-op
			tokenValidator.verify(token, MINT_URL);

			// decodeToken should NOT be called again
			expect(mockedDecodeToken).not.toHaveBeenCalled();
		});

		it('does not run duplicate concurrent verifications', async () => {
			const token = 'cashuAduplicatecheck';
			mockedDecodeToken.mockReturnValue(makeTokenInfo());

			// Call verify twice rapidly
			tokenValidator.verify(token, MINT_URL);
			tokenValidator.verify(token, MINT_URL);

			await vi.waitFor(() => {
				expect(tokenValidator.getStatus(token)).toBe('verified');
			});

			// decodeToken should only be called a limited number of times
			// (structural check + verifyWithMint both call it, but only one verifyAsync should run)
			expect(mockedDecodeToken.mock.calls.length).toBeLessThanOrEqual(3);
		});
	});

	// ── reset ──────────────────────────────────────────────────────────────

	describe('reset', () => {
		it('clears all cached results', async () => {
			const token = 'cashuAresettest';
			mockedDecodeToken.mockReturnValue(makeTokenInfo());

			tokenValidator.verify(token, MINT_URL);

			await vi.waitFor(() => {
				expect(tokenValidator.getStatus(token)).toBe('verified');
			});

			tokenValidator.reset();

			expect(tokenValidator.getStatus(token)).toBe('pending');
			expect(tokenValidator.size).toBe(0);
		});
	});

	// ── P2PK secret parsing edge cases ─────────────────────────────────────

	describe('P2PK secret parsing', () => {
		it('handles non-JSON secrets gracefully', async () => {
			const token = 'cashuAplainproof';
			mockedDecodeToken.mockReturnValue(
				makeTokenInfo({
					proofs: [{ id: 'plain', amount: 50, secret: 'not-json', C: 'c' }] as TokenInfo['proofs']
				})
			);

			tokenValidator.verify(token, MINT_URL);

			await vi.waitFor(() => {
				expect(tokenValidator.getStatus(token)).toBe('verified');
			});
		});

		it('handles P2PK secret without locktime tag', async () => {
			const secret = JSON.stringify([
				'P2PK',
				{
					nonce: 'abc',
					data: 'a'.repeat(64),
					tags: [['sigflag', 'SIG_ALL']]
				}
			]);
			const token = 'cashuAnolocktime';
			mockedDecodeToken.mockReturnValue(
				makeTokenInfo({
					proofs: [{ id: 'p2pk-no-lt', amount: 50, secret, C: 'c' }] as TokenInfo['proofs']
				})
			);

			tokenValidator.verify(token, MINT_URL);

			await vi.waitFor(() => {
				expect(tokenValidator.getStatus(token)).toBe('verified');
			});
		});

		it('handles P2PK secret with empty tags array', async () => {
			const secret = JSON.stringify([
				'P2PK',
				{
					nonce: 'abc',
					data: 'a'.repeat(64),
					tags: []
				}
			]);
			const token = 'cashuAemptytags';
			mockedDecodeToken.mockReturnValue(
				makeTokenInfo({
					proofs: [{ id: 'p2pk-empty', amount: 50, secret, C: 'c' }] as TokenInfo['proofs']
				})
			);

			tokenValidator.verify(token, MINT_URL);

			await vi.waitFor(() => {
				expect(tokenValidator.getStatus(token)).toBe('verified');
			});
		});
	});

	// ── Types export ───────────────────────────────────────────────────────

	describe('type exports', () => {
		it('exports TokenVerificationStatus type', async () => {
			const mod = await getTokenValidator();
			// Type check — if this compiles, the type is exported
			const status: (typeof mod)['tokenValidator'] extends { getStatus: (t: string) => infer S }
				? S
				: never = 'verified';
			expect(status).toBe('verified');
		});
	});
});
