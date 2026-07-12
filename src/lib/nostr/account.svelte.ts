import { nip19 } from 'nostr-tools';
import {
	SESSION_STORAGE_KEY,
	SIGNER_TIMEOUT_MS,
	BUNKER_CONNECT_TIMEOUT_MS
} from '$lib/utils/constants';
import { NostrConnectSigner } from 'applesauce-signers';
import {
	signerState,
	resetEventFactory,
	setBunkerSigner,
	clearBunkerSigner,
	getBunkerSigner
} from './signer.svelte';
import { pool } from './relay-pool';

export type LoginMethod = 'nip07' | 'bunker';

export type LoginError = {
	type: 'no-extension' | 'rejected' | 'timeout' | 'unknown' | 'bunker-error' | 'mismatch';
	message: string;
};

/**
 * Reactive account state store using Svelte 5 runes.
 * Tracks current user's public key and derived properties.
 */
export class AccountState {
	/** Active signer-verified public key. */
	pubkey = $state<string | null>(null);
	/** Last explicitly authenticated account restored for display/reconnect only. */
	rememberedPubkey = $state<string | null>(null);

	/** Whether a login operation is in progress */
	loading = $state(false);

	/** Last login error, if any */
	error = $state<LoginError | null>(null);

	/** How the user logged in (not persisted) */
	loginMethod = $state<LoginMethod | null>(null);

	/** Whether a bunker connection is being established */
	bunkerConnecting = $state(false);

	/** NIP-19 encoded npub derived from the hex pubkey */
	get npub(): string | null {
		if (!this.pubkey) return null;
		return nip19.npubEncode(this.pubkey);
	}

