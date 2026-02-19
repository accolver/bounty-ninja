import { describe, it, expect, vi } from 'vitest';
import type { Proof, Wallet, P2PKOptions } from '@cashu/cashu-ts';
import {
	createP2PKLock,
	createP2PKLockFromParams,
	lockProofsToKey,
	toCompressedPubkey
} from '$lib/cashu/p2pk';
import type { P2PKLockParams } from '$lib/cashu/types';

function mockProof(amount: number, id = 'proof-id'): Proof {
	return {
		id,
		amount,
		secret: 'test-secret',
		C: 'test-c'
	} as Proof;
}

function mockWallet(overrides: Partial<Wallet> = {}): Wallet {
	return {
		getFeesForProofs: vi.fn(() => 0),
		send: vi.fn(async (amount: number) => ({
			keep: [],
			send: [mockProof(amount)]
		})),
		...overrides
	} as unknown as Wallet;
}

const VALID_PUBKEY = 'a'.repeat(64);
const COMPRESSED_PUBKEY = `02${'a'.repeat(64)}`;
const OTHER_PUBKEY = 'b'.repeat(64);
const COMPRESSED_OTHER = `02${'b'.repeat(64)}`;

// ── toCompressedPubkey ──────────────────────────────────────────────────────

describe('toCompressedPubkey', () => {
	it('prepends 02 to x-only (64-char) pubkey', () => {
		expect(toCompressedPubkey(VALID_PUBKEY)).toBe(COMPRESSED_PUBKEY);
	});

	it('passes through already-compressed 02-prefixed key', () => {
		const key = `02${'c'.repeat(64)}`;
		expect(toCompressedPubkey(key)).toBe(key);
	});

	it('passes through 03-prefixed key', () => {
		const key = `03${'d'.repeat(64)}`;
		expect(toCompressedPubkey(key)).toBe(key);
	});

	it('lowercases the key', () => {
		const upper = 'A'.repeat(64);
		expect(toCompressedPubkey(upper)).toBe(`02${'a'.repeat(64)}`);
	});

	it('throws for invalid key length', () => {
		expect(() => toCompressedPubkey('abcd')).toThrow('Invalid pubkey');
		expect(() => toCompressedPubkey('a'.repeat(60))).toThrow('Invalid pubkey');
		expect(() => toCompressedPubkey('a'.repeat(70))).toThrow('Invalid pubkey');
	});
});

// ── createP2PKLock ──────────────────────────────────────────────────────────

describe('createP2PKLock', () => {
	it('normalizes x-only pubkey to compressed format', () => {
		const options = createP2PKLock(VALID_PUBKEY);
		expect(options.pubkey).toBe(COMPRESSED_PUBKEY);
		expect(options.locktime).toBeUndefined();
		expect(options.refundKeys).toBeUndefined();
	});

	it('passes through already-compressed pubkey', () => {
		const options = createP2PKLock(COMPRESSED_PUBKEY);
		expect(options.pubkey).toBe(COMPRESSED_PUBKEY);
	});

	it('creates lock with locktime', () => {
		const locktime = Math.floor(Date.now() / 1000) + 3600;
		const options = createP2PKLock(VALID_PUBKEY, locktime);
		expect(options.pubkey).toBe(COMPRESSED_PUBKEY);
		expect(options.locktime).toBe(locktime);
	});

	it('normalizes refund keys to compressed format', () => {
		const refundKeys = [OTHER_PUBKEY];
		const options = createP2PKLock(VALID_PUBKEY, undefined, refundKeys);
		expect(options.pubkey).toBe(COMPRESSED_PUBKEY);
		expect(options.refundKeys).toEqual([COMPRESSED_OTHER]);
		expect(options.locktime).toBeUndefined();
	});

	it('creates lock with locktime and refund keys', () => {
		const locktime = Math.floor(Date.now() / 1000) + 7200;
		const refundKeys = [OTHER_PUBKEY];
		const options = createP2PKLock(VALID_PUBKEY, locktime, refundKeys);
		expect(options.pubkey).toBe(COMPRESSED_PUBKEY);
		expect(options.locktime).toBe(locktime);
		expect(options.refundKeys).toEqual([COMPRESSED_OTHER]);
	});

	it('ignores empty refund keys array', () => {
		const options = createP2PKLock(VALID_PUBKEY, undefined, []);
		expect(options.refundKeys).toBeUndefined();
	});
});

// ── createP2PKLockFromParams ────────────────────────────────────────────────

describe('createP2PKLockFromParams', () => {
	it('converts P2PKLockParams to P2PKOptions with compressed keys', () => {
		const params: P2PKLockParams = {
			pubkeyHex: VALID_PUBKEY,
			refundLocktimeUnix: 1800000000,
			refundKeys: [OTHER_PUBKEY]
		};
		const options = createP2PKLockFromParams(params);
		expect(options.pubkey).toBe(COMPRESSED_PUBKEY);
		expect(options.locktime).toBe(1800000000);
		expect(options.refundKeys).toEqual([COMPRESSED_OTHER]);
	});

	it('handles params with no optional fields', () => {
		const params: P2PKLockParams = {
			pubkeyHex: VALID_PUBKEY
		};
		const options = createP2PKLockFromParams(params);
		expect(options.pubkey).toBe(COMPRESSED_PUBKEY);
		expect(options.locktime).toBeUndefined();
		expect(options.refundKeys).toBeUndefined();
	});
});

