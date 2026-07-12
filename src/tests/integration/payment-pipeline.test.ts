/**
 * Integration test: Pledger-controlled escrow payment pipeline.
 *
 * Tests the end-to-end flow with mocked wallet/mint:
 * 1. Decode pasted token → validate structure
 * 2. createPledgeToken → P2PK lock to pledger's OWN pubkey (self-custody)
 * 3. Publish pledge event with encoded token
 * 4. collectPledgeTokens → extract from pledge events
 * 5. releasePledgeToSolver → pledger swaps self-locked to solver-locked
 * 6. encodePayoutToken → publish payout event
 *
 * Uses real EventStore with no relay connections.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventStore } from 'applesauce-core';
import { firstValueFrom, skip, take } from 'rxjs';
import type { NostrEvent } from 'nostr-tools';
import type { Proof, Wallet, Token } from '@cashu/cashu-ts';
import { CASHU_PAYMENT_SIGNER_PROTOCOL, type CashuPaymentSigner } from '$lib/cashu/payment-signer';

// Mock env before importing helpers (which transitively imports voting → env)
vi.mock('$lib/utils/env', () => ({
	getVoteQuorumFraction: () => 0.66
}));

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
	getProofsAmount: vi.fn((proofs: Proof[]) =>
		proofs.reduce((s: number, p: Proof) => s + p.amount, 0)
	),
	getTokenAmount: vi.fn(),
	isValidToken: vi.fn()
}));

vi.mock('$lib/cashu/p2pk', () => ({
	createP2PKLock: vi.fn(() => ({ pubkey: 'b'.repeat(64) })),
	assertNut11Support: vi.fn(),
	assertXOnlyPubkey: vi.fn(),
	isXOnlyPubkey: vi.fn((key: string) => /^[0-9a-f]{64}$/.test(key))
}));

import {
	createPledgeToken,
	collectPledgeTokens,
	releasePledgeToSolver,
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
const PLEDGER_2_PK = 'f'.repeat(64);
const SOLVER_PK = 'c'.repeat(64);
const PLEDGER_PAYMENT_PK = '7'.repeat(64);
const PLEDGER_2_PAYMENT_PK = '8'.repeat(64);
const SOLVER_PAYMENT_PK = '9'.repeat(64);
const SIG = 'd'.repeat(128);
const MINT_URL = 'https://testnut.cashu.space';
const D_TAG = 'payment-pipeline-test';
const BOUNTY_ADDRESS = `${BOUNTY_KIND}:${CREATOR_PK}:${D_TAG}`;

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

function mockWallet(overrides: Record<string, unknown> = {}): Wallet {
	return {
		getFeesForProofs: vi.fn(() => 1), // 1 sat fee per swap
		send: vi.fn(async (amount: number) => ({
			keep: [],
			send: [mockProof(amount, `locked-${amount}`)]
		})),
		signP2PKProofs: vi.fn((proofs: Proof[]) => proofs),
		checkProofsStates: vi.fn(async (proofs: Proof[]) => proofs.map(() => ({ state: 'UNSPENT' }))),
		...overrides
	} as unknown as Wallet;
}

function mockPaymentSigner(pubkey: string): CashuPaymentSigner {
	return {
		protocol: CASHU_PAYMENT_SIGNER_PROTOCOL,
		getPublicKey: vi.fn(async () => pubkey),
		signP2PKProofs: vi.fn(async ({ proofs }) =>
			proofs.map((proof: Proof) => ({
				...proof,
				witness: { signatures: [`signed-${pubkey}`] }
			}))
		)
	};
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('Pledger-controlled escrow pipeline: pledge → release → payout', () => {
	let store: EventStore;
	let wallet: Wallet;

	beforeEach(() => {
		vi.clearAllMocks();
		store = new EventStore();
		store.verifyEvent = () => true;
		wallet = mockWallet();
		mockedGetWallet.mockResolvedValue(wallet);
		mockedCreateP2PKLock.mockReturnValue({ pubkey: PLEDGER_PK });
	});

	it('completes a full pledge → release → payout cycle', async () => {
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
		mockedDecodeToken.mockResolvedValue(tokenInfo);
		const decoded = await decodeToken(pastedToken);
		expect(decoded).not.toBeNull();
		expect(decoded!.amount).toBe(150);
		expect(decoded!.mint).toBe(MINT_URL);

		// ── Step 2: Create P2PK-locked pledge token (self-custody) ────
		const pledgeResult = await createPledgeToken(decoded!.proofs, PLEDGER_PAYMENT_PK, MINT_URL);

		expect(pledgeResult.success).toBe(true);
		expect(pledgeResult.proofs.length).toBeGreaterThan(0);

		// Verify P2PK lock was created for the pledger (NOT the creator)
		expect(mockedCreateP2PKLock).toHaveBeenCalledWith(PLEDGER_PAYMENT_PK);

		// ── Step 3: Encode locked token and publish pledge event ───────
		mockedEncodeToken.mockResolvedValue('cashuBlockedpledge456');
		const lockedTokenStr = await encodeToken(pledgeResult.proofs, MINT_URL, 'Bounty.ninja pledge');
		const pledgeAmount = getProofsAmount(pledgeResult.proofs);

		const pledgeTemplate = pledgeBlueprint({
			bountyAddress: BOUNTY_ADDRESS,
			creatorPubkey: CREATOR_PK,
			paymentPubkey: PLEDGER_PAYMENT_PK,
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

		// ── Step 4: Collect pledge tokens from events ─────────────────
		mockedDecodeToken.mockResolvedValue({
			mint: MINT_URL,
			amount: pledgeAmount,
			proofs: pledgeResult.proofs,
			memo: 'Bounty.ninja pledge',
			unit: 'sat'
		});

		const decodedPledges = await collectPledgeTokens([pledgeEvent]);
		expect(decodedPledges).toHaveLength(1);
		expect(decodedPledges[0].amount).toBe(pledgeAmount);
		expect(decodedPledges[0].pledgerPubkey).toBe(PLEDGER_PK);

		// ── Step 5: Pledger releases to solver after consensus ────────
		mockedCreateP2PKLock.mockReturnValue({ pubkey: SOLVER_PAYMENT_PK });
		const paymentSigner = mockPaymentSigner(PLEDGER_PAYMENT_PK);

		const releaseResult = await releasePledgeToSolver(
			decodedPledges[0],
			paymentSigner,
			SOLVER_PAYMENT_PK
		);

		expect(releaseResult.success).toBe(true);
		expect(releaseResult.proofs.length).toBeGreaterThan(0);
		expect(paymentSigner.signP2PKProofs).toHaveBeenCalledWith({
			mintUrl: MINT_URL,
			proofs: decodedPledges[0].proofs,
			purpose: 'release'
		});
		expect(wallet.signP2PKProofs).not.toHaveBeenCalled();
		// Verify solver lock was created
		expect(mockedCreateP2PKLock).toHaveBeenCalledWith(SOLVER_PAYMENT_PK);

		// ── Step 6: Encode payout token and publish payout event ──────
		mockedEncodeToken.mockResolvedValue('cashuBpayouttosolver789');
		const payoutTokenStr = await encodePayoutToken(releaseResult.proofs, MINT_URL);
		const payoutAmount = getProofsAmount(releaseResult.proofs);

		const payoutTemplate = payoutBlueprint({
			bountyAddress: BOUNTY_ADDRESS,
			solutionId: 'e'.repeat(64),
			sourcePledgeId: pledgeEvent.id,
			solverPubkey: SOLVER_PK,
			paymentPubkey: SOLVER_PAYMENT_PK,
			amount: payoutAmount,
			cashuToken: payoutTokenStr,
			mintUrl: MINT_URL
		});

		// Payout event published by the PLEDGER (not the creator)
		const payoutEvent = signEvent(payoutTemplate, PLEDGER_PK);

		// Insert into EventStore
		const payoutPromise = firstValueFrom(
			store.timeline({ kinds: [PAYOUT_KIND], '#a': [BOUNTY_ADDRESS] }).pipe(skip(1), take(1))
		);
		store.add(payoutEvent);
		const payoutEvts = await payoutPromise;

		expect(payoutEvts).toHaveLength(1);
		expect(payoutEvts[0].kind).toBe(PAYOUT_KIND);

		// Parse and validate — pledger pubkey must be in pledgerPubkeys
		const parsedPayout = parsePayout(payoutEvent, [PLEDGER_PK]);
		expect(parsedPayout).not.toBeNull();
		expect(parsedPayout!.cashuToken).toBe('cashuBpayouttosolver789');
		expect(parsedPayout!.solverPubkey).toBe(SOLVER_PK);
		expect(parsedPayout!.amount).toBe(payoutAmount);
		expect(parsedPayout!.sourcePledgeId).toBe(pledgeEvent.id);
		expect(parsedPayout!.mintUrl).toBe(MINT_URL);
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

		// Pledge: 100 - 2 fee = 98 sats locked to self
		const pledgeResult = await createPledgeToken(proofs, PLEDGER_PAYMENT_PK, MINT_URL);
		expect(pledgeResult.success).toBe(true);
		const pledgeAmount = getProofsAmount(pledgeResult.proofs);
		expect(pledgeAmount).toBe(98);

		// Release: one atomic swap creates 96 sats locked directly to the solver.
		const pledge = {
			token: { mint: MINT_URL, proofs: pledgeResult.proofs, unit: 'sat' } as Token,
			mint: MINT_URL,
			amount: pledgeAmount,
			proofs: pledgeResult.proofs,
			eventId: 'evt-fee-test',
			pledgerPubkey: PLEDGER_PK
		};

		mockedCreateP2PKLock.mockReturnValue({ pubkey: SOLVER_PAYMENT_PK });

		const releaseResult = await releasePledgeToSolver(
			pledge,
			mockPaymentSigner(PLEDGER_PAYMENT_PK),
			SOLVER_PAYMENT_PK
		);
		expect(releaseResult.success).toBe(true);
		const releaseAmount = getProofsAmount(releaseResult.proofs);
		expect(releaseAmount).toBe(96);

		// Total fees: 2 (pledge) + 2 (atomic release) = 4 sats.
	});

	it('rejects unauthorized payout events from non-pledgers', () => {
		const payoutTemplate = payoutBlueprint({
			bountyAddress: BOUNTY_ADDRESS,
			solutionId: 'e'.repeat(64),
			sourcePledgeId: 'f'.repeat(64),
			solverPubkey: SOLVER_PK,
			paymentPubkey: SOLVER_PAYMENT_PK,
			amount: 100,
			cashuToken: 'cashuBfake',
			mintUrl: MINT_URL
		});

		// Sign with a key that is NOT a pledger
		const badPayoutEvent = signEvent(payoutTemplate, CREATOR_PK);
		const parsed = parsePayout(badPayoutEvent, [PLEDGER_PK]);

		expect(parsed).toBeNull(); // Unauthorized payout rejected
	});

	it('handles multiple pledgers each releasing independently', async () => {
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
				paymentPubkey: PLEDGER_PAYMENT_PK,
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
				paymentPubkey: PLEDGER_2_PAYMENT_PK,
				amount: 75,
				cashuToken: 'cashuBpledge2',
				mintUrl: MINT_URL
			}),
			PLEDGER_2_PK
		);

		// Collect and decode both
		mockedDecodeToken.mockResolvedValueOnce(tokenInfo1).mockResolvedValueOnce(tokenInfo2);
		const decoded = await collectPledgeTokens([pledgeEvent1, pledgeEvent2]);

		expect(decoded).toHaveLength(2);
		expect(decoded[0].amount).toBe(100);
		expect(decoded[0].pledgerPubkey).toBe(PLEDGER_PK);
		expect(decoded[1].amount).toBe(75);
		expect(decoded[1].pledgerPubkey).toBe(PLEDGER_2_PK);

		// Each pledger releases independently
		mockedCreateP2PKLock.mockReturnValue({ pubkey: SOLVER_PAYMENT_PK });

		const signer1 = mockPaymentSigner(PLEDGER_PAYMENT_PK);
		const signer2 = mockPaymentSigner(PLEDGER_2_PAYMENT_PK);
		const release1 = await releasePledgeToSolver(decoded[0], signer1, SOLVER_PAYMENT_PK);
		expect(release1.success).toBe(true);
		expect(signer1.signP2PKProofs).toHaveBeenCalledOnce();

		const release2 = await releasePledgeToSolver(decoded[1], signer2, SOLVER_PAYMENT_PK);
		expect(release2.success).toBe(true);
		expect(signer2.signP2PKProofs).toHaveBeenCalledOnce();

		// Each pledger publishes their own payout event
		mockedEncodeToken.mockResolvedValueOnce('cashuBpayout1').mockResolvedValueOnce('cashuBpayout2');

		const payoutToken1 = await encodePayoutToken(release1.proofs, MINT_URL);
		const payoutToken2 = await encodePayoutToken(release2.proofs, MINT_URL);

		const payoutEvent1 = signEvent(
			payoutBlueprint({
				bountyAddress: BOUNTY_ADDRESS,
				solutionId: 'e'.repeat(64),
				sourcePledgeId: pledgeEvent1.id,
				solverPubkey: SOLVER_PK,
				paymentPubkey: SOLVER_PAYMENT_PK,
				amount: getProofsAmount(release1.proofs),
				cashuToken: payoutToken1,
				mintUrl: MINT_URL
			}),
			PLEDGER_PK // Published by pledger 1
		);

		const payoutEvent2 = signEvent(
			payoutBlueprint({
				bountyAddress: BOUNTY_ADDRESS,
				solutionId: 'e'.repeat(64),
				sourcePledgeId: pledgeEvent2.id,
				solverPubkey: SOLVER_PK,
				paymentPubkey: SOLVER_PAYMENT_PK,
				amount: getProofsAmount(release2.proofs),
				cashuToken: payoutToken2,
				mintUrl: MINT_URL
			}),
			PLEDGER_2_PK // Published by pledger 2
		);

		// Both payouts should parse successfully
		const parsed1 = parsePayout(payoutEvent1, [PLEDGER_PK, PLEDGER_2_PK]);
		const parsed2 = parsePayout(payoutEvent2, [PLEDGER_PK, PLEDGER_2_PK]);

		expect(parsed1).not.toBeNull();
		expect(parsed2).not.toBeNull();
		expect(parsed1!.cashuToken).toBe('cashuBpayout1');
		expect(parsed2!.cashuToken).toBe('cashuBpayout2');
	});
});
