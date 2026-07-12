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
		if (parsed.username || parsed.password) {
			return { valid: false, error: 'Credentials are not allowed' };
		}
		if (parsed.search || parsed.hash) {
			return { valid: false, error: 'Query strings and fragments are not allowed' };
		}
		return { valid: true };
	} catch {
		return { valid: false, error: 'Invalid URL format' };
	}
}
