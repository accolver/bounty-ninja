/**
 * Unit tests for pledge-monitor: spent token detection and auto-retraction.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Pledge, Retraction } from '$lib/bounty/types';
import type { NostrEvent } from 'nostr-tools';
import { PLEDGE_KIND, RETRACTION_KIND } from '$lib/bounty/kinds';

// Mock all external dependencies before imports
vi.mock('$lib/utils/env', () => ({
	getVoteQuorumFraction: () => 0.66
}));

vi.mock('$lib/cashu/token', () => ({
	decodeToken: vi.fn()
}));

vi.mock('$lib/cashu/mint', () => ({
	getWallet: vi.fn()
}));

vi.mock('$lib/nostr/account.svelte', () => ({
	accountState: { pubkey: null }
}));

vi.mock('$lib/nostr/signer.svelte', () => ({
	publishEvent: vi.fn()
}));

import { detectSpentUnretractedPledges, autoRetractSpentPledge } from '$lib/cashu/pledge-monitor.svelte';
import { decodeToken } from '$lib/cashu/token';
import { getWallet } from '$lib/cashu/mint';
import { accountState } from '$lib/nostr/account.svelte';
import { publishEvent } from '$lib/nostr/signer.svelte';

const PUBKEY_A = 'a'.repeat(64);
const PUBKEY_B = 'b'.repeat(64);
const SIG = 'c'.repeat(128);
const TASK_ADDR = `37300:${PUBKEY_B}:bounty-123`;
const MINT_URL = 'https://mint.example.com';

function makePledge(id: string, pubkey: string = PUBKEY_A): Pledge {
	return {
		event: {
			id,
			pubkey,
			created_at: Math.floor(Date.now() / 1000),
			kind: PLEDGE_KIND,
			tags: [['a', TASK_ADDR]],
			content: '',
			sig: SIG
		},
		id,
		pubkey,
		bountyAddress: TASK_ADDR,
		amount: 1000,
		cashuToken: 'cashuAtoken123',
		mintUrl: MINT_URL,
		createdAt: Math.floor(Date.now() / 1000),
		message: ''
	};
}

function makeRetraction(pledgeEventId: string): Retraction {
	return {
		event: {} as NostrEvent,
		id: 'r'.repeat(64),
		pubkey: PUBKEY_A,
		taskAddress: TASK_ADDR,
		type: 'pledge',
		pledgeEventId,
		reason: '',
		createdAt: Math.floor(Date.now() / 1000),
		hasSolutions: false
	};
}

const mockWallet = {
	checkProofsStates: vi.fn()
};

beforeEach(() => {
	vi.clearAllMocks();
	(decodeToken as ReturnType<typeof vi.fn>).mockResolvedValue({
		mint: MINT_URL,
		proofs: [{ secret: 'test', C: 'test', amount: 1000, id: 'test' }],
		amount: 1000
	});
	(getWallet as ReturnType<typeof vi.fn>).mockResolvedValue(mockWallet);
});

describe('detectSpentUnretractedPledges', () => {
	it('returns empty array when all pledges are unspent', async () => {
		mockWallet.checkProofsStates.mockResolvedValue([{ state: 'UNSPENT' }]);
		const pledges = [makePledge('1'.repeat(64))];
		const result = await detectSpentUnretractedPledges(pledges, []);
		expect(result).toEqual([]);
	});

	it('detects spent pledge with no retraction', async () => {
		mockWallet.checkProofsStates.mockResolvedValue([{ state: 'SPENT' }]);
		const pledgeId = '1'.repeat(64);
		const pledges = [makePledge(pledgeId)];
		const result = await detectSpentUnretractedPledges(pledges, []);
		expect(result).toEqual([pledgeId]);
	});

	it('skips already-retracted pledges', async () => {
		mockWallet.checkProofsStates.mockResolvedValue([{ state: 'SPENT' }]);
		const pledgeId = '1'.repeat(64);
		const pledges = [makePledge(pledgeId)];
		const retractions = [makeRetraction(pledgeId)];
		const result = await detectSpentUnretractedPledges(pledges, retractions);
		expect(result).toEqual([]);
	});

	it('handles multiple pledges — only returns spent unretracted ones', async () => {
		const pledgeA = makePledge('1'.repeat(64));
		const pledgeB = makePledge('2'.repeat(64));
		const pledgeC = makePledge('3'.repeat(64));

		// A: spent, B: unspent, C: spent but retracted
		mockWallet.checkProofsStates
			.mockResolvedValueOnce([{ state: 'SPENT' }])    // A
			.mockResolvedValueOnce([{ state: 'UNSPENT' }])  // B
			.mockResolvedValueOnce([{ state: 'SPENT' }]);   // C (won't be checked — retracted)

		const retractions = [makeRetraction('3'.repeat(64))];
		const result = await detectSpentUnretractedPledges([pledgeA, pledgeB, pledgeC], retractions);
		expect(result).toEqual(['1'.repeat(64)]);
	});

	it('handles mint errors gracefully — treats as not spent', async () => {
		(getWallet as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Connection refused'));
		const pledges = [makePledge('1'.repeat(64))];
		const result = await detectSpentUnretractedPledges(pledges, []);
		expect(result).toEqual([]);
	});

	it('handles token decode failure gracefully', async () => {
		(decodeToken as ReturnType<typeof vi.fn>).mockResolvedValue(null);
		const pledges = [makePledge('1'.repeat(64))];
		const result = await detectSpentUnretractedPledges(pledges, []);
		expect(result).toEqual([]);
	});
});

describe('autoRetractSpentPledge', () => {
	it('does nothing if current user is not the pledger', async () => {
		(accountState as { pubkey: string | null }).pubkey = PUBKEY_B; // different user
		const pledge = makePledge('1'.repeat(64), PUBKEY_A);
		const result = await autoRetractSpentPledge(pledge, TASK_ADDR, false);
		expect(result).toBe(false);
		expect(publishEvent).not.toHaveBeenCalled();
	});

	it('does nothing if not logged in', async () => {
		(accountState as { pubkey: string | null }).pubkey = null;
		const pledge = makePledge('1'.repeat(64), PUBKEY_A);
		const result = await autoRetractSpentPledge(pledge, TASK_ADDR, false);
		expect(result).toBe(false);
		expect(publishEvent).not.toHaveBeenCalled();
	});

	it('publishes retraction only (no reputation) when no solutions', async () => {
		(accountState as { pubkey: string | null }).pubkey = PUBKEY_A;
		const signedEvent = { id: 'signed'.padEnd(64, '0'), kind: RETRACTION_KIND } as NostrEvent;
		(publishEvent as ReturnType<typeof vi.fn>).mockResolvedValue({ event: signedEvent, broadcast: {} });

		const pledge = makePledge('1'.repeat(64), PUBKEY_A);
		const result = await autoRetractSpentPledge(pledge, TASK_ADDR, false);
		expect(result).toBe(true);
		expect(publishEvent).toHaveBeenCalledTimes(1); // Only retraction, no reputation
	});

	it('publishes retraction AND reputation when solutions exist', async () => {
		(accountState as { pubkey: string | null }).pubkey = PUBKEY_A;
		const signedEvent = { id: 'signed'.padEnd(64, '0'), kind: RETRACTION_KIND } as NostrEvent;
		(publishEvent as ReturnType<typeof vi.fn>).mockResolvedValue({ event: signedEvent, broadcast: {} });

		const pledge = makePledge('1'.repeat(64), PUBKEY_A);
		const result = await autoRetractSpentPledge(pledge, TASK_ADDR, true);
		expect(result).toBe(true);
		expect(publishEvent).toHaveBeenCalledTimes(2); // Retraction + reputation
	});

	it('returns false on publish failure', async () => {
		(accountState as { pubkey: string | null }).pubkey = PUBKEY_A;
		(publishEvent as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Signing failed'));

		const pledge = makePledge('1'.repeat(64), PUBKEY_A);
		const result = await autoRetractSpentPledge(pledge, TASK_ADDR, false);
		expect(result).toBe(false);
	});
});
