import type { ErrorEntry, ErrorEntryType } from '$lib/stores/error-monitor.svelte';

const HEX_IDENTIFIER_RE = /\b[0-9a-f]{64}\b/gi;
const NOSTR_IDENTIFIER_RE =
	/\b(?:nsec|npub|note|nevent|nprofile|naddr)1[023456789acdefghjklmnpqrstuvwxyz]+\b/gi;
const CASHU_TOKEN_RE = /\bcashu[AB][0-9A-Za-z_-]+/g;
const URL_RE = /\b(?:https?|wss?):\/\/[^\s<>'"`]+/gi;

export type RouteCategory =
	| 'home'
	| 'bounty'
	| 'profile'
	| 'search'
	| 'settings'
	| 'about'
	| 'other';
export type BrowserFamily = 'chromium' | 'firefox' | 'webkit' | 'unknown';
export type FailureClass =
	| 'network'
	| 'timeout'
	| 'authorization'
	| 'validation'
	| 'storage'
	| 'unknown';

export interface DiagnosticExport {
	schemaVersion: 1;
	generatedAt: string;
	releaseId: string;
	routeCategory: RouteCategory;
	browserFamily: BrowserFamily;
	errorCounts: Record<ErrorEntryType, number>;
	errors: Array<{ timestamp: number; type: ErrorEntryType; failureClass: FailureClass }>;
}

export function sanitizeDiagnosticText(value: string): string {
	return value
		.replace(URL_RE, '[url-redacted]')
		.replace(CASHU_TOKEN_RE, '[cashu-redacted]')
		.replace(NOSTR_IDENTIFIER_RE, '[nostr-redacted]')
		.replace(HEX_IDENTIFIER_RE, '[identifier-redacted]');
}

export function routeCategory(pathname: string): RouteCategory {
	if (pathname === '/') return 'home';
	if (pathname.startsWith('/bounty/')) return 'bounty';
	if (pathname.startsWith('/profile/')) return 'profile';
	if (pathname.startsWith('/search')) return 'search';
	if (pathname.startsWith('/settings')) return 'settings';
	if (pathname.startsWith('/about')) return 'about';
	return 'other';
}

export function browserFamily(userAgent: string): BrowserFamily {
	if (/firefox/i.test(userAgent)) return 'firefox';
	if (/applewebkit/i.test(userAgent) && !/(?:chrome|chromium|crios|edg)/i.test(userAgent)) {
		return 'webkit';
	}
	if (/(?:chrome|chromium|crios|edg)/i.test(userAgent)) return 'chromium';
	return 'unknown';
}

export function classifyFailure(message: string): FailureClass {
	if (/timeout|timed out/i.test(message)) return 'timeout';
	if (/network|offline|connection|fetch|relay|mint unavailable/i.test(message)) return 'network';
	if (/unauthori[sz]ed|forbidden|rejected|permission|signer/i.test(message)) return 'authorization';
	if (/invalid|malformed|validation|mismatch/i.test(message)) return 'validation';
	if (/storage|indexeddb|quota|database/i.test(message)) return 'storage';
	return 'unknown';
}

export function createDiagnosticExport(
	entries: readonly ErrorEntry[],
	context: { releaseId: string; pathname: string; userAgent: string; now?: Date }
): DiagnosticExport {
	const errorCounts: Record<ErrorEntryType, number> = {
		error: 0,
		'unhandled-rejection': 0,
		boundary: 0
	};
	for (const entry of entries) errorCounts[entry.type]++;
	return {
		schemaVersion: 1,
		generatedAt: (context.now ?? new Date()).toISOString(),
		releaseId: /^[0-9a-f]{40}$/.test(context.releaseId) ? context.releaseId : 'development',
		routeCategory: routeCategory(context.pathname),
		browserFamily: browserFamily(context.userAgent),
		errorCounts,
		errors: entries.map((entry) => ({
			timestamp: entry.timestamp,
			type: entry.type,
			failureClass: classifyFailure(entry.message)
		}))
	};
}
