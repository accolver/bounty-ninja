import { batchLoadProfiles, loadProfile } from '$lib/nostr/profile-cache';

/**
 * Create a loader that loads profile metadata events (Kind 0) for specific pubkeys.
 * Uses the profile cache for deduplication, batching, and stale-while-revalidate.
 *
 * Cache-first: returns cached profiles instantly, revalidates stale ones in background.
 * Batch: groups multiple pubkeys into a single REQ filter.
 */
export function createProfileLoader(pubkeys: string[]): { unsubscribe(): void } {
	if (pubkeys.length === 0) {
		return { unsubscribe() {} };
	}

	// Kick off async IDB loads for any profiles not in memory
	for (const pk of pubkeys) {
		void loadProfile(pk);
	}

	// Batch relay load for profiles that need revalidation or are missing
	return batchLoadProfiles(pubkeys);
}