	/** Authentication requires an active account matching a ready signer. */
	get isAuthenticated(): boolean {
		return (
			this.pubkey !== null && signerState.ready && signerState.pubkey === this.pubkey.toLowerCase()
		);
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
				this.rememberedPubkey = stored.toLowerCase();
			}
		} catch {
			// localStorage may be unavailable
		}
	}

	/** Persist session to localStorage */
	private persistSession(): void {
		try {
			if (this.rememberedPubkey) {
				localStorage.setItem(SESSION_STORAGE_KEY, this.rememberedPubkey);
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
			await clearBunkerSigner(true);
			resetEventFactory();
			signerState.clearReady();
			this.pubkey = null;
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

			const normalized = pubkey.toLowerCase();
			this.pubkey = normalized;
			this.rememberedPubkey = normalized;
			this.loginMethod = 'nip07';
			signerState.setReady(normalized, 'nip07');
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

	/**
	 * Login via NIP-46 bunker (remote signer).
	 * Parses a bunker:// URI, establishes connection, and retrieves the user's pubkey.
	 * The bunker URI is used only to establish the current in-memory session.
	 */
	async loginWithBunker(bunkerUri: string): Promise<void> {
		this.error = null;
		this.bunkerConnecting = true;
		this.loading = true;
		signerState.clearReady();
		this.pubkey = null;

		try {
			// Check if we already have an active bunker connection (e.g., after logout + re-login)
			const existingSigner = getBunkerSigner();
			if (existingSigner?.isConnected) {
				try {
					const pubkey = await existingSigner.getPublicKey();
					if (typeof pubkey === 'string' && /^[0-9a-f]{64}$/i.test(pubkey)) {
						setBunkerSigner(existingSigner);
						resetEventFactory();
						const normalized = pubkey.toLowerCase();
						this.pubkey = normalized;
						this.rememberedPubkey = normalized;
						this.loginMethod = 'bunker';
						signerState.setReady(normalized, 'bunker');
						this.persistSession();
						return;
					}
				} catch {
					// Existing connection stale — fall through to new connection
				}
			}

			if (!bunkerUri.startsWith('bunker://')) {
				this.error = {
					type: 'bunker-error',
					message: 'Invalid URI. Must start with bunker://'
				};
				return;
			}

			// Clear any stale bunker signer before creating new one
			await clearBunkerSigner(true);

			// Set static pool so NostrConnectSigner can communicate over relays
			NostrConnectSigner.pool = pool;

			const signer = await NostrConnectSigner.fromBunkerURI(bunkerUri, {
				permissions: NostrConnectSigner.buildSigningPermissions([
					37300, 73001, 73002, 1018, 73004, 73005, 73006
				])
			});

			await signer.open();

			// Extract secret from URI for connect call
			const parsed = NostrConnectSigner.parseBunkerURI(bunkerUri);
			await Promise.race([
				signer.connect(parsed.secret),
				new Promise<never>((_, reject) =>
					setTimeout(() => reject(new Error('timeout')), BUNKER_CONNECT_TIMEOUT_MS)
				)
			]);

			const pubkey = await signer.getPublicKey();

			if (typeof pubkey !== 'string' || !/^[0-9a-f]{64}$/i.test(pubkey)) {
				await signer.close();
				this.error = {
					type: 'bunker-error',
					message: 'Remote signer returned an invalid public key.'
				};
				return;
			}

			// Store signer for EventFactory
			setBunkerSigner(signer);
			resetEventFactory();

			const normalized = pubkey.toLowerCase();
			this.pubkey = normalized;
			this.rememberedPubkey = normalized;
			this.loginMethod = 'bunker';
			signerState.setReady(normalized, 'bunker');
			this.persistSession();
		} catch (err) {
			if (err instanceof Error && err.message === 'timeout') {
				this.error = {
					type: 'timeout',
					message: 'Bunker connection timed out. Please check the URI and try again.'
				};
			} else {
				this.error = {
					type: 'bunker-error',
					message:
						err instanceof Error
							? err.message
							: 'Failed to connect to bunker. Please check the URI and try again.'
				};
			}
		} finally {
			this.bunkerConnecting = false;
			this.loading = false;
		}
	}

	/**
	 * Logout — clear pubkey and session data.
	 * Bunker connection is kept alive so the user can re-login without a new URI.
	 * Use disconnectBunker() to fully close the bunker connection.
	 */
	async logout(): Promise<void> {
		this.pubkey = null;
		signerState.clearReady();
		this.error = null;
		const wasBunker = this.loginMethod === 'bunker';
		this.loginMethod = null;
		if (!wasBunker) {
			// Only close bunker connection if we weren't using bunker login
			// (i.e., switching from NIP-07). Keep bunker alive for re-login.
			await clearBunkerSigner(true);
		}
		resetEventFactory();
	}

	/**
	 * Reconnect using an existing bunker signer (after logout without page refresh).
	 * Does NOT call connect() — the connection is already established.
	 */
	async reconnectBunker(): Promise<void> {
		this.error = null;
		this.loading = true;
		this.bunkerConnecting = true;

		try {
			const signer = getBunkerSigner();
			if (!signer || !signer.isConnected) {
				this.error = {
					type: 'bunker-error',
					message: 'No active bunker connection. Please enter a new bunker:// URI.'
				};
				return;
			}

			const pubkey = await Promise.race([
				signer.getPublicKey(),
				new Promise<never>((_, reject) =>
					setTimeout(() => reject(new Error('timeout')), BUNKER_CONNECT_TIMEOUT_MS)
				)
			]);

			if (typeof pubkey !== 'string' || !/^[0-9a-f]{64}$/i.test(pubkey)) {
				this.error = {
					type: 'bunker-error',
					message: 'Remote signer returned an invalid public key.'
				};
				return;
			}
			const normalized = pubkey.toLowerCase();
			if (this.rememberedPubkey && normalized !== this.rememberedPubkey) {
				this.error = {
					type: 'mismatch',
					message: 'The connected signer does not control the remembered account.'
				};
				return;
			}

			setBunkerSigner(signer);
			resetEventFactory();
			this.pubkey = normalized;
			this.rememberedPubkey = normalized;
			this.loginMethod = 'bunker';
			signerState.setReady(normalized, 'bunker');
			this.persistSession();
		} catch {
			this.error = {
				type: 'bunker-error',
				message: 'Bunker connection is no longer active. Please enter a new bunker:// URI.'
			};
		} finally {
			this.bunkerConnecting = false;
			this.loading = false;
		}
	}

	/**
	 * Fully disconnect from bunker and clear all state.
	 * Use this when the user wants to switch to a different signer.
	 */
	async disconnectBunker(): Promise<void> {
		await clearBunkerSigner(true);
		this.pubkey = null;
		this.rememberedPubkey = null;
		signerState.clearReady();
		this.loginMethod = null;
		resetEventFactory();
		this.persistSession();
	}
}

export const accountState = new AccountState();
