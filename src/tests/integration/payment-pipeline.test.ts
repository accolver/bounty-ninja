/**
 * Integration test: Full pledge → payout payment pipeline.
 *
 * Tests the end-to-end flow with mocked wallet/mint:
 * 1. Decode pasted token → validate structure
 * 2. createPledgeToken → P2PK lock to creator (with refund path)
 * 3. Publish pledge event with encoded token
 * 4. collectPledgeTokens → extract from pledge events
 * 5. swapPledgeTokens → creator unlocks with privkey
 * 6. createPayoutToken → P2PK lock to solver
 * 7. encodePayoutToken → publish payout event
 *
 * Uses real EventStore with no relay connections.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventStore } from 'applesauce-core';
import { firstValueFrom, skip, take } from 'rxjs';
import type { NostrEvent } from 'nostr-tools';
import type { Proof, Wallet, Token } from '@cashu/cashu-ts';
import { BOUNTY_KIND, PLEDGE_KIND, PAYOUT_KIND } from '$lib/bounty/kinds';
import { pledgeBlueprint, payoutBlueprint } from '$lib/bounty/blueprints';
import { parsePledge, parsePayout } from '$lib/bounty/helpers';

// ── Mock cashu modules ────────────────────────────────────────────────────

vi.mock('$lib/cashu/mint', () => ({
	getWallet: vi.fn()
}));

vi.mock('$lib/cashu/token', () => ({
	decodeToken: vi.fn(),
	encodeToken: vi.fn(),
	getProofsAmount: vi.fn((proofs: Proof[]) => proofs.reduce((s: number, p: Proof) => s + p.amount, 0)),
	getTokenAmount: vi.fn(),
	isValidToken: vi.fn()
}));

vi.mock('$lib/cashu/p2pk', () => ({
	createP2PKLock: vi.fn(() => ({ pubkey: 'a'.repeat(64) }))
}));

import {
	createPledgeToken,
	collectPledgeTokens,
	swapPledgeTokens,
	createPayoutToken,
	encodePayoutToken
} from '$lib/cashu/escrow';
import { decodeToken, encodeToken, getProofsAmount } from '$lib/cashu/token';
import { getWallet } from '$lib/cashu/mint';
import { createP2PKLock } from '$lib/cashu/p2pk';

const mockedGetWallet = vi.mocked(getWallet);
const mockedDecodeToken = vi.mocked(decodeToken);
const mockedEncodeToken = vi.mocked(encodeToken);
const mockedCreateP2PKLock = vi.mocked(createP2PKLock);

// ── Constants ─────────────────────────────────────────────────────────────

const CREATOR_PK = 'a'.repeat(64);
const PLEDGER_PK = 'b'.repeat(64);
const SOLVER_PK = 'c'.repeat(64);
const CREATOR_PRIVKEY = 'f'.repeat(64);
const SIG = 'd'.repeat(128);
const MINT_URL = 'https://testnut.cashu.space';
const D_TAG = 'payment-pipeline-test';
const BOUNTY_ADDRESS = `${BOUNTY_KIND}:${CREATOR_PK}:${D_TAG}`;
const DEADLINE = Math.floor(Date.now() / 1000) + 86400; // 24h from now

function mockProof(amount: number, id = 'proof'): Proof {
	return { id, amount, secret: `secret-${amount}`, C: 'c' } as Proof;
}

function signEvent(
	template: { kind: number; tags: string[][]; content: string; created_at: number },
	pubkey: string
): NostrEvent {
	return {
		...template,
		id: crypto.randomUUID().replace(/-/g, '').padEnd(64, '0').slice(0, 64),
		pubkey,
		sig: SIG
	};
}

function makeBountyEvent(): NostrEvent {
	return {
		id: crypto.randomUUID().replace(/-/g, '').padEnd(64, '0').slice(0, 64),
		pubkey: CREATOR_PK,
		created_at: Math.floor(Date.now() / 1000),
		kind: BOUNTY_KIND,
		tags: [
			['d', D_TAG],
			['title', 'Payment Pipeline Test Bounty'],
			['reward', '10000'],
			['expiration', String(DEADLINE)],
			['mint', MINT_URL],
			['client', 'bounty.ninja']
		],
		content: 'Test bounty for payment pipeline integration test',
		sig: SIG
	};
}

function mockWallet(overrides: Record<string, unknown> = {}): Wallet {
	return {
		getFeesForProofs: vi.fn(() => 1), // 1 sat fee per swap
		send: vi.fn(async (amount: number) => ({
			keep: [],
			send: [mockProof(amount, `locked-${amount}`)]
		})),
		signP2PKProofs: vi.fn((proofs: Proof[]) => proofs),
		checkProofsStates: vi.fn(async (proofs: Proof[]) =>
			proofs.map(() => ({ state: 'UNSPENT' }))
		),
		...overrides
	} as unknown as Wallet;
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('Full payment pipeline: pledge → payout', () => {
	let store: EventStore;
	let wallet: Wallet;

	beforeEach(() => {
		vi.clearAllMocks();
		store = new EventStore();
		store.verifyEvent = () => true;
		wallet = mockWallet();
		mockedGetWallet.mockResolvedValue(wallet);
		mockedCreateP2PKLock.mockReturnValue({ pubkey: CREATOR_PK });
	});

	it('completes a full pledge → swap → payout cycle', async () => {
		// ── Step 1: Pledger "pastes" a token and we decode it ──────────
		const pastedToken = 'cashuBpledgerinput123';
		const pastedProofs = [mockProof(100), mockProof(50)]; // 150 sats total
		const tokenInfo = {
			mint: MINT_URL,
			amount: 150,
			proofs: pastedProofs,
			memo: undefined,
			unit: 'sat'
		};

		// Simulate decode of pasted token
		mockedDecodeToken.mockReturnValue(tokenInfo);
		const decoded = decodeToken(pastedToken);
		expect(decoded).not.toBeNull();
		expect(decoded!.amount).toBe(150);
		expect(decoded!.mint).toBe(MINT_URL);

		// ── Step 2: Create P2PK-locked pledge token ───────────────────
		const pledgeResult = await createPledgeToken(
			decoded!.proofs,
			CREATOR_PK,
			MINT_URL,
			DEADLINE,
			PLEDGER_PK
		);

		expect(pledgeResult.success).toBe(true);
		expect(pledgeResult.proofs.length).toBeGreaterThan(0);

		// Verify P2PK lock was created with locktime and refund key
		expect(mockedCreateP2PKLock).toHaveBeenCalledWith(CREATOR_PK, DEADLINE, [PLEDGER_PK]);

		// ── Step 3: Encode locked token and publish pledge event ───────
		mockedEncodeToken.mockReturnValue('cashuBlockedpledge456');
		const lockedTokenStr = encodeToken(pledgeResult.proofs, MINT_URL, 'Bounty.ninja pledge');
		const pledgeAmount = getProofsAmount(pledgeResult.proofs);

		const pledgeTemplate = pledgeBlueprint({
			bountyAddress: BOUNTY_ADDRESS,
			creatorPubkey: CREATOR_PK,
			amount: pledgeAmount,
			cashuToken: lockedTokenStr,
			mintUrl: MINT_URL,
			message: 'Funding the bounty!'
		});

		const pledgeEvent = signEvent(pledgeTemplate, PLEDGER_PK);

		// Insert into EventStore
		const pledgePromise = firstValueFrom(
			store.timeline({ kinds: [PLEDGE_KIND], '#a': [BOUNTY_ADDRESS] }).pipe(skip(1), take(1))
		);
		store.add(pledgeEvent);
		const pledgeEvents = await pledgePromise;

		expect(pledgeEvents).toHaveLength(1);
		expect(pledgeEvents[0].kind).toBe(PLEDGE_KIND);

		// Parse and validate
		const parsedPledge = parsePledge(pledgeEvent);
		expect(parsedPledge).not.toBeNull();
		expect(parsedPledge!.cashuToken).toBe('cashuBlockedpledge456');
		expect(parsedPledge!.amount).toBe(pledgeAmount);

		// ── Step 4: Creator collects pledge tokens from events ─────────
		mockedDecodeToken.mockReturnValue({
			mint: MINT_URL,
			amount: pledgeAmount,
			proofs: pledgeResult.proofs,
			memo: 'Bounty.ninja pledge',
			unit: 'sat'
		});

		const decodedPledges = collectPledgeTokens([pledgeEvent]);
		expect(decodedPledges).toHaveLength(1);
		expect(decodedPledges[0].amount).toBe(pledgeAmount);
		expect(decodedPledges[0].pledgerPubkey).toBe(PLEDGER_PK);

		// ── Step 5: Creator swaps locked tokens with privkey ──────────
		const swapResult = await swapPledgeTokens(decodedPledges, wallet, CREATOR_PRIVKEY);

		expect(swapResult.success).toBe(true);
		expect(swapResult.sendProofs.length).toBeGreaterThan(0);
		expect(wallet.signP2PKProofs).toHaveBeenCalledWith(
			decodedPledges[0].proofs,
			CREATOR_PRIVKEY
		);

		// ── Step 6: Creator creates solver-locked payout token ────────
		mockedCreateP2PKLock.mockReturnValue({ pubkey: SOLVER_PK });

		const payoutResult = await createPayoutToken(
			swapResult.sendProofs,
			SOLVER_PK,
			wallet
		);

		expect(payoutResult.success).toBe(true);
		expect(payoutResult.proofs.length).toBeGreaterThan(0);
		expect(mockedCreateP2PKLock).toHaveBeenCalledWith(SOLVER_PK);

		// ── Step 7: Encode payout token and publish payout event ──────
		mockedEncodeToken.mockReturnValue('cashuBpayouttosolver789');
		const payoutTokenStr = encodePayoutToken(payoutResult.proofs, MINT_URL);
		const payoutAmount = getProofsAmount(payoutResult.proofs);

		const payoutTemplate = payoutBlueprint({
			bountyAddress: BOUNTY_ADDRESS,
			solutionId: 'e'.repeat(64),
			solverPubkey: SOLVER_PK,
			amount: payoutAmount,
			cashuToken: payoutTokenStr
		});

		const payoutEvent = signEvent(payoutTemplate, CREATOR_PK);

		// Insert into EventStore
		const payoutPromise = firstValueFrom(
			store.timeline({ kinds: [PAYOUT_KIND], '#a': [BOUNTY_ADDRESS] }).pipe(skip(1), take(1))
		);
		store.add(payoutEvent);
		const payoutEvents = await payoutPromise;

		expect(payoutEvents).toHaveLength(1);
		expect(payoutEvents[0].kind).toBe(PAYOUT_KIND);

		// Parse and validate
		const parsedPayout = parsePayout(payoutEvent, CREATOR_PK);
		expect(parsedPayout).not.toBeNull();
		expect(parsedPayout!.cashuToken).toBe('cashuBpayouttosolver789');
		expect(parsedPayout!.solverPubkey).toBe(SOLVER_PK);
		expect(parsedPayout!.amount).toBe(payoutAmount);
	});

	it('handles fee deductions through the pipeline', async () => {
		// Wallet with 2-sat fees
		const feeWallet = mockWallet({
			getFeesForProofs: vi.fn(() => 2),
			send: vi.fn(async (amount: number) => ({
				keep: [mockProof(2, 'change')],
				send: [mockProof(amount, `locked-${amount}`)]
			}))
		});
		mockedGetWallet.mockResolvedValue(feeWallet);

		// Pledger has 100 sats
		const proofs = [mockProof(100)];

		// Pledge: 100 - 2 fee = 98 sats locked
		const pledgeResult = await createPledgeToken(proofs, CREATOR_PK, MINT_URL);
		expect(pledgeResult.success).toBe(true);
		const pledgeAmount = getProofsAmount(pledgeResult.proofs);
		expect(pledgeAmount).toBe(98);

		// Swap: 98 - 2 fee = 96 sats unlocked
		const pledge = {
			token: { mint: MINT_URL, proofs: pledgeResult.proofs, unit: 'sat' } as Token,
			mint: MINT_URL,
			amount: pledgeAmount,
			proofs: pledgeResult.proofs,
			eventId: 'evt-fee-test',
			pledgerPubkey: PLEDGER_PK
		};

		const swapResult = await swapPledgeTokens([pledge], feeWallet, CREATOR_PRIVKEY);
		expect(swapResult.success).toBe(true);
		const swapAmount = getProofsAmount(swapResult.sendProofs);
		expect(swapAmount).toBe(96);

		// Payout: 96 - 2 fee = 94 sats to solver
		const payoutResult = await createPayoutToken(swapResult.sendProofs, SOLVER_PK, feeWallet);
		expect(payoutResult.success).toBe(true);
		const payoutAmount = getProofsAmount(payoutResult.proofs);
		expect(payoutAmount).toBe(94);

		// Total fees: 2 + 2 + 2 = 6 sats across 3 swaps
	});

	it('rejects unauthorized payout events', () => {
		const payoutTemplate = payoutBlueprint({
			bountyAddress: BOUNTY_ADDRESS,
			solutionId: 'e'.repeat(64),
			solverPubkey: SOLVER_PK,
			amount: 100,
			cashuToken: 'cashuBfake'
		});

		// Sign with a different key (not the creator)
		const badPayoutEvent = signEvent(payoutTemplate, PLEDGER_PK);
		const parsed = parsePayout(badPayoutEvent, CREATOR_PK);

		expect(parsed).toBeNull(); // Unauthorized payout rejected
	});

	it('handles multiple pledgers in a single payout', async () => {
		const tokenInfo1 = {
			mint: MINT_URL,
			amount: 100,
			proofs: [mockProof(100, 'p1')],
			memo: undefined,
			unit: 'sat'
		};
		const tokenInfo2 = {
			mint: MINT_URL,
			amount: 75,
			proofs: [mockProof(75, 'p2')],
			memo: undefined,
			unit: 'sat'
		};

		// Two pledge events from different pledgers
		const pledgeEvent1 = signEvent(
			pledgeBlueprint({
				bountyAddress: BOUNTY_ADDRESS,
				creatorPubkey: CREATOR_PK,
				amount: 100,
				cashuToken: 'cashuBpledge1',
				mintUrl: MINT_URL
			}),
			PLEDGER_PK
		);

		const pledgeEvent2 = signEvent(
			pledgeBlueprint({
				bountyAddress: BOUNTY_ADDRESS,
				creatorPubkey: CREATOR_PK,
				amount: 75,
				cashuToken: 'cashuBpledge2',
				mintUrl: MINT_URL
			}),
			SOLVER_PK // Second pledger (using SOLVER_PK just for a different key)
		);

		// Collect and decode both
		mockedDecodeToken.mockReturnValueOnce(tokenInfo1).mockReturnValueOnce(tokenInfo2);
		const decoded = collectPledgeTokens([pledgeEvent1, pledgeEvent2]);

		expect(decoded).toHaveLength(2);
		expect(decoded[0].amount).toBe(100);
		expect(decoded[1].amount).toBe(75);

		// Swap all together
		const swapResult = await swapPledgeTokens(decoded, wallet, CREATOR_PRIVKEY);
		expect(swapResult.success).toBe(true);

		// signP2PKProofs should receive combined proofs
		const signCall = (wallet.signP2PKProofs as ReturnType<typeof vi.fn>).mock.calls[0];
		expect(signCall[0]).toHaveLength(2); // Both pledgers' proofs combined
	});
});
