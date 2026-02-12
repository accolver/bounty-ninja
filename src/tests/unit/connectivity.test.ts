import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

let connectivityModule: typeof import('$lib/stores/connectivity.svelte');

// Track event listeners so we can dispatch events manually
let windowListeners: Map<string, EventListenerOrEventListenerObject>;

beforeEach(async () => {
	vi.clearAllMocks();
	vi.resetModules();

	windowListeners = new Map();

	// Stub navigator.onLine
	vi.stubGlobal('navigator', { onLine: true });

	// Intercept addEventListener so we can capture the listeners
	const originalAddEventListener = window.addEventListener.bind(window);
	vi.spyOn(window, 'addEventListener').mockImplementation(
		(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions) => {
			windowListeners.set(type, listener);
			originalAddEventListener(type, listener, options);
		}
	);

	connectivityModule = await import('$lib/stores/connectivity.svelte');
});

afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe('ConnectivityStore', () => {
	// ── Singleton Export ───────────────────────────────────────────────

	it('exports a singleton connectivity instance', () => {
		expect(connectivityModule.connectivity).toBeDefined();
	});

	// ── Initial State ─────────────────────────────────────────────────

	it('initial state matches navigator.onLine (true)', () => {
		const { connectivity } = connectivityModule;
		expect(connectivity.online).toBe(true);
	});

	it('initial state matches navigator.onLine when offline', async () => {
		vi.resetModules();
		vi.stubGlobal('navigator', { onLine: false });

		const freshModule = await import('$lib/stores/connectivity.svelte');
		expect(freshModule.connectivity.online).toBe(false);
	});

	// ── Event Response ────────────────────────────────────────────────

	describe('responds to window online/offline events', () => {
		it('sets online to false when offline event fires', () => {
			const { connectivity } = connectivityModule;

			// Verify initially online
			expect(connectivity.online).toBe(true);

			// Dispatch offline event
			window.dispatchEvent(new Event('offline'));

			expect(connectivity.online).toBe(false);
		});

		it('sets online to true when online event fires', async () => {
			// Start offline
			vi.resetModules();
			vi.stubGlobal('navigator', { onLine: false });

			const freshModule = await import('$lib/stores/connectivity.svelte');
			expect(freshModule.connectivity.online).toBe(false);

			// Dispatch online event
			window.dispatchEvent(new Event('online'));

			expect(freshModule.connectivity.online).toBe(true);
		});

		it('toggles between online and offline states', () => {
			const { connectivity } = connectivityModule;

			expect(connectivity.online).toBe(true);

			window.dispatchEvent(new Event('offline'));
			expect(connectivity.online).toBe(false);

			window.dispatchEvent(new Event('online'));
			expect(connectivity.online).toBe(true);

			window.dispatchEvent(new Event('offline'));
			expect(connectivity.online).toBe(false);
		});
	});

	// ── Listener Registration ─────────────────────────────────────────

	describe('event listener registration', () => {
		it('registers online event listener on window', () => {
			expect(window.addEventListener).toHaveBeenCalledWith(
				'online',
				expect.any(Function)
			);
		});

		it('registers offline event listener on window', () => {
			expect(window.addEventListener).toHaveBeenCalledWith(
				'offline',
				expect.any(Function)
			);
		});
	});
});
