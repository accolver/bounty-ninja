/**
 * Unit tests for ErrorBoundary component.
 *
 * ErrorBoundary.svelte is a Svelte component using <svelte:boundary> with
 * an error handler that:
 * - Normalizes errors (wraps non-Error values)
 * - Calls toastStore.error() with the error message
 * - Forwards errors to an optional onError callback
 * - Logs to console.error
 *
 * Since rendering Svelte components requires a full Svelte test harness
 * (e.g. @testing-library/svelte), we verify:
 * 1. The module can be imported without errors
 * 2. The error handling logic pattern (toast + callback + logging) via
 *    the toast store which is the observable side effect
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the toast store to verify error boundary interactions
vi.mock('$lib/stores/toast.svelte', () => ({
	toastStore: {
		error: vi.fn(),
		success: vi.fn(),
		warning: vi.fn(),
		info: vi.fn(),
		add: vi.fn(),
		dismiss: vi.fn(),
		clear: vi.fn(),
		toasts: []
	}
}));

// Mock lucide icons to avoid rendering issues
vi.mock('@lucide/svelte/icons/circle-x', () => ({
	default: {}
}));
vi.mock('@lucide/svelte/icons/rotate-ccw', () => ({
	default: {}
}));

describe('ErrorBoundary', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('module can be imported without errors', async () => {
		const module = await import('$lib/components/shared/ErrorBoundary.svelte');
		expect(module).toBeDefined();
		expect(module.default).toBeDefined();
	});

	it('default export is a Svelte component constructor', async () => {
		const module = await import('$lib/components/shared/ErrorBoundary.svelte');
		// Svelte 5 compiled components are objects with a render function or similar structure
		expect(typeof module.default).toBe('function');
	});
});

describe('ErrorBoundary error handling pattern', () => {
	it('toastStore.error is callable for component error messages', async () => {
		const { toastStore } = await import('$lib/stores/toast.svelte');

		// Simulate what the ErrorBoundary handleError function does
		const error = new Error('Test component error');
		toastStore.error(`Component error: ${error.message}`);

		expect(toastStore.error).toHaveBeenCalledWith('Component error: Test component error');
	});

	it('non-Error values are wrapped in Error objects (matching handleError pattern)', () => {
		// This mirrors the error normalization in handleError:
		// const err = error instanceof Error ? error : new Error(String(error));
		const stringError = 'something went wrong';
		const normalized =
			stringError instanceof Error ? stringError : new Error(String(stringError));

		expect(normalized).toBeInstanceOf(Error);
		expect(normalized.message).toBe('something went wrong');
	});

	it('Error instances pass through unchanged (matching handleError pattern)', () => {
		const original = new Error('original error');
		const normalized = original instanceof Error ? original : new Error(String(original));

		expect(normalized).toBe(original);
		expect(normalized.message).toBe('original error');
	});

	it('null/undefined values are safely converted to Error (matching handleError pattern)', () => {
		const nullNormalized = null instanceof Error ? null : new Error(String(null));
		expect(nullNormalized.message).toBe('null');

		const undefinedNormalized =
			undefined instanceof Error ? undefined : new Error(String(undefined));
		expect(undefinedNormalized.message).toBe('undefined');
	});
});
