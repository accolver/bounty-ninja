import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProofState, Wallet } from '@cashu/cashu-ts';
import type { Bounty, Payout, Pledge } from '$lib/bounty/types';
import {
	verifyPayoutsForBounty,
	verifyPledgesForBounty,
	type FinancialVerifierDependencies
} from '$lib/cashu/financial-verifier';
import type { P2PKProofCondition } from '$lib/cashu/pledge-verification';
import type { ProofIdentity, TokenInfo } from '$lib/cashu/types';

vi.mock('$lib/cashu/mint', () => ({ getWallet: vi.fn() }));

const NOW = 1_700_000_000;
const AUTHOR = 'a'.repeat(64);
const SOLVER = 'b'.repeat(64);
const ADDRESS = `37300:${AUTHOR}:bounty`;
const MINT = 'https://mint.example';

const bounty = {
	event: {
		id: '1'.repeat(64),
		pubkey: AUTHOR,
		created_at: NOW - 100,
		kind: 37300,
		tags: [],
		content: '',
		sig: '2'.repeat(128)
	},
	id: '1'.repeat(64),
	dTag: 'bounty',
	pubkey: AUTHOR,
	title: 'Bounty',
	description: '',
	rewardAmount: 10,
	rewardCurrency: 'sat',
	tags: [],
	deadline: NOW + 1_000,
	status: 'open',
	totalPledged: 0,
	solutionCount: 0,
	createdAt: NOW - 100,
	mintUrl: MINT,
	submissionFee: 0
} satisfies Bounty;

function pledge(id = '3'.repeat(64)): Pledge {
	return {
		event: { ...bounty.event, id, kind: 73002, pubkey: AUTHOR },
		id,
		pubkey: AUTHOR,
		paymentPubkey: 'c'.repeat(64),
		bountyAddress: ADDRESS,
		amount: 10,
		cashuToken: `cashuB${id}`,
		mintUrl: MINT,
		createdAt: NOW,
		message: ''
	};
}

function payout(id = '4'.repeat(64)): Payout {
	return {
		event: { ...bounty.event, id, kind: 73004, pubkey: AUTHOR },
		id,
		pubkey: AUTHOR,
		bountyAddress: ADDRESS,
		solutionId: '5'.repeat(64),
		solverPubkey: SOLVER,
		paymentPubkey: 'd'.repeat(64),
		amount: 10,
		cashuToken: `cashuB${id}`,
		sourcePledgeId: '3'.repeat(64),
		mintUrl: MINT,
		createdAt: NOW
	};
}

function token(secret = 'secret'): TokenInfo {
	return {
		mint: MINT,
		amount: 10,
		unit: 'sat',
		proofs: [{ id: 'keyset', amount: 10, secret, C: 'point' }]
	};
}

function condition(target: string, withDeadline: boolean): P2PKProofCondition {
	return {
		target: `02${target}`,
		refundKeys: withDeadline ? [`02${target}`] : [],
		locktime: withDeadline ? bounty.deadline : null,
		nSigs: 1,
		nSigsRefund: 1,
		sigFlag: 'SIG_INPUTS'
	};
}

describe('runtime financial verification', () => {
	let states: ProofState[];
	let nut11Supported: boolean;
	let decoded: TokenInfo | null;
	let inspected: P2PKProofCondition | null;
	let identity: ProofIdentity;
	let dependencies: FinancialVerifierDependencies;

	beforeEach(() => {
		states = [{ state: 'UNSPENT' }] as ProofState[];
		nut11Supported = true;
		decoded = token();
		inspected = condition('c'.repeat(64), false);
		identity = `${MINT}#proof` as ProofIdentity;
		dependencies = {
			decode: vi.fn(async () => decoded),
			wallet: vi.fn(
				async () =>
					({
						checkProofsStates: vi.fn(async () => states),
						getMintInfo: vi.fn(() => ({
							isSupported: vi.fn(() => ({ supported: nut11Supported }))
						}))
					}) as unknown as Wallet
			),
			identities: vi.fn(async () => [identity]),
			condition: vi.fn(async () => inspected),
			now: () => NOW
		};
	});

	it('produces a fresh valid pledge verification from mint and NUT-11 checks', async () => {
		const record = (await verifyPledgesForBounty(bounty, [pledge()], dependencies)).get(
			'3'.repeat(64)
		);
		expect(record).toMatchObject({
			status: 'valid',
			checkedAt: NOW,
			validUntil: NOW + 300,
			decodedAmount: 10,
			reasons: []
		});
	});

	it('fails closed for duplicate proofs, unsupported NUT-11, and unreachable mints', async () => {
		const first = pledge('6'.repeat(64));
		const second = pledge('7'.repeat(64));
		let records = await verifyPledgesForBounty(bounty, [first, second], dependencies);
		expect(records.get(first.id)).toMatchObject({ status: 'invalid' });
		expect(records.get(first.id)?.reasons).toContain('duplicate_proof');

		nut11Supported = false;
		records = await verifyPledgesForBounty(bounty, [pledge()], dependencies);
		expect(records.get('3'.repeat(64))?.reasons).toContain('nut11_unsupported');
		expect(records.get('3'.repeat(64))?.status).toBe('invalid');

		dependencies.wallet = vi.fn(async () => {
			throw new Error('mint offline');
		});
		records = await verifyPledgesForBounty(bounty, [pledge()], dependencies);
		expect(records.get('3'.repeat(64))).toMatchObject({
			status: 'unavailable',
			validUntil: null
		});
	});

	it('does not fall back to the pledge identity pubkey', async () => {
		inspected = condition(AUTHOR, false);
		const record = (await verifyPledgesForBounty(bounty, [pledge()], dependencies)).get(
			'3'.repeat(64)
		);
		expect(record?.status).toBe('invalid');
		expect(record?.reasons).toContain('p2pk_target_mismatch');
	});

	it('produces a valid solver-locked payout token verification', async () => {
		inspected = condition('d'.repeat(64), false);
		const item = payout();
		const record = (await verifyPayoutsForBounty(bounty, [item], dependencies)).get(item.id);
		expect(record).toMatchObject({
			status: 'valid',
			validUntil: NOW + 300,
			decodedAmount: 10,
			p2pkTarget: `02${'d'.repeat(64)}`,
			reasons: []
		});
	});

	it('rejects spent, redirected, duplicate, and unsupported payout proofs', async () => {
		inspected = condition(AUTHOR, false);
		states = [{ state: 'SPENT' }] as ProofState[];
		nut11Supported = false;
		const first = payout('8'.repeat(64));
		const second = payout('9'.repeat(64));
		const records = await verifyPayoutsForBounty(bounty, [first, second], dependencies);
		const record = records.get(first.id);
		expect(record?.status).toBe('invalid');
		expect(record?.reasons).toEqual(
			expect.arrayContaining([
				'duplicate_proof',
				'spent_proof',
				'nut11_unsupported',
				'p2pk_target_mismatch'
			])
		);
	});

	it('marks undecodable and temporarily unverifiable payout tokens fail closed', async () => {
		decoded = null;
		let record = (await verifyPayoutsForBounty(bounty, [payout()], dependencies)).get(
			'4'.repeat(64)
		);
		expect(record).toMatchObject({ status: 'invalid', reasons: ['decode_failed'] });

		decoded = token();
		inspected = condition('d'.repeat(64), false);
		states = [{ state: 'PENDING' }] as ProofState[];
		record = (await verifyPayoutsForBounty(bounty, [payout()], dependencies)).get('4'.repeat(64));
		expect(record).toMatchObject({ status: 'unavailable' });
		expect(record?.reasons).toContain('pending_proof');
	});
});
