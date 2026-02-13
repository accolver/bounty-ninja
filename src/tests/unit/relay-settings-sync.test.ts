import { describe, it, expect, vi } from 'vitest';
import { normalizeURL } from 'applesauce-core/helpers/url';

describe('Relay settings ↔ pool sync', () => {
	it('normalizeURL adds trailing slash to relay URLs', () => {
		expect(normalizeURL('wss://relay.damus.io')).toBe('wss://relay.damus.io/');
		expect(normalizeURL('wss://nos.lol')).toBe('wss://nos.lol/');
		expect(normalizeURL('wss://relay.damus.io/')).toBe('wss://relay.damus.io/');
	});

	it('pool keys use normalized URLs — raw URLs fail lookup', () => {
		// Simulate the pool's internal Map (keyed by normalized URLs)
		const poolRelays = new Map<string, { url: string; close: () => void }>();
		const closeFn = vi.fn();

		const normalizedUrl = normalizeURL('wss://relay.damus.io');
		poolRelays.set(normalizedUrl, { url: normalizedUrl, close: closeFn });

		// Raw URL (no trailing slash) — lookup fails
		expect(poolRelays.get('wss://relay.damus.io')).toBeUndefined();

		// Normalized URL — lookup succeeds
		expect(poolRelays.get(normalizeURL('wss://relay.damus.io'))).toBeDefined();
	});

	it('pool.remove simulation: normalizing before remove finds the relay', () => {
		const poolRelays = new Map<string, { url: string; close: () => void }>();
		const closeFn = vi.fn();

		const url = 'wss://nostr.wine';
		const normalized = normalizeURL(url);
		poolRelays.set(normalized, { url: normalized, close: closeFn });

		// Simulate pool.remove with normalization
		const instance = poolRelays.get(normalizeURL(url));
		expect(instance).toBeDefined();
		instance?.close();
		poolRelays.delete(normalized);

		expect(closeFn).toHaveBeenCalled();
		expect(poolRelays.size).toBe(0);
	});

	it('localStorage settings parsing extracts relay list', () => {
		const stored = JSON.stringify({
			relays: ['wss://custom.relay.com', 'wss://another.relay.io'],
			mint: 'https://mint.test'
		});
		const parsed = JSON.parse(stored);
		expect(Array.isArray(parsed.relays)).toBe(true);
		expect(parsed.relays).toHaveLength(2);
		expect(parsed.relays[0]).toBe('wss://custom.relay.com');
	});

	it('falls back gracefully on invalid localStorage JSON', () => {
		const fallback = ['wss://default.relay'];
		let result: string[];
		try {
			const parsed = JSON.parse('not-json');
			result = Array.isArray(parsed.relays) ? parsed.relays : fallback;
		} catch {
			result = fallback;
		}
		expect(result).toEqual(fallback);
	});

	it('falls back when localStorage has empty relay array', () => {
		const stored = JSON.stringify({ relays: [], mint: 'https://mint.test' });
		const parsed = JSON.parse(stored);
		const hasRelays = Array.isArray(parsed.relays) && parsed.relays.length > 0;
		expect(hasRelays).toBe(false);
	});
});