// ── lockProofsToKey ─────────────────────────────────────────────────────────

describe('lockProofsToKey', () => {
	it('locks proofs to a pubkey successfully', async () => {
		const proofs = [mockProof(100), mockProof(50)];
		const wallet = mockWallet();

		const result = await lockProofsToKey(proofs, VALID_PUBKEY, wallet);

		expect(result.success).toBe(true);
		expect(result.sendProofs.length).toBeGreaterThan(0);
		expect(result.fees).toBe(0);
		expect(result.error).toBeUndefined();
		expect(wallet.send).toHaveBeenCalledOnce();
	});

	it('passes P2PK options with compressed pubkey to wallet.send', async () => {
		const proofs = [mockProof(200)];
		const sendMock = vi.fn(async () => ({
			keep: [],
			send: [mockProof(200)]
		}));
		const wallet = mockWallet({ send: sendMock } as unknown as Partial<Wallet>);

		await lockProofsToKey(proofs, VALID_PUBKEY, wallet);

		expect(sendMock).toHaveBeenCalledWith(200, proofs, undefined, {
			send: {
				type: 'p2pk',
				options: expect.objectContaining({ pubkey: COMPRESSED_PUBKEY })
			}
		});
	});

	it('includes locktime in P2PK options when provided', async () => {
		const proofs = [mockProof(100)];
		const sendMock = vi.fn(async () => ({
			keep: [],
			send: [mockProof(100)]
		}));
		const wallet = mockWallet({ send: sendMock } as unknown as Partial<Wallet>);
		const locktime = 1800000000;

		await lockProofsToKey(proofs, VALID_PUBKEY, wallet, locktime);

		expect(sendMock).toHaveBeenCalledWith(100, proofs, undefined, {
			send: {
				type: 'p2pk',
				options: expect.objectContaining({
					pubkey: COMPRESSED_PUBKEY,
					locktime
				})
			}
		});
	});

	it('returns failure for empty proofs array', async () => {
		const wallet = mockWallet();
		const result = await lockProofsToKey([], VALID_PUBKEY, wallet);

		expect(result.success).toBe(false);
		expect(result.error).toContain('zero amount');
		expect(result.sendProofs).toEqual([]);
		expect(wallet.send).not.toHaveBeenCalled();
	});

	it('returns failure when total amount is zero', async () => {
		const proofs = [mockProof(0), mockProof(0)];
		const wallet = mockWallet();

		const result = await lockProofsToKey(proofs, VALID_PUBKEY, wallet);

		expect(result.success).toBe(false);
		expect(result.error).toContain('zero amount');
	});

	it('returns failure when fees exceed amount', async () => {
		const proofs = [mockProof(5)];
		const wallet = mockWallet({
			getFeesForProofs: vi.fn(() => 10)
		} as unknown as Partial<Wallet>);

		const result = await lockProofsToKey(proofs, VALID_PUBKEY, wallet);

		expect(result.success).toBe(false);
		expect(result.error).toContain('Insufficient amount after fees');
		expect(result.fees).toBe(10);
	});

	it('accounts for fees in send amount', async () => {
		const proofs = [mockProof(100)];
		const sendMock = vi.fn(async () => ({
			keep: [],
			send: [mockProof(98)]
		}));
		const wallet = mockWallet({
			getFeesForProofs: vi.fn(() => 2),
			send: sendMock
		} as unknown as Partial<Wallet>);

		const result = await lockProofsToKey(proofs, VALID_PUBKEY, wallet);

		expect(result.success).toBe(true);
		expect(result.fees).toBe(2);
		// Should send amount minus fees
		expect(sendMock).toHaveBeenCalledWith(98, proofs, undefined, expect.any(Object));
	});

	it('detects double-spend errors from the mint', async () => {
		const proofs = [mockProof(100)];
		const wallet = mockWallet({
			send: vi.fn(async () => {
				throw new Error('Token already spent');
			})
		} as unknown as Partial<Wallet>);

		const result = await lockProofsToKey(proofs, VALID_PUBKEY, wallet);

		expect(result.success).toBe(false);
		expect(result.error).toContain('double-spend');
	});

	it('handles generic wallet errors gracefully', async () => {
		const proofs = [mockProof(100)];
		const wallet = mockWallet({
			send: vi.fn(async () => {
				throw new Error('Network timeout');
			})
		} as unknown as Partial<Wallet>);

		const result = await lockProofsToKey(proofs, VALID_PUBKEY, wallet);

		expect(result.success).toBe(false);
		expect(result.error).toContain('P2PK lock failed');
		expect(result.error).toContain('Network timeout');
	});

	it('returns keep proofs from wallet change', async () => {
		const proofs = [mockProof(100)];
		const changeProof = mockProof(10, 'change-id');
		const wallet = mockWallet({
			send: vi.fn(async () => ({
				keep: [changeProof],
				send: [mockProof(90)]
			}))
		} as unknown as Partial<Wallet>);

		const result = await lockProofsToKey(proofs, VALID_PUBKEY, wallet);

		expect(result.success).toBe(true);
		expect(result.keepProofs).toEqual([changeProof]);
	});
});
