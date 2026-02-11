import type { Subscription } from 'rxjs';
import type { NostrEvent } from 'nostr-tools';
import { eventStore } from '$lib/nostr/event-store';
import { createProfileLoader } from '$lib/nostr/loaders/profile-loader';

/** Shape of the parsed Kind 0 profile metadata content */
interface ProfileContent {
	name?: string;
	display_name?: string;
	picture?: string;
	nip05?: string;
	about?: string;
}

/**
 * Reactive store for a single user's Kind 0 profile metadata.
 *
 * NOT a singleton — each profile view creates its own instance.
 * Subscribes to the Applesauce EventStore `replaceable(0, pubkey)` observable
 * and reactively updates Svelte 5 rune state when the profile event changes.
 *
 * @example
 * ```ts
 * const profile = new UserProfileStore();
 * profile.load(somePubkey);
 * // In template: {profile.displayName}
 * // On cleanup: profile.destroy();
 * ```
 */
export class UserProfileStore {
	#name = $state<string | null>(null);
	#displayName = $state<string | null>(null);
	#picture = $state<string | null>(null);
	#nip05 = $state<string | null>(null);
	#about = $state<string | null>(null);
	#pubkey = $state<string | null>(null);
	#loading = $state(false);
	#error = $state<string | null>(null);

	#profileSub: Subscription | null = null;
	#relayLoader: { unsubscribe(): void } | null = null;

	/** The user's preferred short name (e.g. "alice") */
	get name(): string | null {
		return this.#name;
	}

	/** The user's display name (e.g. "Alice in Wonderland") */
	get displayName(): string | null {
		return this.#displayName;
	}

	/** URL to the user's profile picture */
	get picture(): string | null {
		return this.#picture;
	}

	/** NIP-05 identifier (e.g. "alice@example.com") */
	get nip05(): string | null {
		return this.#nip05;
	}

	/** User's bio / about text */
	get about(): string | null {
		return this.#about;
	}

	/** The hex pubkey this store is loaded for */
	get pubkey(): string | null {
		return this.#pubkey;
	}

	/** Whether the profile is currently being loaded */
	get loading(): boolean {
		return this.#loading;
	}

	/** Error message if loading failed */
	get error(): string | null {
		return this.#error;
	}

	/**
	 * Best available display string: displayName, then name, then truncated pubkey.
	 * Useful for UI rendering where you always need something to show.
	 */
	get displayNameOrFallback(): string {
		if (this.#displayName) return this.#displayName;
		if (this.#name) return this.#name;
		if (this.#pubkey) return this.#pubkey.slice(0, 8) + '...';
		return 'Unknown';
	}

	/**
	 * Load profile metadata for a given pubkey.
	 * Cleans up any previous subscriptions first.
	 *
	 * @param pubkey - Hex-encoded Nostr public key
	 */
	load(pubkey: string): void {
		this.destroy();

		this.#pubkey = pubkey;
		this.#loading = true;
		this.#error = null;

		// Subscribe to EventStore for the replaceable Kind 0 event
		this.#profileSub = eventStore.replaceable(0, pubkey).subscribe({
			next: (event: NostrEvent | undefined) => {
				if (event) {
					this.#parseProfileContent(event.content);
				}
				// No event yet — properties stay null (except pubkey), which is fine
				this.#loading = false;
			},
			error: (err: unknown) => {
				this.#error = err instanceof Error ? err.message : 'Failed to load profile';
				this.#loading = false;
			}
		});

		// Start relay loader to fetch Kind 0 from relays into EventStore
		this.#relayLoader = createProfileLoader([pubkey]);
	}

	/**
	 * Parse the JSON content of a Kind 0 event and update state.
	 * Handles malformed JSON gracefully — properties remain null on parse failure.
	 */
	#parseProfileContent(content: string): void {
		try {
			const parsed: ProfileContent = JSON.parse(content);

			this.#name = parsed.name ?? null;
			this.#displayName = parsed.display_name ?? null;
			this.#picture = parsed.picture ?? null;
			this.#nip05 = parsed.nip05 ?? null;
			this.#about = parsed.about ?? null;
		} catch {
			// Malformed JSON — reset profile fields but don't throw.
			// pubkey remains set so the UI can still show a fallback.
			this.#name = null;
			this.#displayName = null;
			this.#picture = null;
			this.#nip05 = null;
			this.#about = null;
			this.#error = 'Invalid profile metadata: malformed JSON';
		}
	}

	/** Clean up all subscriptions. Safe to call multiple times. */
	destroy(): void {
		this.#profileSub?.unsubscribe();
		this.#profileSub = null;
		this.#relayLoader?.unsubscribe();
		this.#relayLoader = null;
	}
}
