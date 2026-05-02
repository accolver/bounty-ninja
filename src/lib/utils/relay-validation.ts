/**
 * Validates and normalizes Nostr relay URLs.
 *
 * Requirements:
 * - Must be a valid URL
 * - Must use wss:// in production-like contexts
 * - Must not target localhost/private-network hosts unless allowPrivate is true
 */

export interface RelayUrlValidationResult {
	valid: boolean;
	error?: string;
	normalized?: string;
}

const IPV4_RE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

function isPrivateHostname(hostname: string): boolean {
	const host = hostname.toLowerCase().replace(/^\[(.*)]$/, '$1');
	if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return true;
	if (host === '::1') return true;
	if (host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80:')) return true;

	const match = IPV4_RE.exec(host);
	if (!match) return false;
	const octets = match.slice(1).map((n) => Number(n));
	if (octets.some((n) => n < 0 || n > 255)) return true;
	const [a, b] = octets;
	return (
		a === 10 ||
		a === 127 ||
		(a === 172 && b >= 16 && b <= 31) ||
		(a === 192 && b === 168) ||
		(a === 169 && b === 254) ||
		a === 0
	);
}

export function normalizeRelayUrl(url: string): string {
	const parsed = new URL(url.trim());
	parsed.protocol = parsed.protocol.toLowerCase();
	parsed.hostname = parsed.hostname.toLowerCase();
	parsed.hash = '';
	parsed.search = '';
	if (parsed.pathname === '/') parsed.pathname = '';
	if (parsed.port === '443') parsed.port = '';
	return parsed.toString().replace(/\/$/, '');
}

export function isValidRelayUrl(
	url: string,
	options: { allowPrivate?: boolean; allowInsecureLocal?: boolean } = {}
): RelayUrlValidationResult {
	try {
		const parsed = new URL(url.trim());
		const isPrivate = isPrivateHostname(parsed.hostname);

		if (parsed.protocol !== 'wss:') {
			if (!(options.allowInsecureLocal && isPrivate && parsed.protocol === 'ws:')) {
				return { valid: false, error: 'Must use wss:// protocol' };
			}
		}
		if (!parsed.hostname || parsed.hostname.length < 3) {
			return { valid: false, error: 'Invalid hostname' };
		}
		if (isPrivate && !options.allowPrivate) {
			return { valid: false, error: 'Private-network relay URLs are not allowed' };
		}
		return { valid: true, normalized: normalizeRelayUrl(url) };
	} catch {
		return { valid: false, error: 'Invalid URL format' };
	}
}
