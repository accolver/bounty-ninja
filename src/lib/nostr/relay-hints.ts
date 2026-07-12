import { config } from '$lib/config';
import { isValidRelayUrl } from '$lib/utils/relay-validation';

function normalizeRelayUrl(value: string, allowLocalInsecure: boolean): string | null {
	try {
		const url = new URL(value);
		if (url.username || url.password || !url.hostname) return null;
		if (url.protocol !== 'wss:' && !(allowLocalInsecure && url.protocol === 'ws:')) return null;
		const path = url.pathname.replace(/\/+$/, '');
		return `${url.protocol}//${url.host}${path}${url.search}`;
	} catch {
		return null;
	}
}

/** Merge untrusted naddr hints after configured relays using strict connection bounds. */
export function mergeRelayHints(
	configured: readonly string[],
	hints: readonly string[],
	maxHints = config.nostr.maxRelayHints,
	maxConnections = config.nostr.maxRelayConnections
): string[] {
	const merged: string[] = [];
	const seen = new Set<string>();
	for (const relay of configured) {
		const normalized = normalizeRelayUrl(relay, true);
		if (!normalized || seen.has(normalized) || merged.length >= maxConnections) continue;
		seen.add(normalized);
		merged.push(normalized);
	}

	let acceptedHints = 0;
	for (const hint of hints) {
		if (acceptedHints >= maxHints || merged.length >= maxConnections) break;
		if (!isValidRelayUrl(hint).valid) continue;
		const normalized = normalizeRelayUrl(hint, false);
		if (!normalized || seen.has(normalized)) continue;
		seen.add(normalized);
		merged.push(normalized);
		acceptedHints++;
	}
	return merged;
}
