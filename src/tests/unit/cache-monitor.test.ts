import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the cache-eviction module before importing cache-monitor
const mockGetCacheEventCount = vi.fn();
const mockEstimateCacheSize = vi.fn();

vi.mock('$lib/nostr/cache-eviction', () => ({
	getCacheEventCount: mockGetCacheEventCount,
	estimateCacheSize: mockEstimateCacheSize
}));

// Dynamic import to get fresh module after mocks are set up
let cacheMonitorModule: typeof import('$lib/nostr/cache-monitor.svelte');

beforeEach(async () => {
	vi.useFakeTimers();
	vi.clearAllMocks();

	// Default: IDB returns reasonable values
	mockGetCacheEventCount.mockResolvedValue(42);
	mockEstimateCacheSize.mockResolvedValue(8192);

	// Re-import to get fresh singleton
	vi.resetModules();
	vi.doMock('$lib/nostr/cache-eviction', () => ({
		getCacheEventCount: mockGetCacheEventCount,
		estimateCacheSize: mockEstimateCacheSize
	}));
	cacheMonitorModule = await import('$lib/nostr/cache-monitor.svelte');
});

afterEach(() => {
	// Stop any active monitoring to prevent leaks
	cacheMonitorModule.cacheMonitor.destroy();
	vi.useRealTimers();
});

