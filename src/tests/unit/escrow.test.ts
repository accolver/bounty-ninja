/**
 * Unit tests for $lib/cashu/escrow.ts — the full escrow lifecycle.
 *
 * Tests: createPledgeToken, collectPledgeTokens, swapPledgeTokens,
 * createPayoutToken, encodePayoutToken, checkPledgeProofsSpendable.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Proof, Wallet, Token } from '@cashu/cashu-ts';
import type { NostrEvent } from 'nostr-tools';
import type { DecodedPledge } from '$lib/cashu/types';
import { DoubleSpendError } from '$lib/cashu/types';

// ── Mocks ─────────────────────────────────────────────────────────────────

vi.mock('$lib/cashu/mint', () => ({
	getWallet: vi.fn()
}));

vi.mock('$lib/cashu/token', () => ({
	decodeToken: vi.fn(),
	encodeToken: vi.fn(),
	getProofsAmount: vi.fn()
}));

vi.mock('$lib/cashu/p2pk', () => ({
	createP2PKLock: vi.fn()
}));

import {
	createPledgeToken,
	collectPledgeTokens,
	swapPledgeTokens,
	createPayoutToken,
	encodePayoutToken,
	checkPledgeProofsSpendable
} from '$lib/cashu/escrow';
import { getWallet } from '$lib/cashu/mint';
import { decodeToken, encodeToken, getProofsAmount } from '$lib/cashu/token';
import { createP2PKLock } from '$lib/cashu/p2pk';

const mockedGetWallet = vi.mocked(getWallet);
const mockedDecodeToken = vi.mocked(decodeToken);
const mockedEncodeToken = vi.mocked(encodeToken);
const mockedGetProofsAmount = vi.mocked(getProofsAmount);
const mockedCreateP2PKLock = vi.mocked(createP2PKLock);

// ── Helpers ───────────────────────────────────────────────────────────────

const CREATOR_PK = 'a'.repeat(64);
const PLEDGER_PK = 'b'.repeat(64);
const SOLVER_PK = 'c'.repeat(64);
const MINT_URL = 'https://mint.example.com';
const SIG = 'd'.repeat(128);

function mockProof(amount: number, id = 'proof'): Proof {
	return { id, amount, secret: 'test-secret', C: 'test-c' } as Proof;
}

function mockWallet(overrides: Record<string, unknown> = {}): Wallet {
	return {
		getFeesForProofs: vi.fn(() => 0),
		send: vi.fn(async (amount: number) => ({
			keep: [],
			send: [mockProof(amount)]
		})),
		signP2PKProofs: vi.fn((proofs: Proof[]) => proofs),
		checkProofsStates: vi.fn(async (proofs: Proof[]) =>
			proofs.map(() => ({ state: 'UNSPENT' }))
		),
		...overrides
	} as unknown as Wallet;
}

function makePledgeEvent(tokenStr: string, eventId?: string): NostrEvent {
	return {
		id: eventId ?? crypto.randomUUID().replace(/-/g, '').slice(0, 64),
		pubkey: PLEDGER_PK,
		created_at: Math.floor(Date.now() / 1000),
		kind: 73002,
		tags: [
			['a', `37300:${CREATOR_PK}:test-bounty`],
			['cashu', tokenStr],
			['amount', '100'],
			['mint', MINT_URL]
		],
		content: '',
		sig: SIG
	};
}

function makeDecodedPledge(amount = 100, eventId = 'evt-1'): DecodedPledge {
	return {
		token: { mint: MINT_URL, proofs: [mockProof(amount)], unit: 'sat' } as Token,
		mint: MINT_URL,
		amount,
		proofs: [mockProof(amount)],
		eventId,
		pledgerPubkey: PLEDGER_PK
	};
}

// ── Setup ─────────────────────────────────────────────────────────────────

beforeEach(() => {
	vi.clearAllMocks();
	mockedCreateP2PKLock.mockReturnValue({ pubkey: CREATOR_PK });
	mockedGetProofsAmount.mockImplementation((proofs: Proof[]) =>
		proofs.reduce((s, p) => s + p.amount, 0)
	);
});

// ═══════════════════════════════════════════════════════════════════════════
// createPledgeToken
// ═══════════════════════════════════════════════════════════════════════════

describe('createPledgeToken', () => {
	it('returns failure for empty proofs', async () => {
		const result = await createPledgeToken([], CREATOR_PK);
		expect(result.success).toBe(false);
		expect(result.error).toContain('No proofs');
	});

	it('returns failure for zero-amount proofs', async () => {
		mockedGetProofsAmount.mockReturnValue(0);
		const result = await createPledgeToken([mockProof(0)], CREATOR_PK);
		expect(result.success).toBe(false);
		expect(result.error).toContain('zero total amount');
	});

	it('creates P2PK-locked proofs on success', async () => {
		const wallet = mockWallet();
		mockedGetWallet.mockResolvedValue(wallet);

		const result = await createPledgeToken([mockProof(100)], CREATOR_PK, MINT_URL);

		expect(result.success).toBe(true);
		expect(result.proofs.length).toBeGreaterThan(0);
		expect(mockedCreateP2PKLock).toHaveBeenCalledWith(CREATOR_PK, undefined, undefined);
		expect(wallet.send).toHaveBeenCalledOnce();
	});

	it('passes locktime and refundPubkey when provided', async () => {
		const wallet = mockWallet();
		mockedGetWallet.mockResolvedValue(wallet);
		const locktime = 1800000000;

		await createPledgeToken([mockProof(100)], CREATOR_PK, MINT_URL, locktime, PLEDGER_PK);

		expect(mockedCreateP2PKLock).toHaveBeenCalledWith(CREATOR_PK, locktime, [PLEDGER_PK]);
	});

	it('passes locktime without refundPubkey', async () => {
		const wallet = mockWallet();
		mockedGetWallet.mockResolvedValue(wallet);
		const locktime = 1800000000;

		await createPledgeToken([mockProof(100)], CREATOR_PK, MINT_URL, locktime);

		expect(mockedCreateP2PKLock).toHaveBeenCalledWith(CREATOR_PK, locktime, undefined);
	});

	it('returns failure when fees exceed amount', async () => {
		const wallet = mockWallet({ getFeesForProofs: vi.fn(() => 200) });
		mockedGetWallet.mockResolvedValue(wallet);

		const result = await createPledgeToken([mockProof(50)], CREATOR_PK, MINT_URL);

		expect(result.success).toBe(false);
		expect(result.error).toContain('Insufficient amount after fees');
	});

	it('handles wallet.send error gracefully', async () => {
		const wallet = mockWallet({
			send: vi.fn(async () => {
				throw new Error('Network error');
			})
		});
		mockedGetWallet.mockResolvedValue(wallet);

		const result = await createPledgeToken([mockProof(100)], CREATOR_PK, MINT_URL);

		expect(result.success).toBe(false);
		expect(result.error).toContain('Network error');
	});

	it('handles mint connection error', async () => {
		mockedGetWallet.mockRejectedValue(new Error('Mint offline'));

		const result = await createPledgeToken([mockProof(100)], CREATOR_PK, MINT_URL);

		expect(result.success).toBe(false);
		expect(result.error).toContain('Mint offline');
	});

	it('uses default mint when mintUrl omitted', async () => {
		const wallet = mockWallet();
		mockedGetWallet.mockResolvedValue(wallet);

		await createPledgeToken([mockProof(100)], CREATOR_PK);

		expect(mockedGetWallet).toHaveBeenCalledWith(undefined);
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// collectPledgeTokens
// ═══════════════════════════════════════════════════════════════════════════

describe('collectPledgeTokens', () => {
	it('returns empty array for empty events', () => {
		const result = collectPledgeTokens([]);
		expect(result).toEqual([]);
	});

	it('decodes valid pledge events', () => {
		const tokenInfo = {
			mint: MINT_URL,
			amount: 100,
			proofs: [mockProof(100)],
			memo: undefined,
			unit: 'sat'
		};
		mockedDecodeToken.mockReturnValue(tokenInfo);

		const events = [makePledgeEvent('cashuBvalid123')];
		const result = collectPledgeTokens(events);

		expect(result).toHaveLength(1);
		expect(result[0].amount).toBe(100);
		expect(result[0].mint).toBe(MINT_URL);
		expect(result[0].pledgerPubkey).toBe(PLEDGER_PK);
	});

	it('skips events without cashu tag', () => {
		const event: NostrEvent = {
			id: 'no-cashu',
			pubkey: PLEDGER_PK,
			created_at: Math.floor(Date.now() / 1000),
			kind: 73002,
			tags: [['a', 'bounty-addr']],
			content: '',
			sig: SIG
		};

		const result = collectPledgeTokens([event]);
		expect(result).toHaveLength(0);
	});

	it('skips events with invalid tokens', () => {
		mockedDecodeToken.mockReturnValue(null);

		const events = [makePledgeEvent('invalid-token')];
		const result = collectPledgeTokens(events);

		expect(result).toHaveLength(0);
	});

	it('processes multiple events, skipping bad ones', () => {
		const goodInfo = {
			mint: MINT_URL,
			amount: 200,
			proofs: [mockProof(200)],
			memo: undefined,
			unit: 'sat'
		};

		mockedDecodeToken.mockReturnValueOnce(goodInfo).mockReturnValueOnce(null).mockReturnValueOnce(goodInfo);

		const events = [
			makePledgeEvent('cashuBgood1', 'evt-1'),
			makePledgeEvent('cashuBbad', 'evt-2'),
			makePledgeEvent('cashuBgood2', 'evt-3')
		];

		const result = collectPledgeTokens(events);
		expect(result).toHaveLength(2);
		expect(result[0].eventId).toBe('evt-1');
		expect(result[1].eventId).toBe('evt-3');
	});

	it('preserves event ID and pledger pubkey in decoded pledges', () => {
		const tokenInfo = {
			mint: MINT_URL,
			amount: 50,
			proofs: [mockProof(50)],
			memo: 'test memo',
			unit: 'sat'
		};
		mockedDecodeToken.mockReturnValue(tokenInfo);

		const eventId = 'specific-event-id-' + '0'.repeat(48);
		const events = [makePledgeEvent('cashuBtest', eventId)];
		const result = collectPledgeTokens(events);

		expect(result[0].eventId).toBe(eventId);
		expect(result[0].pledgerPubkey).toBe(PLEDGER_PK);
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// swapPledgeTokens
// ═══════════════════════════════════════════════════════════════════════════

describe('swapPledgeTokens', () => {
	it('returns failure for empty pledges', async () => {
		const wallet = mockWallet();
		const result = await swapPledgeTokens([], wallet, CREATOR_PK);

		expect(result.success).toBe(false);
		expect(result.error).toContain('No pledges');
	});

	it('returns failure for zero-amount pledges', async () => {
		mockedGetProofsAmount.mockReturnValue(0);
		const pledge = makeDecodedPledge(0);
		const wallet = mockWallet();

		const result = await swapPledgeTokens([pledge], wallet, CREATOR_PK);

		expect(result.success).toBe(false);
		expect(result.error).toContain('zero total amount');
	});

	it('swaps pledges successfully with privkey signing', async () => {
		const pledge = makeDecodedPledge(100);
		const wallet = mockWallet();

		const result = await swapPledgeTokens([pledge], wallet, CREATOR_PK);

		expect(result.success).toBe(true);
		expect(result.sendProofs.length).toBeGreaterThan(0);
		expect(wallet.signP2PKProofs).toHaveBeenCalledWith(pledge.proofs, CREATOR_PK);
		expect(wallet.send).toHaveBeenCalledOnce();
	});

	it('combines proofs from multiple pledges', async () => {
		const pledge1 = makeDecodedPledge(100, 'evt-1');
		const pledge2 = makeDecodedPledge(50, 'evt-2');
		// Total = 150
		mockedGetProofsAmount.mockReturnValue(150);
		const wallet = mockWallet();

		const result = await swapPledgeTokens([pledge1, pledge2], wallet, CREATOR_PK);

		expect(result.success).toBe(true);
		// signP2PKProofs should be called with all combined proofs
		const signCall = (wallet.signP2PKProofs as ReturnType<typeof vi.fn>).mock.calls[0];
		expect(signCall[0]).toHaveLength(2); // 2 proofs total
	});

	it('returns failure when fees exceed total', async () => {
		const pledge = makeDecodedPledge(5);
		const wallet = mockWallet({ getFeesForProofs: vi.fn(() => 10) });

		const result = await swapPledgeTokens([pledge], wallet, CREATOR_PK);

		expect(result.success).toBe(false);
		expect(result.error).toContain('Insufficient amount after fees');
	});

	it('throws DoubleSpendError when mint reports already spent', async () => {
		const pledge = makeDecodedPledge(100);
		const wallet = mockWallet({
			send: vi.fn(async () => {
				throw new Error('Token already spent');
			})
		});

		await expect(swapPledgeTokens([pledge], wallet, CREATOR_PK)).rejects.toThrow(DoubleSpendError);
	});

	it('returns failure for generic errors', async () => {
		const pledge = makeDecodedPledge(100);
		const wallet = mockWallet({
			send: vi.fn(async () => {
				throw new Error('Unknown mint error');
			})
		});

		const result = await swapPledgeTokens([pledge], wallet, CREATOR_PK);

		expect(result.success).toBe(false);
		expect(result.error).toContain('Unknown mint error');
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// createPayoutToken
// ═══════════════════════════════════════════════════════════════════════════

describe('createPayoutToken', () => {
	it('returns failure for empty proofs', async () => {
		const wallet = mockWallet();
		const result = await createPayoutToken([], SOLVER_PK, wallet);

		expect(result.success).toBe(false);
		expect(result.error).toContain('No proofs for payout');
	});

	it('returns failure for zero-amount proofs', async () => {
		mockedGetProofsAmount.mockReturnValue(0);
		const wallet = mockWallet();

		const result = await createPayoutToken([mockProof(0)], SOLVER_PK, wallet);

		expect(result.success).toBe(false);
		expect(result.error).toContain('zero total amount');
	});

	it('creates P2PK-locked payout for solver', async () => {
		const wallet = mockWallet();

		const result = await createPayoutToken([mockProof(100)], SOLVER_PK, wallet);

		expect(result.success).toBe(true);
		expect(result.proofs.length).toBeGreaterThan(0);
		expect(mockedCreateP2PKLock).toHaveBeenCalledWith(SOLVER_PK);
		expect(wallet.send).toHaveBeenCalledOnce();
	});

	it('returns failure when fees exceed payout amount', async () => {
		const wallet = mockWallet({ getFeesForProofs: vi.fn(() => 200) });

		const result = await createPayoutToken([mockProof(50)], SOLVER_PK, wallet);

		expect(result.success).toBe(false);
		expect(result.error).toContain('Insufficient amount after fees');
	});

	it('throws DoubleSpendError on already-spent proofs', async () => {
		const wallet = mockWallet({
			send: vi.fn(async () => {
				throw new Error('Token already spent');
			})
		});

		await expect(createPayoutToken([mockProof(100)], SOLVER_PK, wallet)).rejects.toThrow(
			DoubleSpendError
		);
	});

	it('returns failure for generic send errors', async () => {
		const wallet = mockWallet({
			send: vi.fn(async () => {
				throw new Error('Mint timeout');
			})
		});

		const result = await createPayoutToken([mockProof(100)], SOLVER_PK, wallet);

		expect(result.success).toBe(false);
		expect(result.error).toContain('Mint timeout');
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// encodePayoutToken
// ═══════════════════════════════════════════════════════════════════════════

describe('encodePayoutToken', () => {
	it('calls encodeToken with correct memo', () => {
		mockedEncodeToken.mockReturnValue('cashuBpayout123');
		const proofs = [mockProof(500)];

		const result = encodePayoutToken(proofs, MINT_URL);

		expect(result).toBe('cashuBpayout123');
		expect(mockedEncodeToken).toHaveBeenCalledWith(proofs, MINT_URL, 'Bounty.ninja bounty payout');
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// checkPledgeProofsSpendable
// ═══════════════════════════════════════════════════════════════════════════

describe('checkPledgeProofsSpendable', () => {
	it('returns empty map for empty pledges', async () => {
		const wallet = mockWallet();
		const result = await checkPledgeProofsSpendable([], wallet);
		expect(result.size).toBe(0);
	});

	it('returns true for spendable pledges', async () => {
		const pledge = makeDecodedPledge(100, 'evt-spendable');
		const wallet = mockWallet();

		const result = await checkPledgeProofsSpendable([pledge], wallet);

		expect(result.get('evt-spendable')).toBe(true);
	});

	it('returns false for spent pledges', async () => {
		const pledge = makeDecodedPledge(100, 'evt-spent');
		const wallet = mockWallet({
			checkProofsStates: vi.fn(async () => [{ state: 'SPENT' }])
		});

		const result = await checkPledgeProofsSpendable([pledge], wallet);

		expect(result.get('evt-spent')).toBe(false);
	});

	it('returns false on network error (safe default)', async () => {
		const pledge = makeDecodedPledge(100, 'evt-err');
		const wallet = mockWallet({
			checkProofsStates: vi.fn(async () => {
				throw new Error('Network error');
			})
		});

		const result = await checkPledgeProofsSpendable([pledge], wallet);

		expect(result.get('evt-err')).toBe(false);
	});

	it('checks each pledge independently', async () => {
		const pledge1 = makeDecodedPledge(100, 'evt-1');
		const pledge2 = makeDecodedPledge(50, 'evt-2');
		const wallet = mockWallet({
			checkProofsStates: vi
				.fn()
				.mockResolvedValueOnce([{ state: 'UNSPENT' }])
				.mockResolvedValueOnce([{ state: 'SPENT' }])
		});

		const result = await checkPledgeProofsSpendable([pledge1, pledge2], wallet);

		expect(result.get('evt-1')).toBe(true);
		expect(result.get('evt-2')).toBe(false);
	});

	it('handles mixed proof states within a single pledge', async () => {
		const pledge: DecodedPledge = {
			...makeDecodedPledge(150, 'evt-mixed'),
			proofs: [mockProof(100), mockProof(50)]
		};
		const wallet = mockWallet({
			checkProofsStates: vi.fn(async () => [{ state: 'UNSPENT' }, { state: 'SPENT' }])
		});

		const result = await checkPledgeProofsSpendable([pledge], wallet);

		// If any proof is spent, the whole pledge is not fully spendable
		expect(result.get('evt-mixed')).toBe(false);
	});
});
