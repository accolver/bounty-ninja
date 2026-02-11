import { env } from '$env/dynamic/public';

/** Returns comma-separated default relay WebSocket URLs */
export function getDefaultRelays(): string[] {
	const raw =
		env.PUBLIC_DEFAULT_RELAYS ??
		'wss://relay.damus.io,wss://nos.lol,wss://relay.primal.net,wss://relay.snort.social,wss://relay.nostr.net,wss://offchain.pub';
	return raw
		.split(',')
		.map((url) => url.trim())
		.filter(Boolean);
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
	return env.PUBLIC_SEARCH_RELAY ?? 'wss://relay.nostr.band';
}
