/**
 * Unit tests for settings persistence logic.
 *
 * The settings page (src/routes/settings/+page.svelte) manages:
 * - Relay list (add/remove, persisted to localStorage)
 * - Cashu mint URL (persisted to localStorage)
 * - Theme preference (dark/light, persisted to localStorage)
 * - Cache limits (maxEvents, maxAgeDays, persisted to localStorage)
 *
 * Since these are inline functions in a Svelte component, we test the
 * same localStorage patterns and key conventions used by the settings page.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isValidRelayUrl } from '$lib/utils/relay-validation';

// ── Constants matching the settings page ──────────────────────────────
const SETTINGS_KEY = 'bounty.ninja:settings';
const THEME_KEY = 'bounty.ninja:theme';
const CACHE_LIMITS_KEY = 'bounty.ninja:cache-limits';

// ── Helper functions mirroring settings page logic ────────────────────

interface Settings {
	relays: string[];
	mint: string;
}

interface CacheLimits {
	maxEvents: number;
	maxAgeDays: number;
}

const DEFAULT_RELAYS = [
	'wss://relay.damus.io',
	'wss://nos.lol',
	'wss://relay.primal.net'
];
const DEFAULT_MINT = 'https://mint.minibits.cash/Bitcoin';
const DEFAULT_CACHE_LIMITS: CacheLimits = { maxEvents: 10_000, maxAgeDays: 30 };

function loadSettings(): Settings {
	try {
		const raw = localStorage.getItem(SETTINGS_KEY);
		if (raw) return JSON.parse(raw);
	} catch {
		/* ignore parse errors */
	}
	return { relays: [...DEFAULT_RELAYS], mint: DEFAULT_MINT };
}

function saveSettings(settings: Settings): boolean {
	try {
		localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
		return true;
	} catch {
		return false;
	}
}

function loadCacheLimits(): CacheLimits {
	try {
		const raw = localStorage.getItem(CACHE_LIMITS_KEY);
		if (raw) return JSON.parse(raw);
	} catch {
		/* ignore parse errors */
	}
	return { ...DEFAULT_CACHE_LIMITS };
}

function saveCacheLimits(limits: CacheLimits): boolean {
	try {
		localStorage.setItem(CACHE_LIMITS_KEY, JSON.stringify(limits));
		return true;
	} catch {
		return false;
	}
}

// ── Setup ─────────────────────────────────────────────────────────────

let mockStorage: Map<string, string>;

beforeEach(() => {
	mockStorage = new Map();

	vi.stubGlobal('localStorage', {
		getItem: vi.fn((key: string) => mockStorage.get(key) ?? null),
		setItem: vi.fn((key: string, value: string) => {
			mockStorage.set(key, value);
		}),
		removeItem: vi.fn((key: string) => {
			mockStorage.delete(key);
		}),
		clear: vi.fn(() => {
			mockStorage.clear();
		})
	});
});

afterEach(() => {
	vi.unstubAllGlobals();
});

// ── Tests ─────────────────────────────────────────────────────────────

describe('Settings persistence — relay management', () => {
	it('loads default relays when localStorage is empty', () => {
		const settings = loadSettings();
		expect(settings.relays).toEqual(DEFAULT_RELAYS);
		expect(settings.mint).toBe(DEFAULT_MINT);
	});

	it('saves and loads relay list', () => {
		const relays = ['wss://relay.damus.io', 'wss://custom.relay.com'];
		saveSettings({ relays, mint: DEFAULT_MINT });

		const loaded = loadSettings();
		expect(loaded.relays).toEqual(relays);
	});

	it('adding a relay persists to localStorage', () => {
		const settings = loadSettings();
		const newRelay = 'wss://new.relay.example.com';

		// Validate before adding (matching settings page pattern)
		const validation = isValidRelayUrl(newRelay);
		expect(validation.valid).toBe(true);

		settings.relays = [...settings.relays, newRelay];
		saveSettings(settings);

		const loaded = loadSettings();
		expect(loaded.relays).toContain(newRelay);
		expect(loaded.relays).toHaveLength(DEFAULT_RELAYS.length + 1);
	});

	it('removing a relay persists to localStorage', () => {
		const settings = loadSettings();
		const relayToRemove = settings.relays[0];

		settings.relays = settings.relays.filter((r: string) => r !== relayToRemove);
		saveSettings(settings);

		const loaded = loadSettings();
		expect(loaded.relays).not.toContain(relayToRemove);
		expect(loaded.relays).toHaveLength(DEFAULT_RELAYS.length - 1);
	});

	it('prevents duplicate relay URLs', () => {
		const settings = loadSettings();
		const existingRelay = settings.relays[0];

		// Check for duplicate before adding (matching settings page pattern)
		const isDuplicate = settings.relays.includes(existingRelay);
		expect(isDuplicate).toBe(true);

		// Don't add if duplicate
		if (!isDuplicate) {
			settings.relays = [...settings.relays, existingRelay];
		}

		expect(settings.relays).toHaveLength(DEFAULT_RELAYS.length);
	});

	it('rejects invalid relay URLs', () => {
		const invalidUrls = [
			'http://not-websocket.com',
			'ws://insecure.com',
			'not-a-url',
			'',
			'wss://ab' // hostname too short
		];

		for (const url of invalidUrls) {
			const result = isValidRelayUrl(url);
			expect(result.valid).toBe(false);
		}
	});
});

