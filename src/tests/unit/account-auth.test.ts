import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/utils/env', () => ({ getVoteQuorumFraction: () => 0.66 }));
vi.mock('$lib/nostr/relay-pool', () => ({ pool: { relay: vi.fn() } }));

import { AccountState } from '$lib/nostr/account.svelte';
import { signerState } from '$lib/nostr/signer.svelte';
import { SESSION_STORAGE_KEY } from '$lib/utils/constants';

const PUBKEY = 'a'.repeat(64);

describe('account authentication state', () => {
	beforeEach(() => {
		localStorage.clear();
		signerState.clearReady();
		Object.defineProperty(window, 'nostr', {
			value: { getPublicKey: vi.fn().mockResolvedValue(PUBKEY), signEvent: vi.fn() },
			writable: true,
			configurable: true
		});
	});

	it('restores a remembered account without treating it as authenticated', () => {
		localStorage.setItem(SESSION_STORAGE_KEY, PUBKEY);
		const state = new AccountState();
		expect(state.rememberedPubkey).toBe(PUBKEY);
		expect(state.pubkey).toBeNull();
		expect(state.isAuthenticated).toBe(false);
	});

	it('authenticates only after querying a matching ready signer', async () => {
		const state = new AccountState();
		await state.login();
		expect(state.pubkey).toBe(PUBKEY);
		expect(state.rememberedPubkey).toBe(PUBKEY);
		expect(signerState.pubkey).toBe(PUBKEY);
		expect(state.isAuthenticated).toBe(true);
	});

	it('logout clears active authentication while retaining the remembered account', async () => {
		const state = new AccountState();
		await state.login();
		await state.logout();
		expect(state.pubkey).toBeNull();
		expect(state.rememberedPubkey).toBe(PUBKEY);
		expect(signerState.ready).toBe(false);
		expect(state.isAuthenticated).toBe(false);
	});

	it('detects signer readiness changes independently of remembered state', async () => {
		const state = new AccountState();
		await state.login();
		signerState.clearReady();
		expect(state.isAuthenticated).toBe(false);
	});
});
