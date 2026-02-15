/**
 * Currency display preference store.
 *
 * Manages user preference for displaying amounts in USD or sats.
 * Persisted to localStorage. Default: 'usd'.
 *
 * Also triggers BTC price fetches when USD mode is active.
 *
 * Uses Svelte 5 runes (class-based singleton pattern).
 */

import { storageKey } from '$lib/config';
import { btcPrice } from '$lib/services/btc-price.svelte';

// ── Types ───────────────────────────────────────────────────────────────────

export type CurrencyDisplay = 'usd' | 'sats';

// ── Constants ───────────────────────────────────────────────────────────────

const CURRENCY_KEY = storageKey('currency-display');

// ── CurrencyStore Class ─────────────────────────────────────────────────────

class CurrencyStore {
	#display = $state<CurrencyDisplay>('usd');

	constructor() {
		try {
			const saved = localStorage.getItem(CURRENCY_KEY);
			if (saved === 'usd' || saved === 'sats') {
				this.#display = saved;
			}
		} catch {
			// localStorage unavailable — keep default
		}
	}

	/** Current display preference. */
	get display(): CurrencyDisplay {
		return this.#display;
	}

	/** Whether currently showing USD. */
	get isUsd(): boolean {
		return this.#display === 'usd';
	}

	/** Whether currently showing sats. */
	get isSats(): boolean {
		return this.#display === 'sats';
	}

	/** Set the display preference and persist it. */
	set(value: CurrencyDisplay): void {
		this.#display = value;
		try {
			localStorage.setItem(CURRENCY_KEY, value);
		} catch {
			// Storage full — non-critical
		}

		// Trigger a price fetch when switching to USD
		if (value === 'usd') {
			btcPrice.fetch();
		}
	}

	/** Toggle between USD and sats. */
	toggle(): void {
		this.set(this.#display === 'usd' ? 'sats' : 'usd');
	}
}

// ── Singleton Export ────────────────────────────────────────────────────────

export const currencyStore = new CurrencyStore();