describe('Settings persistence — mint URL', () => {
	it('loads default mint when localStorage is empty', () => {
		const settings = loadSettings();
		expect(settings.mint).toBe(DEFAULT_MINT);
	});

	it('persists custom mint URL', () => {
		const customMint = 'https://custom-mint.example.com';
		saveSettings({ relays: DEFAULT_RELAYS, mint: customMint });

		const loaded = loadSettings();
		expect(loaded.mint).toBe(customMint);
	});

	it('reset to default mint works', () => {
		// Save custom mint
		saveSettings({ relays: DEFAULT_RELAYS, mint: 'https://custom.com' });

		// Reset to default
		saveSettings({ relays: DEFAULT_RELAYS, mint: DEFAULT_MINT });

		const loaded = loadSettings();
		expect(loaded.mint).toBe(DEFAULT_MINT);
	});
});

describe('Settings persistence — theme', () => {
	it('saves dark theme preference', () => {
		localStorage.setItem(THEME_KEY, 'dark');

		expect(localStorage.getItem(THEME_KEY)).toBe('dark');
	});

	it('saves light theme preference', () => {
		localStorage.setItem(THEME_KEY, 'light');

		expect(localStorage.getItem(THEME_KEY)).toBe('light');
	});

	it('returns null when no theme preference is set', () => {
		expect(localStorage.getItem(THEME_KEY)).toBeNull();
	});

	it('theme toggle persists correctly', () => {
		// Start dark
		localStorage.setItem(THEME_KEY, 'dark');
		expect(localStorage.getItem(THEME_KEY)).toBe('dark');

		// Toggle to light
		localStorage.setItem(THEME_KEY, 'light');
		expect(localStorage.getItem(THEME_KEY)).toBe('light');

		// Toggle back to dark
		localStorage.setItem(THEME_KEY, 'dark');
		expect(localStorage.getItem(THEME_KEY)).toBe('dark');
	});
});

describe('Settings persistence — cache limits', () => {
	it('loads default cache limits when localStorage is empty', () => {
		const limits = loadCacheLimits();
		expect(limits.maxEvents).toBe(10_000);
		expect(limits.maxAgeDays).toBe(30);
	});

	it('persists custom cache limits', () => {
		const customLimits: CacheLimits = { maxEvents: 5_000, maxAgeDays: 7 };
		saveCacheLimits(customLimits);

		const loaded = loadCacheLimits();
		expect(loaded.maxEvents).toBe(5_000);
		expect(loaded.maxAgeDays).toBe(7);
	});

	it('reset to defaults works by clearing key', () => {
		saveCacheLimits({ maxEvents: 1_000, maxAgeDays: 1 });
		localStorage.removeItem(CACHE_LIMITS_KEY);

		const loaded = loadCacheLimits();
		expect(loaded).toEqual(DEFAULT_CACHE_LIMITS);
	});
});

describe('Settings persistence — error handling', () => {
	it('handles corrupted JSON in settings gracefully', () => {
		mockStorage.set(SETTINGS_KEY, '{invalid json');

		const settings = loadSettings();

		// Should fall back to defaults
		expect(settings.relays).toEqual(DEFAULT_RELAYS);
		expect(settings.mint).toBe(DEFAULT_MINT);
	});

	it('handles corrupted JSON in cache limits gracefully', () => {
		mockStorage.set(CACHE_LIMITS_KEY, 'not-json');

		const limits = loadCacheLimits();

		expect(limits).toEqual(DEFAULT_CACHE_LIMITS);
	});

	it('handles localStorage.setItem throwing (storage full)', () => {
		vi.mocked(localStorage.setItem).mockImplementation(() => {
			throw new DOMException('QuotaExceededError');
		});

		const result = saveSettings({ relays: DEFAULT_RELAYS, mint: DEFAULT_MINT });
		expect(result).toBe(false);
	});

	it('handles localStorage.setItem throwing for cache limits', () => {
		vi.mocked(localStorage.setItem).mockImplementation(() => {
			throw new DOMException('QuotaExceededError');
		});

		const result = saveCacheLimits(DEFAULT_CACHE_LIMITS);
		expect(result).toBe(false);
	});

	it('handles missing localStorage gracefully in load functions', () => {
		// Simulate getItem returning null (key doesn't exist)
		vi.mocked(localStorage.getItem).mockReturnValue(null);

		const settings = loadSettings();
		expect(settings.relays).toEqual(DEFAULT_RELAYS);

		const limits = loadCacheLimits();
		expect(limits).toEqual(DEFAULT_CACHE_LIMITS);
	});
});
