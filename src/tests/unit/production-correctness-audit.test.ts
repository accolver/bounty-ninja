import { describe, expect, it } from 'vitest';

const modules = import.meta.glob(
	[
		'/src/lib/stores/bounties.svelte.ts',
		'/src/lib/stores/bounty-detail.svelte.ts',
		'/src/lib/nostr/cache.ts',
		'/src/routes/+page.svelte',
		'/src/routes/bounty/[naddr]/+page.svelte',
		'/src/routes/profile/[npub]/+page.svelte'
	],
	{ eager: true, import: 'default', query: '?raw' }
) as Record<string, string>;

describe('production correctness audit regressions', () => {
	it('keeps feed completeness address-scoped and refreshes time-derived projections', () => {
		const list = modules['/src/lib/stores/bounties.svelte.ts'];
		expect(list).toContain('createRelatedEventsLoader(address');
		expect(list).not.toMatch(/kinds: \[PLEDGE_KIND[^}]+limit: 500/s);
		expect(list).toContain("document.addEventListener('visibilitychange'");
		expect(list).toContain('#scheduleFreshnessRefresh');
	});

	it('refreshes and resets detail state when a route parameter is reused', () => {
		const detail = modules['/src/lib/stores/bounty-detail.svelte.ts'];
		expect(detail).toContain('this.#bounty = null');
		expect(detail).toContain("document.addEventListener('visibilitychange'");
		expect(detail).toContain('#scheduleFreshnessRefresh');
	});

	it('resets profile state and global loading state during route teardown', () => {
		const profile = modules['/src/routes/profile/[npub]/+page.svelte'];
		expect(profile).toContain('profile = null');
		expect(profile).toContain('loading = true');
		for (const route of [
			modules['/src/routes/+page.svelte'],
			modules['/src/routes/bounty/[naddr]/+page.svelte'],
			profile
		]) {
			expect(route).toContain('pageLoading.active = false');
		}
	});

	it('clears both persisted and in-memory public cache state', () => {
		const cache = modules['/src/lib/nostr/cache.ts'];
		expect(cache).toContain('eventStore.removeByFilters([{}])');
		expect(cache).toContain('await deleteDatabase(databaseName)');
		expect(cache).toContain('emergencyEviction');
	});
});
