import { connectivity } from './connectivity.svelte';

export type BrowserAvailability =
	| { status: 'online' }
	| { status: 'offline'; message: 'Check your network connection, then retry.' };

export type RelayAvailability =
	| { status: 'checking'; connected: 0; total: number }
	| { status: 'unavailable'; connected: 0; total: number }
	| { status: 'partial'; connected: number; total: number }
	| { status: 'ready'; connected: number; total: number };

export type MintAvailability =
	| { status: 'unchecked' }
	| { status: 'checking' }
	| { status: 'ready'; checkedAt: number }
	| { status: 'unavailable'; checkedAt: number };

export type CacheAvailability =
	| { status: 'unknown' }
	| { status: 'fresh'; checkedAt: number }
	| { status: 'stale'; checkedAt: number };

export type PublicationAvailability =
	| { status: 'checking' }
	| { status: 'blocked'; reason: 'browser-offline' | 'relay-unavailable' }
	| { status: 'publishing' }
	| { status: 'failed'; failedAt: number }
	| { status: 'ready' };

type PublicationAttempt = 'idle' | 'publishing' | 'failed' | 'succeeded';

class AvailabilityStore {
	relays = $state<RelayAvailability>({ status: 'checking', connected: 0, total: 0 });
	mint = $state<MintAvailability>({ status: 'unchecked' });
	cache = $state<CacheAvailability>({ status: 'unknown' });
	#publicationAttempt = $state<PublicationAttempt>('idle');
	#publicationFailedAt = $state(0);

	get browser(): BrowserAvailability {
		return connectivity.online
			? { status: 'online' }
			: { status: 'offline', message: 'Check your network connection, then retry.' };
	}

	get publication(): PublicationAvailability {
		if (!connectivity.online) return { status: 'blocked', reason: 'browser-offline' };
		if (this.#publicationAttempt === 'publishing') return { status: 'publishing' };
		if (this.#publicationAttempt === 'failed') {
			return { status: 'failed', failedAt: this.#publicationFailedAt };
		}
		if (this.#publicationAttempt === 'succeeded') return { status: 'ready' };
		if (this.relays.status === 'unavailable') {
			return { status: 'blocked', reason: 'relay-unavailable' };
		}
		if (this.relays.status === 'checking') return { status: 'checking' };
		return { status: 'ready' };
	}

	setRelayCoverage(connected: number, total: number): void {
		const boundedTotal = Math.max(0, total);
		const boundedConnected = Math.max(0, Math.min(connected, boundedTotal));
		if (boundedTotal === 0) {
			this.relays = { status: 'unavailable', connected: 0, total: 0 };
		} else if (boundedConnected === 0) {
			this.relays = { status: 'unavailable', connected: 0, total: boundedTotal };
		} else if (boundedConnected < boundedTotal) {
			this.relays = { status: 'partial', connected: boundedConnected, total: boundedTotal };
		} else {
			this.relays = { status: 'ready', connected: boundedConnected, total: boundedTotal };
		}
	}

	checkingRelays(total = this.relays.total): void {
		this.relays = { status: 'checking', connected: 0, total };
		if (this.#publicationAttempt === 'failed') this.#publicationAttempt = 'idle';
	}

	checkingMint(): void {
		this.mint = { status: 'checking' };
	}

	mintReady(): void {
		this.mint = { status: 'ready', checkedAt: Date.now() };
	}

	mintUnavailable(): void {
		this.mint = { status: 'unavailable', checkedAt: Date.now() };
	}

	setCacheFreshness(stale: boolean): void {
		this.cache = { status: stale ? 'stale' : 'fresh', checkedAt: Date.now() };
	}

	clearCacheFreshness(): void {
		this.cache = { status: 'unknown' };
	}

	publicationStarted(): void {
		this.#publicationAttempt = 'publishing';
	}

	publicationSucceeded(): void {
		this.#publicationAttempt = 'succeeded';
	}

	publicationFailed(): void {
		this.#publicationAttempt = 'failed';
		this.#publicationFailedAt = Date.now();
	}
}

export const availability = new AvailabilityStore();
