/**
 * Unit tests for $lib/cashu/escrow.ts — pledger-controlled escrow lifecycle.
 *
 * Tests: createPledgeToken (self-custody), collectPledgeTokens,
 * releasePledgeToSolver, reclaimPledge, encodePayoutToken.
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
	releasePledgeToSolver,
	reclaimPledge,
	encodePayoutToken
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

const PLEDGER_PK = 'b'.repeat(64);
const PLEDGER_PRIVKEY = 'e'.repeat(64);
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
		checkProofsStates: vi.fn(async (proofs: Proof[]) => proofs.map(() => ({ state: 'UNSPENT' }))),
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
			['a', `37300:${'a'.repeat(64)}:test-bounty`],
			['cashu', tokenStr],
			['amount', '100'],
			['mint', MINT_URL]
		],
		content: '',
		sig: SIG
	};
}

function makeDecodedPledge(amount = 100, eventId = 'evt-1', mintUrl = MINT_URL): DecodedPledge {
	return {
		token: { mint: mintUrl, proofs: [mockProof(amount)], unit: 'sat' } as Token,
		mint: mintUrl,
		amount,
		proofs: [mockProof(amount)],
		eventId,
		pledgerPubkey: PLEDGER_PK
	};
}

// ── Setup ─────────────────────────────────────────────────────────────────

beforeEach(() => {
	vi.clearAllMocks();
	mockedCreateP2PKLock.mockReturnValue({ pubkey: PLEDGER_PK });
	mockedGetProofsAmount.mockImplementation((proofs: Proof[]) =>
		proofs.reduce((s, p) => s + p.amount, 0)
	);
});

// ═══════════════════════════════════════════════════════════════════════════
// createPledgeToken — pledger locks to own pubkey (self-custody)
// ═══════════════════════════════════════════════════════════════════════════

describe('createPledgeToken', () => {
	it('returns failure for empty proofs', async () => {
		const result = await createPledgeToken([], PLEDGER_PK);
		expect(result.success).toBe(false);
		expect(result.error).toContain('No proofs');
	});

	it('returns failure for zero-amount proofs', async () => {
		mockedGetProofsAmount.mockReturnValue(0);
		const result = await createPledgeToken([mockProof(0)], PLEDGER_PK);
		expect(result.success).toBe(false);
		expect(result.error).toContain('zero total amount');
	});

	it('creates P2PK-locked proofs to pledger own pubkey', async () => {
		const wallet = mockWallet();
		mockedGetWallet.mockResolvedValue(wallet);

		const result = await createPledgeToken([mockProof(100)], PLEDGER_PK, MINT_URL);

		expect(result.success).toBe(true);
		expect(result.proofs.length).toBeGreaterThan(0);
		// Lock target is the pledger's own pubkey (self-custody)
		expect(mockedCreateP2PKLock).toHaveBeenCalledWith(PLEDGER_PK, undefined);
		expect(wallet.send).toHaveBeenCalledOnce();
	});

	it('passes locktime as social signal when provided', async () => {
		const wallet = mockWallet();
		mockedGetWallet.mockResolvedValue(wallet);
		const locktime = 1800000000;

		await createPledgeToken([mockProof(100)], PLEDGER_PK, MINT_URL, locktime);

		// No refund pubkey — pledger holds the primary key
		expect(mockedCreateP2PKLock).toHaveBeenCalledWith(PLEDGER_PK, locktime);
	});

	it('returns failure when fees exceed amount', async () => {
		const wallet = mockWallet({ getFeesForProofs: vi.fn(() => 200) });
		mockedGetWallet.mockResolvedValue(wallet);

		const result = await createPledgeToken([mockProof(50)], PLEDGER_PK, MINT_URL);

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

		const result = await createPledgeToken([mockProof(100)], PLEDGER_PK, MINT_URL);

		expect(result.success).toBe(false);
		expect(result.error).toContain('Network error');
	});

	it('handles mint connection error', async () => {
		mockedGetWallet.mockRejectedValue(new Error('Mint offline'));

		const result = await createPledgeToken([mockProof(100)], PLEDGER_PK, MINT_URL);

		expect(result.success).toBe(false);
		expect(result.error).toContain('Mint offline');
	});

	it('uses default mint when mintUrl omitted', async () => {
		const wallet = mockWallet();
		mockedGetWallet.mockResolvedValue(wallet);

		await createPledgeToken([mockProof(100)], PLEDGER_PK);

		expect(mockedGetWallet).toHaveBeenCalledWith(undefined);
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// collectPledgeTokens
// ═══════════════════════════════════════════════════════════════════════════

describe('collectPledgeTokens', () => {
	it('returns empty array for empty events', async () => {
		const result = await collectPledgeTokens([]);
		expect(result).toEqual([]);
	});

	it('decodes valid pledge events', async () => {
		const tokenInfo = {
			mint: MINT_URL,
			amount: 100,
			proofs: [mockProof(100)],
			memo: undefined,
			unit: 'sat'
		};
		mockedDecodeToken.mockResolvedValue(tokenInfo);

		const events = [makePledgeEvent('cashuBvalid123')];
		const result = await collectPledgeTokens(events);

		expect(result).toHaveLength(1);
		expect(result[0].amount).toBe(100);
		expect(result[0].mint).toBe(MINT_URL);
		expect(result[0].pledgerPubkey).toBe(PLEDGER_PK);
	});

	it('skips events without cashu tag', async () => {
		const event: NostrEvent = {
			id: 'no-cashu',
			pubkey: PLEDGER_PK,
			created_at: Math.floor(Date.now() / 1000),
			kind: 73002,
			tags: [['a', 'bounty-addr']],
			content: '',
			sig: SIG
		};

		const result = await collectPledgeTokens([event]);
		expect(result).toHaveLength(0);
	});

	it('skips events with invalid tokens', async () => {
		mockedDecodeToken.mockResolvedValue(null);

		const events = [makePledgeEvent('invalid-token')];
		const result = await collectPledgeTokens(events);

		expect(result).toHaveLength(0);
	});

	it('processes multiple events, skipping bad ones', async () => {
		const goodInfo = {
			mint: MINT_URL,
			amount: 200,
			proofs: [mockProof(200)],
			memo: undefined,
			unit: 'sat'
		};

		mockedDecodeToken
			.mockResolvedValueOnce(goodInfo)
			.mockResolvedValueOnce(null)
			.mockResolvedValueOnce(goodInfo);

		const events = [
			makePledgeEvent('cashuBgood1', 'evt-1'),
			makePledgeEvent('cashuBbad', 'evt-2'),
			makePledgeEvent('cashuBgood2', 'evt-3')
		];

		const result = await collectPledgeTokens(events);
		expect(result).toHaveLength(2);
		expect(result[0].eventId).toBe('evt-1');
		expect(result[1].eventId).toBe('evt-3');
	});

	it('preserves event ID and pledger pubkey in decoded pledges', async () => {
		const tokenInfo = {
			mint: MINT_URL,
			amount: 50,
			proofs: [mockProof(50)],
			memo: 'test memo',
			unit: 'sat'
		};
		mockedDecodeToken.mockResolvedValue(tokenInfo);

		const eventId = 'specific-event-id-' + '0'.repeat(48);
		const events = [makePledgeEvent('cashuBtest', eventId)];
		const result = await collectPledgeTokens(events);

		expect(result[0].eventId).toBe(eventId);
		expect(result[0].pledgerPubkey).toBe(PLEDGER_PK);
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// releasePledgeToSolver — pledger releases self-locked tokens to solver
// ═══════════════════════════════════════════════════════════════════════════

describe('releasePledgeToSolver', () => {
	it('returns failure for empty proofs', async () => {
		const pledge = { ...makeDecodedPledge(100), proofs: [] };
		const result = await releasePledgeToSolver(pledge, PLEDGER_PRIVKEY, SOLVER_PK);

		expect(result.success).toBe(false);
		expect(result.error).toContain('No proofs');
	});

	it('returns failure for zero-amount proofs', async () => {
		mockedGetProofsAmount.mockReturnValue(0);
		const pledge = makeDecodedPledge(0);

		const result = await releasePledgeToSolver(pledge, PLEDGER_PRIVKEY, SOLVER_PK);

		expect(result.success).toBe(false);
		expect(result.error).toContain('zero total amount');
	});

	it('signs with pledger privkey, swaps, and re-locks to solver', async () => {
		const wallet = mockWallet();
		mockedGetWallet.mockResolvedValue(wallet);
		const pledge = makeDecodedPledge(100);

		const result = await releasePledgeToSolver(pledge, PLEDGER_PRIVKEY, SOLVER_PK);

		expect(result.success).toBe(true);
		expect(result.proofs.length).toBeGreaterThan(0);
		// Step 1: Sign P2PK proofs with pledger's private key
		expect(wallet.signP2PKProofs).toHaveBeenCalledWith(pledge.proofs, PLEDGER_PRIVKEY);
		// Step 1: Swap signed proofs at mint (with privkey)
		expect(wallet.send).toHaveBeenCalled();
		// Step 2: Lock fresh proofs to solver pubkey
		expect(mockedCreateP2PKLock).toHaveBeenCalledWith(SOLVER_PK);
	});

	it('connects to the pledge mint URL', async () => {
		const wallet = mockWallet();
		mockedGetWallet.mockResolvedValue(wallet);
		const pledge = makeDecodedPledge(100, 'evt-1', 'https://custom-mint.com');

		await releasePledgeToSolver(pledge, PLEDGER_PRIVKEY, SOLVER_PK);

		expect(mockedGetWallet).toHaveBeenCalledWith('https://custom-mint.com');
	});

	it('returns failure when swap fees exceed amount', async () => {
		const wallet = mockWallet({ getFeesForProofs: vi.fn(() => 200) });
		mockedGetWallet.mockResolvedValue(wallet);
		const pledge = makeDecodedPledge(50);

		const result = await releasePledgeToSolver(pledge, PLEDGER_PRIVKEY, SOLVER_PK);

		expect(result.success).toBe(false);
		expect(result.error).toContain('Insufficient amount after swap fees');
	});

	it('throws DoubleSpendError when mint reports already spent', async () => {
		const wallet = mockWallet({
			send: vi.fn(async () => {
				throw new Error('Token already spent');
			})
		});
		mockedGetWallet.mockResolvedValue(wallet);
		const pledge = makeDecodedPledge(100);

		await expect(releasePledgeToSolver(pledge, PLEDGER_PRIVKEY, SOLVER_PK)).rejects.toThrow(
			DoubleSpendError
		);
	});

	it('returns failure for generic errors', async () => {
		const wallet = mockWallet({
			send: vi.fn(async () => {
				throw new Error('Unknown mint error');
			})
		});
		mockedGetWallet.mockResolvedValue(wallet);
		const pledge = makeDecodedPledge(100);

		const result = await releasePledgeToSolver(pledge, PLEDGER_PRIVKEY, SOLVER_PK);

		expect(result.success).toBe(false);
		expect(result.error).toContain('Unknown mint error');
	});

	it('handles mint connection error', async () => {
		mockedGetWallet.mockRejectedValue(new Error('Mint offline'));
		const pledge = makeDecodedPledge(100);

		const result = await releasePledgeToSolver(pledge, PLEDGER_PRIVKEY, SOLVER_PK);

		expect(result.success).toBe(false);
		expect(result.error).toContain('Mint offline');
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// reclaimPledge — pledger takes back self-locked tokens
// ═══════════════════════════════════════════════════════════════════════════

describe('reclaimPledge', () => {
	it('returns failure for empty proofs', async () => {
		const pledge = { ...makeDecodedPledge(100), proofs: [] };
		const result = await reclaimPledge(pledge, PLEDGER_PRIVKEY);

		expect(result.success).toBe(false);
		expect(result.error).toContain('No proofs');
	});

	it('returns failure for zero-amount proofs', async () => {
		mockedGetProofsAmount.mockReturnValue(0);
		const pledge = makeDecodedPledge(0);

		const result = await reclaimPledge(pledge, PLEDGER_PRIVKEY);

		expect(result.success).toBe(false);
		expect(result.error).toContain('zero total amount');
	});

	it('signs and swaps to reclaim unlocked proofs', async () => {
		const wallet = mockWallet();
		mockedGetWallet.mockResolvedValue(wallet);
		const pledge = makeDecodedPledge(100);

		const result = await reclaimPledge(pledge, PLEDGER_PRIVKEY);

		expect(result.success).toBe(true);
		expect(result.sendProofs.length).toBeGreaterThan(0);
		expect(wallet.signP2PKProofs).toHaveBeenCalledWith(pledge.proofs, PLEDGER_PRIVKEY);
		expect(wallet.send).toHaveBeenCalledOnce();
	});

	it('returns fees in result', async () => {
		const wallet = mockWallet({ getFeesForProofs: vi.fn(() => 3) });
		mockedGetWallet.mockResolvedValue(wallet);
		const pledge = makeDecodedPledge(100);

		const result = await reclaimPledge(pledge, PLEDGER_PRIVKEY);

		expect(result.success).toBe(true);
		expect(result.fees).toBe(3);
	});

	it('returns failure when fees exceed amount', async () => {
		const wallet = mockWallet({ getFeesForProofs: vi.fn(() => 200) });
		mockedGetWallet.mockResolvedValue(wallet);
		const pledge = makeDecodedPledge(50);

		const result = await reclaimPledge(pledge, PLEDGER_PRIVKEY);

		expect(result.success).toBe(false);
		expect(result.error).toContain('Insufficient amount after fees');
	});

	it('throws DoubleSpendError when mint reports already spent', async () => {
		const wallet = mockWallet({
			send: vi.fn(async () => {
				throw new Error('Token already spent');
			})
		});
		mockedGetWallet.mockResolvedValue(wallet);
		const pledge = makeDecodedPledge(100);

		await expect(reclaimPledge(pledge, PLEDGER_PRIVKEY)).rejects.toThrow(DoubleSpendError);
	});

	it('returns failure for generic errors', async () => {
		const wallet = mockWallet({
			send: vi.fn(async () => {
				throw new Error('Mint timeout');
			})
		});
		mockedGetWallet.mockResolvedValue(wallet);
		const pledge = makeDecodedPledge(100);

		const result = await reclaimPledge(pledge, PLEDGER_PRIVKEY);

		expect(result.success).toBe(false);
		expect(result.error).toContain('Mint timeout');
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// encodePayoutToken
// ═══════════════════════════════════════════════════════════════════════════

describe('encodePayoutToken', () => {
	it('calls encodeToken with correct memo', async () => {
		mockedEncodeToken.mockResolvedValue('cashuBpayout123');
		const proofs = [mockProof(500)];

		const result = await encodePayoutToken(proofs, MINT_URL);

		expect(result).toBe('cashuBpayout123');
		expect(mockedEncodeToken).toHaveBeenCalledWith(proofs, MINT_URL, 'Bounty.ninja bounty payout');
	});
});
