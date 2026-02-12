/**
 * Validates a Nostr relay URL.
 *
 * Requirements:
 * - Must be a valid URL
 * - Must use the wss:// protocol (secure WebSocket)
 * - Must have a hostname of at least 3 characters
 */
export function isValidRelayUrl(url: string): { valid: boolean; error?: string } {
	try {
		const parsed = new URL(url);
		if (parsed.protocol !== 'wss:') {
			return { valid: false, error: 'Must use wss:// protocol' };
		}
		if (!parsed.hostname || parsed.hostname.length < 3) {
			return { valid: false, error: 'Invalid hostname' };
		}
		return { valid: true };
	} catch {
		return { valid: false, error: 'Invalid URL format' };
	}
}
