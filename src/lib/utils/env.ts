import { env } from '$env/dynamic/public';

/**
 * Returns all relay WebSocket URLs the app should connect to.
 * Includes PUBLIC_DEFAULT_RELAYS + PUBLIC_LOCAL_RELAY (if configured).
 * The local relay is appended so seed data from `mise run seed` is visible.
 */
export function getDefaultRelays(): string[] {
	const raw =
		env.PUBLIC_DEFAULT_RELAYS ??
		'wss://relay.damus.io,wss://nos.lol,wss://relay.primal.net,wss://relay.snort.social,wss://relay.nostr.net,wss://offchain.pub';
	const relays = raw
		.split(',')
		.map((url) => url.trim())
		.filter(Boolean);

	// Include local dev relay if configured (e.g., ws://localhost:10547)
	const local = env.PUBLIC_LOCAL_RELAY;
	if (local && !relays.includes(local)) {
		relays.push(local);
	}

	return relays;
}

/** Returns the default Cashu mint URL */
export function getDefaultMint(): string {
	return env.PUBLIC_DEFAULT_MINT ?? 'https://mint.minibits.cash/Bitcoin';
}

/** Returns the application display name */
export function getAppName(): string {
	return env.PUBLIC_APP_NAME ?? 'Tasks.fyi';
}

/** Returns the application URL */
export function getAppUrl(): string {
	return env.PUBLIC_APP_URL ?? 'https://tasks.fyi';
}

/** Returns the minimum submission fee in sats */
export function getMinSubmissionFee(): number {
	return parseInt(env.PUBLIC_MIN_SUBMISSION_FEE ?? '10', 10);
}

/** Returns the maximum submission fee in sats */
export function getMaxSubmissionFee(): number {
	return parseInt(env.PUBLIC_MAX_SUBMISSION_FEE ?? '100', 10);
}

/** Returns the NIP-50 search relay URL */
export function getSearchRelay(): string {
	return env.PUBLIC_SEARCH_RELAY ?? 'wss://search.nos.today';
}
