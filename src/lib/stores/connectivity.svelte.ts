/**
 * Reactive connectivity store using Svelte 5 runes.
 * Tracks browser online/offline status for offline-aware UI.
 */
class ConnectivityStore {
	online = $state(typeof navigator !== 'undefined' ? navigator.onLine : true);

	constructor() {
		if (typeof window !== 'undefined') {
			window.addEventListener('online', () => {
				this.online = true;
			});
			window.addEventListener('offline', () => {
				this.online = false;
			});
		}
	}
}

export const connectivity = new ConnectivityStore();
