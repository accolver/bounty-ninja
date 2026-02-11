/**
 * Format a number of satoshis with locale-aware separators.
 * Example: 50000 → "50,000 sats"
 */
export function formatSats(sats: number): string {
	return `${sats.toLocaleString()} sats`;
}

/**
 * Format a Unix timestamp to a human-readable date string.
 * Example: 1707609600 → "Feb 11, 2024"
 */
export function formatDate(timestamp: number): string {
	const date = new Date(timestamp * 1000);
	return date.toLocaleDateString('en-US', {
		year: 'numeric',
		month: 'short',
		day: 'numeric'
	});
}

/**
 * Format a Unix timestamp to a relative time string.
 * Example: (recent) → "2 hours ago"
 */
export function formatRelativeTime(timestamp: number): string {
	const now = Math.floor(Date.now() / 1000);
	const diff = now - timestamp;

	if (diff < 60) return 'just now';
	if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
	if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
	if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;

	return formatDate(timestamp);
}

/**
 * Truncate an npub for display.
 * Example: "npub1abcdefghijklmnop..." → "npub1abc...mnop"
 */
export function formatNpub(npub: string): string {
	if (npub.length <= 16) return npub;
	return `${npub.slice(0, 8)}...${npub.slice(-4)}`;
}

/**
 * Truncate a hex string for display.
 * Example: "abcdef0123456789..." → "abcdef01...6789"
 */
export function formatHex(hex: string, prefixLen = 8, suffixLen = 4): string {
	if (hex.length <= prefixLen + suffixLen) return hex;
	return `${hex.slice(0, prefixLen)}...${hex.slice(-suffixLen)}`;
}
