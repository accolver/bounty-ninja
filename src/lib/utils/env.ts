import { env } from '$env/dynamic/public';

const SETTINGS_KEY = 'bounty.ninja:settings';

/**
 * Returns all relay WebSocket URLs the app should connect to.
 * Checks localStorage first (user may have customized via Settings page),
 * then falls back to PUBLIC_DEFAULT_RELAYS env var.
 */
export function getDefaultRelays(): string[] {
	// Check user-saved settings first
	try {
		if (typeof localStorage !== 'undefined') {
			const raw = localStorage.getItem(SETTINGS_KEY);
			if (raw) {
				const parsed = JSON.parse(raw);
				if (Array.isArray(parsed.relays) && parsed.relays.length > 0) {
					return parsed.relays;
				}
			}
		}
	} catch {
		/* ignore */
	}

	// Fall back to env defaults
	const raw =
		env.PUBLIC_DEFAULT_RELAYS ??
		'wss://relay.damus.io,wss://nos.lol,wss://relay.primal.net,wss://relay.snort.social,wss://nostr.wine,wss://relay.nostr.net,wss://nostr-pub.wellorder.net,wss://eden.nostr.land';
	const relays = raw
		.split(',')
		.map((url) => url.trim())
		.filter(Boolean);

	// Include local dev relay if configured (e.g., ws://localhost:10547)
	const local = env.PUBLIC_LOCAL_RELAY;
	if (local && !relays.includes(local) && !local.includes('localhost') && !local.includes('127.0.0.1')) {
		relays.push(local);
	} else if (local && (local.includes('localhost') || local.includes('127.0.0.1'))) {
		if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
			relays.push(local);
		}
	}

	return relays;
}

/** Returns the default Cashu mint URL */
export function getDefaultMint(): string {
	return env.PUBLIC_DEFAULT_MINT ?? 'https://mint.minibits.cash/Bitcoin';
}

/** Returns the application display name */
export function getAppName(): string {
	return env.PUBLIC_APP_NAME ?? 'Bounty.ninja';
}

/** Returns the application URL */
export function getAppUrl(): string {
	return env.PUBLIC_APP_URL ?? 'https://bounty.ninja';
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
