import { getCacheEventCount, estimateCacheSize } from './cache-eviction';

/**
 * Format bytes into a human-readable string.
 * Examples: "1.2 KB", "3.4 MB", "567 B"
 */
function formatBytes(bytes: number): string {
	if (bytes === 0) return '0 B';

	const units = ['B', 'KB', 'MB', 'GB'];
	const k = 1024;
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	const unitIndex = Math.min(i, units.length - 1);
	const value = bytes / Math.pow(k, unitIndex);

	return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

/**
 * Reactive cache monitor store using Svelte 5 runes.
 * Tracks event count and estimated cache size with periodic refresh.
 */
class CacheMonitor {
	/** Number of events currently in the IndexedDB cache */
	eventCount = $state(0);

	/** Estimated cache size in bytes */
	estimatedSizeBytes = $state(0);

	/** Human-readable formatted cache size */
	get estimatedSizeFormatted(): string {
		return formatBytes(this.estimatedSizeBytes);
	}

	/** Whether a refresh is currently in progress */
	refreshing = $state(false);

	/** Interval ID for periodic refresh */
	private intervalId: ReturnType<typeof setInterval> | null = null;

	/**
	 * Refresh cache statistics by querying IndexedDB.
	 * Non-blocking — updates reactive state when complete.
	 */
	async refresh(): Promise<void> {
		if (this.refreshing) return;
		this.refreshing = true;

		try {
			const [count, size] = await Promise.all([getCacheEventCount(), estimateCacheSize()]);

			this.eventCount = count;
			this.estimatedSizeBytes = size;
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			console.warn(`[cache-monitor] Failed to refresh stats: ${message}`);
		} finally {
			this.refreshing = false;
		}
	}

	/**
	 * Start periodic refresh of cache statistics.
	 *
	 * @param intervalMs - Refresh interval in milliseconds (default: 60s)
	 */
	startMonitoring(intervalMs: number = 60_000): void {
		this.stopMonitoring();

		// Initial refresh
		void this.refresh();

		this.intervalId = setInterval(() => {
			void this.refresh();
		}, intervalMs);
	}

	/**
	 * Stop periodic refresh.
	 */
	stopMonitoring(): void {
		if (this.intervalId !== null) {
			clearInterval(this.intervalId);
			this.intervalId = null;
		}
	}

	/**
	 * Clean up resources. Call when the monitor is no longer needed.
	 */
	destroy(): void {
		this.stopMonitoring();
	}
}

/** Singleton cache monitor instance */
export const cacheMonitor = new CacheMonitor();
