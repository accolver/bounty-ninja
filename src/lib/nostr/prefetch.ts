import { loadCachedEvents } from './cache';
import { loadProfile, batchLoadProfiles } from './profile-cache';
import { BOUNTY_KIND, PLEDGE_KIND, SOLUTION_KIND } from '$lib/bounty/kinds';

type PrefetchType = 'bounty' | 'profile';

/** Track what's already been prefetched to avoid duplicates */
const prefetched = new Set<string>();

/**
 * Prefetch data for a likely navigation target.
 * Uses requestIdleCallback to avoid blocking interactions.
 *
 * @param type - 'bounty' or 'profile'
 * @param id - Bounty address (kind:pubkey:d-tag) or hex pubkey
 */
export function prefetch(type: PrefetchType, id: string): void {
	const key = `${type}:${id}`;
	if (prefetched.has(key)) return;
	prefetched.add(key);

	const callback = () => {
		switch (type) {
			case 'bounty':
				void prefetchBounty(id);
				break;
			case 'profile':
				void loadProfile(id);
				break;
		}
	};

	if (typeof requestIdleCallback === 'function') {
		requestIdleCallback(callback);
	} else {
		setTimeout(callback, 100);
	}
}

/**
 * Prefetch a bounty detail: load bounty event + related events from IndexedDB,
 * plus creator profile.
 */
async function prefetchBounty(bountyAddress: string): Promise<void> {
	const parts = bountyAddress.split(':');
	if (parts.length < 3) return;

	const [kindStr, pubkey, dTag] = parts;
	const kind = parseInt(kindStr, 10);

	// Load bounty event from IDB
	await loadCachedEvents([
		{ kinds: [kind], authors: [pubkey], '#d': [dTag] },
		{ kinds: [PLEDGE_KIND], '#a': [bountyAddress] },
		{ kinds: [SOLUTION_KIND], '#a': [bountyAddress] }
	]);

	// Prefetch creator profile
	void loadProfile(pubkey);
}

/**
 * Prefetch first N bounty details from the home page list.
 * Call on idle after home page renders.
 */
export function prefetchTopBounties(bountyAddresses: string[], count = 5): void {
	const toPrefetch = bountyAddresses.slice(0, count);
	for (const addr of toPrefetch) {
		prefetch('bounty', addr);
	}
}

/**
 * Prefetch profiles for a list of pubkeys.
 * Groups into a single batch request.
 */
export function prefetchProfiles(pubkeys: string[]): void {
	const needed = pubkeys.filter((pk) => !prefetched.has(`profile:${pk}`));
	if (needed.length === 0) return;

	for (const pk of needed) {
		prefetched.add(`profile:${pk}`);
	}

	const callback = () => {
		batchLoadProfiles(needed);
	};

	if (typeof requestIdleCallback === 'function') {
		requestIdleCallback(callback);
	} else {
		setTimeout(callback, 100);
	}
}

/**
 * Clear prefetch tracking (useful for testing).
 */
export function clearPrefetchState(): void {
	prefetched.clear();
}
