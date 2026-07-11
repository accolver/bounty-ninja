const MAX_EVENT_URL_LENGTH = 2048;

export type EventUrlPurpose = 'external-link' | 'image';

/** Normalize an untrusted event URL, accepting HTTPS resources only. */
export function safeEventUrl(value: unknown, _purpose: EventUrlPurpose): string | null {
	if (typeof value !== 'string') return null;
	const trimmed = value.trim();
	if (!trimmed || trimmed.length > MAX_EVENT_URL_LENGTH) return null;

	try {
		const url = new URL(trimmed);
		if (url.protocol !== 'https:') return null;
		if (!url.hostname || url.username || url.password) return null;
		return url.href;
	} catch {
		return null;
	}
}