describe('CacheMonitor', () => {
	// ── Singleton Export ───────────────────────────────────────────────

	it('exports a singleton cacheMonitor instance', () => {
		expect(cacheMonitorModule.cacheMonitor).toBeDefined();
	});

	it('singleton has expected initial state', () => {
		const { cacheMonitor } = cacheMonitorModule;
		expect(cacheMonitor.eventCount).toBe(0);
		expect(cacheMonitor.estimatedSizeBytes).toBe(0);
		expect(cacheMonitor.refreshing).toBe(false);
	});

	// ── refresh() ─────────────────────────────────────────────────────

	describe('refresh()', () => {
		it('updates stats when refresh is called', async () => {
			const { cacheMonitor } = cacheMonitorModule;

			await cacheMonitor.refresh();

			expect(cacheMonitor.eventCount).toBe(42);
			expect(cacheMonitor.estimatedSizeBytes).toBe(8192);
		});

		it('calls getCacheEventCount and estimateCacheSize', async () => {
			const { cacheMonitor } = cacheMonitorModule;

			await cacheMonitor.refresh();

			expect(mockGetCacheEventCount).toHaveBeenCalledTimes(1);
			expect(mockEstimateCacheSize).toHaveBeenCalledTimes(1);
		});

		it('sets refreshing to false after successful refresh', async () => {
			const { cacheMonitor } = cacheMonitorModule;

			await cacheMonitor.refresh();

			expect(cacheMonitor.refreshing).toBe(false);
		});

		it('handles IDB errors gracefully — does not throw', async () => {
			mockGetCacheEventCount.mockRejectedValue(new Error('IDB read failed'));
			mockEstimateCacheSize.mockRejectedValue(new Error('IDB read failed'));

			const { cacheMonitor } = cacheMonitorModule;
			const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

			// Should not throw
			await cacheMonitor.refresh();

			expect(warnSpy).toHaveBeenCalledWith(
				expect.stringContaining('[cache-monitor]')
			);
			// State should remain at defaults (0) when error occurs
			expect(cacheMonitor.eventCount).toBe(0);
			expect(cacheMonitor.estimatedSizeBytes).toBe(0);
			expect(cacheMonitor.refreshing).toBe(false);

			warnSpy.mockRestore();
		});

		it('handles non-Error IDB errors gracefully', async () => {
			mockGetCacheEventCount.mockRejectedValue('string error');
			mockEstimateCacheSize.mockRejectedValue('string error');

			const { cacheMonitor } = cacheMonitorModule;
			const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

			await cacheMonitor.refresh();

			expect(warnSpy).toHaveBeenCalledWith(
				expect.stringContaining('string error')
			);
			expect(cacheMonitor.refreshing).toBe(false);

			warnSpy.mockRestore();
		});

		it('prevents concurrent refreshes', async () => {
			const { cacheMonitor } = cacheMonitorModule;

			// Make the first call hang
			let resolveFirst: (() => void) | undefined;
			mockGetCacheEventCount.mockImplementation(
				() =>
					new Promise<number>((resolve) => {
						resolveFirst = () => resolve(100);
					})
			);
			mockEstimateCacheSize.mockResolvedValue(500);

			// Start first refresh (will hang)
			const p1 = cacheMonitor.refresh();

			// Second refresh should return immediately (refreshing is true)
			const p2 = cacheMonitor.refresh();

			// Only one call should have been made
			expect(mockGetCacheEventCount).toHaveBeenCalledTimes(1);

			// Resolve the pending call
			resolveFirst!();
			await p1;
			await p2;
		});
	});

	// ── estimatedSizeFormatted ────────────────────────────────────────

	describe('estimatedSizeFormatted', () => {
		it('returns "0 B" when size is 0', () => {
			const { cacheMonitor } = cacheMonitorModule;
			expect(cacheMonitor.estimatedSizeFormatted).toBe('0 B');
		});

		it('returns formatted KB after refresh', async () => {
			mockEstimateCacheSize.mockResolvedValue(2048);
			const { cacheMonitor } = cacheMonitorModule;

			await cacheMonitor.refresh();

			expect(cacheMonitor.estimatedSizeFormatted).toBe('2.0 KB');
		});

		it('returns formatted MB for large sizes', async () => {
			mockEstimateCacheSize.mockResolvedValue(1048576); // 1 MB
			const { cacheMonitor } = cacheMonitorModule;

			await cacheMonitor.refresh();

			expect(cacheMonitor.estimatedSizeFormatted).toBe('1.0 MB');
		});
	});

	// ── startMonitoring / stopMonitoring ──────────────────────────────

	// Helper: flush pending microtasks (resolved promises) without running timers
	const flushMicrotasks = () => new Promise<void>((r) => queueMicrotask(r));

	describe('startMonitoring()', () => {
		it('triggers an initial refresh when monitoring starts', async () => {
			const { cacheMonitor } = cacheMonitorModule;

			cacheMonitor.startMonitoring(60_000);

			// The initial refresh() is called synchronously via `void this.refresh()`.
			// Flush microtasks to let the async refresh() promise settle.
			await flushMicrotasks();
			await flushMicrotasks();

			expect(mockGetCacheEventCount).toHaveBeenCalled();
			expect(mockEstimateCacheSize).toHaveBeenCalled();
		});

		it('periodically refreshes at the specified interval', async () => {
			const { cacheMonitor } = cacheMonitorModule;

			cacheMonitor.startMonitoring(10_000);

			// Flush initial refresh
			await flushMicrotasks();
			await flushMicrotasks();
			const initialCalls = mockGetCacheEventCount.mock.calls.length;

			// Advance by one interval to trigger the setInterval callback
			vi.advanceTimersByTime(10_000);
			await flushMicrotasks();
			await flushMicrotasks();

			expect(mockGetCacheEventCount.mock.calls.length).toBeGreaterThan(initialCalls);
		});
	});

	describe('stopMonitoring()', () => {
		it('stops periodic refresh', async () => {
			const { cacheMonitor } = cacheMonitorModule;

			cacheMonitor.startMonitoring(10_000);
			await flushMicrotasks();
			await flushMicrotasks();

			const callsAfterStart = mockGetCacheEventCount.mock.calls.length;

			cacheMonitor.stopMonitoring();

			// Advance time — no more calls should occur
			vi.advanceTimersByTime(30_000);
			await flushMicrotasks();
			await flushMicrotasks();

			expect(mockGetCacheEventCount.mock.calls.length).toBe(callsAfterStart);
		});
	});

	describe('destroy()', () => {
		it('stops monitoring on destroy', async () => {
			const { cacheMonitor } = cacheMonitorModule;

			cacheMonitor.startMonitoring(10_000);
			await flushMicrotasks();
			await flushMicrotasks();

			const callsAfterStart = mockGetCacheEventCount.mock.calls.length;

			cacheMonitor.destroy();

			vi.advanceTimersByTime(30_000);
			await flushMicrotasks();
			await flushMicrotasks();

			expect(mockGetCacheEventCount.mock.calls.length).toBe(callsAfterStart);
		});
	});

	describe('startMonitoring replaces previous monitoring', () => {
		it('calling startMonitoring twice stops the first interval', async () => {
			const { cacheMonitor } = cacheMonitorModule;

			cacheMonitor.startMonitoring(10_000);
			await flushMicrotasks();
			await flushMicrotasks();

			// Start again with different interval — this calls stopMonitoring() first
			cacheMonitor.startMonitoring(20_000);
			await flushMicrotasks();
			await flushMicrotasks();

			const callsAfterRestart = mockGetCacheEventCount.mock.calls.length;

			// Advance 15s — old interval (10s) would fire, new interval (20s) would not
			vi.advanceTimersByTime(15_000);
			await flushMicrotasks();
			await flushMicrotasks();

			// Should NOT have fired the old 10s interval
			expect(mockGetCacheEventCount.mock.calls.length).toBe(callsAfterRestart);
		});
	});
});
