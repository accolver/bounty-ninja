import { env } from '$env/dynamic/public';
import { config, storageKey } from '$lib/config';

const SETTINGS_KEY = storageKey('settings');

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
	const raw = env.PUBLIC_DEFAULT_RELAYS ?? config.nostr.defaultRelays.join(',');
	const relays = raw
		.split(',')
		.map((url) => url.trim())
		.filter(Boolean);

	// Include local dev relay if configured (e.g., ws://localhost:10547)
	const local = env.PUBLIC_LOCAL_RELAY;
	if (
		local &&
		!relays.includes(local) &&
		!local.includes('localhost') &&
		!local.includes('127.0.0.1')
	) {
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
	return env.PUBLIC_DEFAULT_MINT ?? config.payments.defaultMint;
}

/** Returns the application display name */
export function getAppName(): string {
	return env.PUBLIC_APP_NAME ?? config.app.nameCaps;
}

/** Returns the application URL */
export function getAppUrl(): string {
	return env.PUBLIC_APP_URL ?? config.app.url;
}

/** Returns the minimum submission fee in sats */
export function getMinSubmissionFee(): number {
	return parseInt(env.PUBLIC_MIN_SUBMISSION_FEE ?? String(config.payments.minSubmissionFee), 10);
}

/** Returns the maximum submission fee in sats */
export function getMaxSubmissionFee(): number {
	return parseInt(env.PUBLIC_MAX_SUBMISSION_FEE ?? String(config.payments.maxSubmissionFee), 10);
}

/** Returns the vote quorum threshold as a fraction (0–1) */
export function getVoteQuorumFraction(): number {
	const percent = parseInt(
		env.PUBLIC_VOTE_QUORUM_PERCENT ?? String(config.payments.voteQuorumPercent),
		10
	);
	const clamped = Math.max(1, Math.min(100, Number.isNaN(percent) ? 66 : percent));
	return clamped / 100;
}

/** Returns the NIP-50 search relay URL */
export function getSearchRelay(): string {
	return env.PUBLIC_SEARCH_RELAY ?? config.nostr.searchRelay;
}
