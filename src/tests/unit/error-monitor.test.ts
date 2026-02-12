import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { ErrorEntry, ErrorEntryType } from '$lib/stores/error-monitor.svelte';

describe('ErrorMonitorStore', () => {
	let errorMonitor: typeof import('$lib/stores/error-monitor.svelte').errorMonitor;
	let ErrorMonitorModule: typeof import('$lib/stores/error-monitor.svelte');

	beforeEach(async () => {
		vi.resetModules();
		ErrorMonitorModule = await import('$lib/stores/error-monitor.svelte');
		errorMonitor = ErrorMonitorModule.errorMonitor;
	});

	afterEach(() => {
		errorMonitor.destroy();
		errorMonitor.clear();
	});

	it('exports a singleton errorMonitor', () => {
		expect(errorMonitor).toBeDefined();
		expect(errorMonitor.entries).toEqual([]);
		expect(errorMonitor.count).toBe(0);
		expect(errorMonitor.hasErrors).toBe(false);
	});

	it('captures error entries', () => {
		errorMonitor.capture('Something went wrong', 'error', {
			source: 'app.js:10:5',
			stack: 'Error: Something went wrong\n    at app.js:10:5'
		});

		expect(errorMonitor.count).toBe(1);
		expect(errorMonitor.hasErrors).toBe(true);

		const entry = errorMonitor.entries[0];
		expect(entry.message).toBe('Something went wrong');
		expect(entry.type).toBe('error');
		expect(entry.source).toBe('app.js:10:5');
		expect(entry.stack).toContain('Something went wrong');
		expect(entry.timestamp).toBeGreaterThan(0);
	});

	it('captures unhandled-rejection entries', () => {
		errorMonitor.capture('Promise failed', 'unhandled-rejection');

		expect(errorMonitor.count).toBe(1);
		expect(errorMonitor.entries[0].type).toBe('unhandled-rejection');
	});

	it('captures boundary entries', () => {
		errorMonitor.capture('Component crashed', 'boundary');

		expect(errorMonitor.count).toBe(1);
		expect(errorMonitor.entries[0].type).toBe('boundary');
	});

	it('circular buffer evicts oldest entries when full', async () => {
		// Re-import with a small buffer for testing
		vi.resetModules();

		// We need to test the circular buffer behavior.
		// The singleton uses default 50, but we can test by filling it.
		// Instead, capture more than maxEntries and verify eviction.
		const maxEntries = errorMonitor.maxEntries; // 50

		// Fill the buffer beyond capacity
		for (let i = 0; i < maxEntries + 10; i++) {
			errorMonitor.capture(`Error ${i}`, 'error');
		}

		expect(errorMonitor.count).toBe(maxEntries);

		// The oldest entries (0-9) should be evicted
		expect(errorMonitor.entries[0].message).toBe('Error 10');
		// The newest entry should be the last one
		expect(errorMonitor.entries[maxEntries - 1].message).toBe(`Error ${maxEntries + 9}`);
	});

	it('strips 64-char hex pubkeys from error messages', () => {
		const pubkey = 'a'.repeat(64);
		errorMonitor.capture(
			`Failed to load profile for ${pubkey}`,
			'error',
			{
				source: `relay-${pubkey}.ts:42:1`,
				stack: `Error: user ${pubkey} not found\n    at resolve.ts:5`
			}
		);

		const entry = errorMonitor.entries[0];
		expect(entry.message).not.toContain(pubkey);
		expect(entry.message).toContain('aaaaaaaa...[redacted]');
		expect(entry.source).not.toContain(pubkey);
		expect(entry.source).toContain('aaaaaaaa...[redacted]');
		expect(entry.stack).not.toContain(pubkey);
		expect(entry.stack).toContain('aaaaaaaa...[redacted]');
	});

	it('strips multiple hex pubkeys from a single message', () => {
		const pk1 = '1'.repeat(64);
		const pk2 = '2'.repeat(64);
		errorMonitor.capture(`Error between ${pk1} and ${pk2}`, 'error');

		const entry = errorMonitor.entries[0];
		expect(entry.message).not.toContain(pk1);
		expect(entry.message).not.toContain(pk2);
		expect(entry.message).toContain('11111111...[redacted]');
		expect(entry.message).toContain('22222222...[redacted]');
	});

	it('does not strip shorter hex strings', () => {
		const shortHex = 'abcdef1234567890';
		errorMonitor.capture(`Short hex: ${shortHex}`, 'error');

		expect(errorMonitor.entries[0].message).toContain(shortHex);
	});

	it('clear() removes all entries', () => {
		errorMonitor.capture('Error 1', 'error');
		errorMonitor.capture('Error 2', 'error');
		expect(errorMonitor.count).toBe(2);

		errorMonitor.clear();
		expect(errorMonitor.count).toBe(0);
		expect(errorMonitor.entries).toEqual([]);
		expect(errorMonitor.hasErrors).toBe(false);
	});

	it('init() registers global error handlers and returns cleanup', () => {
		const addSpy = vi.spyOn(window, 'addEventListener');
		const removeSpy = vi.spyOn(window, 'removeEventListener');

		const cleanup = errorMonitor.init();

		expect(addSpy).toHaveBeenCalledWith('error', expect.any(Function));
		expect(addSpy).toHaveBeenCalledWith('unhandledrejection', expect.any(Function));

		cleanup();

		expect(removeSpy).toHaveBeenCalledWith('error', expect.any(Function));
		expect(removeSpy).toHaveBeenCalledWith('unhandledrejection', expect.any(Function));

		addSpy.mockRestore();
		removeSpy.mockRestore();
	});

	it('init() only registers handlers once', () => {
		const addSpy = vi.spyOn(window, 'addEventListener');

		errorMonitor.init();
		errorMonitor.init(); // second call should be a no-op

		// Should only have 2 calls total (error + unhandledrejection), not 4
		const errorCalls = addSpy.mock.calls.filter((c) => c[0] === 'error');
		const rejectionCalls = addSpy.mock.calls.filter((c) => c[0] === 'unhandledrejection');
		expect(errorCalls).toHaveLength(1);
		expect(rejectionCalls).toHaveLength(1);

		addSpy.mockRestore();
	});

	it('captures errors from ErrorEvent via init handlers', () => {
		errorMonitor.init();

		const errorEvent = new ErrorEvent('error', {
			message: 'Test global error',
			filename: 'bundle.js',
			lineno: 42,
			colno: 7,
			error: new Error('Test global error')
		});

		window.dispatchEvent(errorEvent);

		expect(errorMonitor.count).toBe(1);
		expect(errorMonitor.entries[0].message).toBe('Test global error');
		expect(errorMonitor.entries[0].type).toBe('error');
		expect(errorMonitor.entries[0].source).toBe('bundle.js:42:7');
	});

	it('captures unhandled promise rejections via init handlers', () => {
		errorMonitor.init();

		// PromiseRejectionEvent requires a real promise in some environments
		const promise = Promise.resolve();
		const event = new PromiseRejectionEvent('unhandledrejection', {
			reason: new Error('Async failure'),
			promise
		});

		window.dispatchEvent(event);

		expect(errorMonitor.count).toBe(1);
		expect(errorMonitor.entries[0].message).toBe('Async failure');
		expect(errorMonitor.entries[0].type).toBe('unhandled-rejection');
	});

	it('handles non-Error rejection reasons', () => {
		errorMonitor.init();

		const promise = Promise.resolve();
		const event = new PromiseRejectionEvent('unhandledrejection', {
			reason: 'string rejection',
			promise
		});

		window.dispatchEvent(event);

		expect(errorMonitor.entries[0].message).toBe('string rejection');
		expect(errorMonitor.entries[0].stack).toBeUndefined();
	});

	it('entries are ordered oldest to newest', () => {
		errorMonitor.capture('First', 'error');
		errorMonitor.capture('Second', 'error');
		errorMonitor.capture('Third', 'error');

		expect(errorMonitor.entries[0].message).toBe('First');
		expect(errorMonitor.entries[1].message).toBe('Second');
		expect(errorMonitor.entries[2].message).toBe('Third');
	});

	it('optional fields are undefined when not provided', () => {
		errorMonitor.capture('Bare error', 'error');

		const entry = errorMonitor.entries[0];
		expect(entry.source).toBeUndefined();
		expect(entry.stack).toBeUndefined();
	});
});
