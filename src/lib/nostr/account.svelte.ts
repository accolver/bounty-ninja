// SECURITY: This file handles private key material. Never persist or log nsec values.
import { nip19, getPublicKey } from 'nostr-tools';
import {
	SESSION_STORAGE_KEY,
	SIGNER_TIMEOUT_MS,
	BUNKER_STORAGE_KEY,
	BUNKER_CONNECT_TIMEOUT_MS
} from '$lib/utils/constants';
import { NostrConnectSigner, PrivateKeySigner } from 'applesauce-signers';
import {
	signerState,
	resetEventFactory,
	setNsecSigner,
	clearNsecSigner,
	setBunkerSigner,
	clearBunkerSigner,
	getBunkerSigner
} from './signer.svelte';
import { pool } from './relay-pool';

export type LoginMethod = 'nip07' | 'nsec' | 'bunker';

export type LoginError = {
	type: 'no-extension' | 'rejected' | 'timeout' | 'unknown' | 'invalid-nsec' | 'bunker-error';
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

	/** How the user logged in (not persisted) */
	loginMethod = $state<LoginMethod | null>(null);

	/** Whether a bunker connection is being established */
	bunkerConnecting = $state(false);

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

				// Check if this was a bunker session and auto-reconnect
				const bunkerInfo = localStorage.getItem(BUNKER_STORAGE_KEY);
				if (bunkerInfo) {
					this.restoreBunkerSession(bunkerInfo);
				}
			}
		} catch {
			// localStorage may be unavailable
		}
	}

	/**
	 * Restore a bunker session from persisted connection info.
	 * Reconstructs the NostrConnectSigner using the saved client keypair
	 * and reconnects to the remote signer without needing a new bunker:// URI.
	 */
	private restoreBunkerSession(bunkerInfoJson: string): void {
		try {
			const info = JSON.parse(bunkerInfoJson);
			if (!info.clientKeyHex || !info.remotePubkey || !info.relays?.length) return;

			// Reconstruct client keypair from persisted hex
			const keyBytes = new Uint8Array(
				info.clientKeyHex.match(/.{2}/g)!.map((h: string) => parseInt(h, 16))
			);
			const clientSigner = new PrivateKeySigner(keyBytes);

			NostrConnectSigner.pool = pool;

			const signer = new NostrConnectSigner({
				relays: info.relays,
				signer: clientSigner,
				remote: info.remotePubkey,
				pubkey: this.pubkey ?? undefined
			});

			// Open connection asynchronously — don't block session restore
			signer
				.open()
				.then(async () => {
					// Ping to verify the connection is still alive
					try {
						await Promise.race([
							signer.ping(),
							new Promise<never>((_, reject) =>
								setTimeout(() => reject(new Error('timeout')), 5000)
							)
						]);
						setBunkerSigner(signer);
						resetEventFactory();
						this.loginMethod = 'bunker';
					} catch {
						// Remote signer not responding — user will need to re-login
						console.warn('[account] Bunker session restore failed — signer not responding');
						this.clearBunkerInfo();
					}
				})
				.catch(() => {
					console.warn('[account] Bunker session restore failed — could not open connection');
					this.clearBunkerInfo();
				});
		} catch {
			// Invalid stored data — clear it
			this.clearBunkerInfo();
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
			this.loginMethod = 'nip07';
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
	 * Login via nsec (private key).
	 * SECURITY: The nsec is used to derive the pubkey and configure the signer,
	 * then never stored persistently.
	 */
	loginWithNsec(nsec: string): void {
		this.error = null;

		try {
			if (!nsec.startsWith('nsec1')) {
				this.error = {
					type: 'invalid-nsec',
					message: 'Invalid key format. Must start with nsec1.'
				};
				return;
			}

			const decoded = nip19.decode(nsec);
			if (decoded.type !== 'nsec') {
				this.error = {
					type: 'invalid-nsec',
					message: 'Invalid nsec key.'
				};
				return;
			}

			const secretKey = decoded.data as Uint8Array;
			if (secretKey.length !== 32) {
				this.error = {
					type: 'invalid-nsec',
					message: 'Invalid key: must be 32 bytes.'
				};
				return;
			}

			const pubkey = getPublicKey(secretKey);
			setNsecSigner(nsec);
			resetEventFactory();

			this.pubkey = pubkey;
			this.loginMethod = 'nsec';
			this.persistSession();
		} catch {
			this.error = {
				type: 'invalid-nsec',
				message: 'Invalid nsec key. Please check and try again.'
			};
		}
	}

	/**
	 * Login via NIP-46 bunker (remote signer).
	 * Parses a bunker:// URI, establishes connection, and retrieves the user's pubkey.
	 * SECURITY: The bunker secret is never persisted — only remote pubkey + relays are stored.
	 */
	async loginWithBunker(bunkerUri: string): Promise<void> {
		this.error = null;
		this.bunkerConnecting = true;
		this.loading = true;

		try {
			// Check if we already have an active bunker connection (e.g., after logout + re-login)
			const existingSigner = getBunkerSigner();
			if (existingSigner?.isConnected) {
				try {
					const pubkey = await existingSigner.getPublicKey();
					if (typeof pubkey === 'string' && /^[0-9a-f]{64}$/i.test(pubkey)) {
						setBunkerSigner(existingSigner);
						resetEventFactory();
						this.pubkey = pubkey;
						this.loginMethod = 'bunker';
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
					37300, 7301, 7302, 1018, 7304, 7305, 7306
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

			this.pubkey = pubkey;
			this.loginMethod = 'bunker';
			this.persistSession();

			// Persist connection info for session restoration across page reloads
			// Client key is a disposable comm keypair, NOT the user's identity key
			const clientKeyHex = Array.from(signer.signer.key)
				.map((b: number) => b.toString(16).padStart(2, '0'))
				.join('');
			this.persistBunkerInfo(parsed.remote, signer.relays, clientKeyHex);
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
	 * Persist bunker connection info for session restoration across page reloads.
	 * Stores the client keypair (hex) so we can reconstruct the NostrConnectSigner
	 * without needing a new bunker:// URI (the secret is one-time use).
	 *
	 * SECURITY: The client keypair is a disposable keypair generated per connection.
	 * It is NOT the user's identity key — it's only used for NIP-44 encrypted
	 * communication with the remote signer. Stored in localStorage for session
	 * persistence; cleared on explicit disconnect.
	 */
	private persistBunkerInfo(remotePubkey: string, relays: string[], clientKeyHex: string): void {
		try {
			localStorage.setItem(
				BUNKER_STORAGE_KEY,
				JSON.stringify({ remotePubkey, relays, clientKeyHex })
			);
		} catch {
			// localStorage may be unavailable
		}
	}

	/** Clear persisted bunker connection info */
	private clearBunkerInfo(): void {
		try {
			localStorage.removeItem(BUNKER_STORAGE_KEY);
		} catch {
			// localStorage may be unavailable
		}
	}

	/**
	 * Logout — clear pubkey and session data.
	 * Bunker connection is kept alive so the user can re-login without a new URI.
	 * Use disconnectBunker() to fully close the bunker connection.
	 */
	async logout(): Promise<void> {
		this.pubkey = null;
		this.error = null;
		const wasBunker = this.loginMethod === 'bunker';
		this.loginMethod = null;
		clearNsecSigner();
		if (!wasBunker) {
			// Only close bunker connection if we weren't using bunker login
			// (i.e., switching from NIP-07/nsec). Keep bunker alive for re-login.
			await clearBunkerSigner(true);
			this.clearBunkerInfo();
		}
		resetEventFactory();
		this.persistSession();
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

			setBunkerSigner(signer);
			resetEventFactory();
			this.pubkey = pubkey;
			this.loginMethod = 'bunker';
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
		this.clearBunkerInfo();
		if (this.loginMethod === 'bunker') {
			this.pubkey = null;
			this.loginMethod = null;
			resetEventFactory();
			this.persistSession();
		}
	}
}

export const accountState = new AccountState();
