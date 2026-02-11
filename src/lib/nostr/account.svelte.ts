import { nip19 } from 'nostr-tools';
import { SESSION_STORAGE_KEY, SIGNER_TIMEOUT_MS } from '$lib/utils/constants';
import { signerState } from './signer.svelte';

export type LoginError = {
	type: 'no-extension' | 'rejected' | 'timeout' | 'unknown';
	message: string;
};

/**
 * Reactive account state store using Svelte 5 runes.
 * Tracks current user's public key and derived properties.
 */
class AccountState {
	/** Hex-encoded public key, or null if not logged in */
	pubkey = $state<string | null>(null);

	/** Whether a login operation is in progress */
	loading = $state(false);

	/** Last login error, if any */
	error = $state<LoginError | null>(null);

	/** NIP-19 encoded npub derived from the hex pubkey */
	get npub(): string | null {
		if (!this.pubkey) return null;
		return nip19.npubEncode(this.pubkey);
	}

	/** Whether the user is currently logged in */
	get isLoggedIn(): boolean {
		return this.pubkey !== null;
	}

	constructor() {
		if (typeof window !== 'undefined') {
			this.restoreSession();
		}
	}

	/** Restore session from localStorage */
	private restoreSession(): void {
		try {
			const stored = localStorage.getItem(SESSION_STORAGE_KEY);
			if (stored && /^[0-9a-f]{64}$/i.test(stored)) {
				this.pubkey = stored;
			}
		} catch {
			// localStorage may be unavailable
		}
	}

	/** Persist session to localStorage */
	private persistSession(): void {
		try {
			if (this.pubkey) {
				localStorage.setItem(SESSION_STORAGE_KEY, this.pubkey);
			} else {
				localStorage.removeItem(SESSION_STORAGE_KEY);
			}
		} catch {
			// localStorage may be unavailable
		}
	}

	/**
	 * Login via NIP-07 browser extension.
	 * Calls window.nostr.getPublicKey() with a timeout.
	 */
	async login(): Promise<void> {
		this.error = null;
		this.loading = true;

		try {
			if (!signerState.available && !window.nostr) {
				this.error = {
					type: 'no-extension',
					message: 'No Nostr signer extension detected. Please install nos2x or Alby.'
				};
				return;
			}

			const pubkey = await Promise.race([
				window.nostr!.getPublicKey(),
				new Promise<never>((_, reject) =>
					setTimeout(() => reject(new Error('timeout')), SIGNER_TIMEOUT_MS)
				)
			]);

			if (typeof pubkey !== 'string' || !/^[0-9a-f]{64}$/i.test(pubkey)) {
				this.error = {
					type: 'unknown',
					message: 'Received an invalid public key from the signer extension.'
				};
				return;
			}

			this.pubkey = pubkey;
			this.persistSession();
		} catch (err) {
			if (err instanceof Error && err.message === 'timeout') {
				this.error = {
					type: 'timeout',
					message: 'Signer timed out. Please try again.'
				};
			} else {
				this.error = {
					type: 'rejected',
					message: 'Login cancelled.'
				};
			}
		} finally {
			this.loading = false;
		}
	}

	/** Logout — clear pubkey and session data */
	logout(): void {
		this.pubkey = null;
		this.error = null;
		this.persistSession();
	}
}

export const accountState = new AccountState();
