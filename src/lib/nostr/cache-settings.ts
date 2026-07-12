import { config, storageKey } from '$lib/config';
import type { CacheEvictionConfig } from './cache-eviction';

export interface CacheLimits {
	maxEvents: number;
	maxAgeDays: number;
}

export const CACHE_LIMITS_KEY = storageKey('cache-limits');
export const DEFAULT_CACHE_LIMITS: CacheLimits = { ...config.cache };

export function loadCacheLimits(): CacheLimits {
	try {
		const parsed = JSON.parse(localStorage.getItem(CACHE_LIMITS_KEY) ?? '') as Partial<CacheLimits>;
		if (
			Number.isInteger(parsed.maxEvents) &&
			parsed.maxEvents! >= 1_000 &&
			parsed.maxEvents! <= 100_000 &&
			Number.isInteger(parsed.maxAgeDays) &&
			parsed.maxAgeDays! >= 1 &&
			parsed.maxAgeDays! <= 365
		) {
			return { maxEvents: parsed.maxEvents!, maxAgeDays: parsed.maxAgeDays! };
		}
	} catch {
		// Use safe defaults when storage is unavailable or malformed.
	}
	return { ...DEFAULT_CACHE_LIMITS };
}

export function saveCacheLimits(limits: CacheLimits): void {
	localStorage.setItem(CACHE_LIMITS_KEY, JSON.stringify(limits));
}

export function getSavedEvictionConfig(): Pick<CacheEvictionConfig, 'maxEvents' | 'maxAgeMs'> {
	const limits = loadCacheLimits();
	return {
		maxEvents: limits.maxEvents,
		maxAgeMs: limits.maxAgeDays * 24 * 60 * 60 * 1000
	};
}
