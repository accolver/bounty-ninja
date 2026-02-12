/**
 * Lightweight client-side error monitoring store.
 * Captures global errors and unhandled rejections in a circular buffer.
 * Privacy-safe: strips Nostr pubkeys (64-char hex strings) from messages.
 * No external dependencies — errors stay local for debugging.
 */

export type ErrorEntryType = 'error' | 'unhandled-rejection' | 'boundary';

export interface ErrorEntry {
	timestamp: number;
	message: string;
	source?: string;
	type: ErrorEntryType;
	stack?: string;
}

/** Regex matching 64-character lowercase hex strings (Nostr pubkeys / event IDs) */
const HEX_PUBKEY_RE = /\b[0-9a-f]{64}\b/gi;

/** Replace hex pubkeys with a truncated redacted form for privacy */
function stripPubkeys(input: string): string {
	return input.replace(HEX_PUBKEY_RE, (match) => `${match.slice(0, 8)}...[redacted]`);
}

class ErrorMonitorStore {
	/** Maximum number of error entries retained */
	readonly maxEntries: number;

	#entries = $state<ErrorEntry[]>([]);

	/** Whether global handlers have been registered */
	#initialized = false;

	/** Stored handler references for cleanup */
	#onErrorHandler: ((event: ErrorEvent) => void) | null = null;
	#onRejectionHandler: ((event: PromiseRejectionEvent) => void) | null = null;

	constructor(maxEntries = 50) {
		this.maxEntries = maxEntries;
	}

	/** Current list of captured errors (newest last) */
	get entries(): ReadonlyArray<ErrorEntry> {
		return this.#entries;
	}

	/** Number of captured errors */
	get count(): number {
		return this.#entries.length;
	}

	/** Whether any errors have been captured */
	get hasErrors(): boolean {
		return this.#entries.length > 0;
	}

	/**
	 * Push an error into the circular buffer.
	 * If the buffer is full, the oldest entry is evicted.
	 */
	capture(
		message: string,
		type: ErrorEntryType,
		options?: { source?: string; stack?: string }
	): void {
		const entry: ErrorEntry = {
			timestamp: Date.now(),
			message: stripPubkeys(message),
			type,
			source: options?.source ? stripPubkeys(options.source) : undefined,
			stack: options?.stack ? stripPubkeys(options.stack) : undefined
		};

		if (this.#entries.length >= this.maxEntries) {
			// Evict oldest (index 0), append new
			this.#entries = [...this.#entries.slice(1), entry];
		} else {
			this.#entries = [...this.#entries, entry];
		}
	}

	/** Clear all captured errors */
	clear(): void {
		this.#entries = [];
	}

	/**
	 * Register global error handlers on `window`.
	 * Safe to call multiple times — only registers once.
	 * Returns a cleanup function to unregister handlers.
	 */
	init(): () => void {
		if (this.#initialized || typeof window === 'undefined') {
			return () => {};
		}

		this.#onErrorHandler = (event: ErrorEvent) => {
			this.capture(event.message || 'Unknown error', 'error', {
				source: event.filename
					? `${event.filename}:${event.lineno}:${event.colno}`
					: undefined,
				stack: event.error?.stack
			});
		};

		this.#onRejectionHandler = (event: PromiseRejectionEvent) => {
			const reason = event.reason;
			const message =
				reason instanceof Error ? reason.message : String(reason ?? 'Unknown rejection');
			this.capture(message, 'unhandled-rejection', {
				stack: reason instanceof Error ? reason.stack : undefined
			});
		};

		window.addEventListener('error', this.#onErrorHandler);
		window.addEventListener('unhandledrejection', this.#onRejectionHandler);
		this.#initialized = true;

		return () => this.destroy();
	}

	/** Remove global error handlers */
	destroy(): void {
		if (!this.#initialized || typeof window === 'undefined') return;

		if (this.#onErrorHandler) {
			window.removeEventListener('error', this.#onErrorHandler);
			this.#onErrorHandler = null;
		}
		if (this.#onRejectionHandler) {
			window.removeEventListener('unhandledrejection', this.#onRejectionHandler);
			this.#onRejectionHandler = null;
		}

		this.#initialized = false;
	}
}

/** Singleton error monitor instance */
export const errorMonitor = new ErrorMonitorStore();
