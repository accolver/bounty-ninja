function parseIpv4(hostname: string): number[] | null {
	const segments = hostname.split('.');
	if (segments.length !== 4 || segments.some((part) => !/^\d{1,3}$/.test(part))) return null;
	const parts = segments.map(Number);
	return parts.some((part) => part > 255) ? null : parts;
}

function isBlockedIpv4(parts: readonly number[]): boolean {
	const [first, second, third] = parts;
	return (
		first === 0 ||
		first === 10 ||
		(first === 100 && second >= 64 && second <= 127) ||
		first === 127 ||
		(first === 169 && second === 254) ||
		(first === 172 && second >= 16 && second <= 31) ||
		(first === 192 && second === 168) ||
		(first === 192 && second === 0 && (third === 0 || third === 2)) ||
		(first === 192 && second === 88 && third === 99) ||
		(first === 198 && (second === 18 || second === 19 || (second === 51 && third === 100))) ||
		(first === 203 && second === 0 && third === 113) ||
		first >= 224
	);
}

function parseIpv6(hostname: string): number[] | null {
	const halves = hostname.toLowerCase().split('::');
	if (halves.length > 2) return null;

	const parseHalf = (half: string): number[] | null => {
		if (!half) return [];
		const groups: number[] = [];
		for (const [index, token] of half.split(':').entries()) {
			if (token.includes('.')) {
				if (index !== half.split(':').length - 1) return null;
				const ipv4 = parseIpv4(token);
				if (!ipv4) return null;
				groups.push((ipv4[0] << 8) | ipv4[1], (ipv4[2] << 8) | ipv4[3]);
			} else {
				if (!/^[0-9a-f]{1,4}$/.test(token)) return null;
				groups.push(Number.parseInt(token, 16));
			}
		}
		return groups;
	};

	const left = parseHalf(halves[0]);
	const right = parseHalf(halves[1] ?? '');
	if (!left || !right) return null;
	if (halves.length === 1) return left.length === 8 ? left : null;
	const omitted = 8 - left.length - right.length;
	return omitted > 0 ? [...left, ...Array<number>(omitted).fill(0), ...right] : null;
}

function isBlockedIpv6(hostname: string): boolean {
	const groups = parseIpv6(hostname);
	if (!groups) return true;

	const first = groups[0];
	const isIpv4Mapped = groups.slice(0, 5).every((group) => group === 0) && groups[5] === 0xffff;
	if (isIpv4Mapped) {
		return isBlockedIpv4([groups[6] >> 8, groups[6] & 0xff, groups[7] >> 8, groups[7] & 0xff]);
	}

	return (
		groups.slice(0, 6).every((group) => group === 0) ||
		(first & 0xfe00) === 0xfc00 ||
		(first & 0xffc0) === 0xfe80 ||
		(first & 0xffc0) === 0xfec0 ||
		(first & 0xff00) === 0xff00 ||
		(first === 0x0100 && groups.slice(1, 4).every((group) => group === 0)) ||
		(first === 0x2001 && groups[1] === 0x0db8)
	);
}

/** Reject URLs that could expose a visitor's network or browser to an event author. */
export function normalizePublicHttpsUrl(value: string): string | null {
	try {
		const url = new URL(value);
		const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
		const isIpv6 = hostname.includes(':');
		const ipv4 = isIpv6 ? null : parseIpv4(hostname);
		if (url.protocol !== 'https:' || url.username || url.password || !hostname) return null;
		if (
			hostname === 'localhost' ||
			hostname.endsWith('.localhost') ||
			hostname.endsWith('.local') ||
			(isIpv6 && isBlockedIpv6(hostname)) ||
			(ipv4 !== null && isBlockedIpv4(ipv4))
		) {
			return null;
		}
		url.hash = '';
		return url.href.replace(/\/$/, '');
	} catch {
		return null;
	}
}

export function isConfiguredMint(
	value: string | null | undefined,
	configuredValue: string
): boolean {
	if (!value) return false;
	const candidate = normalizePublicHttpsUrl(value);
	const configured = normalizePublicHttpsUrl(configuredValue);
	return candidate !== null && candidate === configured;
}
