/**
 * Reactive toast notification store.
 * Singleton class-based store using Svelte 5 runes for a toast queue.
 */

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
	id: string;
	message: string;
	type: ToastType;
	duration: number;
}

/** Maximum number of simultaneous toasts displayed */
const MAX_TOASTS = 5;

/** Default auto-dismiss duration in milliseconds */
const DEFAULT_DURATION = 5000;

class ToastStore {
	#toasts = $state<Toast[]>([]);

	/** Current list of active toasts */
	get toasts(): Toast[] {
		return this.#toasts;
	}

	/**
	 * Add a toast notification to the queue.
	 * If the queue exceeds MAX_TOASTS, the oldest toast is removed.
	 * @returns The toast ID for programmatic dismissal
	 */
	add(message: string, type: ToastType = 'info', duration = DEFAULT_DURATION): string {
		const id = crypto.randomUUID();
		const toast: Toast = { id, message, type, duration };

		// Evict oldest toast if at capacity
		if (this.#toasts.length >= MAX_TOASTS) {
			this.#toasts = this.#toasts.slice(1);
		}

		this.#toasts = [...this.#toasts, toast];

		// Auto-dismiss after duration
		setTimeout(() => this.dismiss(id), duration);

		return id;
	}

	/** Remove a toast by ID */
	dismiss(id: string): void {
		this.#toasts = this.#toasts.filter((t) => t.id !== id);
	}

	/** Clear all toasts */
	clear(): void {
		this.#toasts = [];
	}

	// Convenience methods
	success(message: string, duration?: number): string {
		return this.add(message, 'success', duration);
	}

	error(message: string, duration?: number): string {
		return this.add(message, 'error', duration);
	}

	warning(message: string, duration?: number): string {
		return this.add(message, 'warning', duration);
	}

	info(message: string, duration?: number): string {
		return this.add(message, 'info', duration);
	}
}

/** Singleton toast store instance */
export const toastStore = new ToastStore();
