import { describe, expect, it } from 'vitest';

const modules = import.meta.glob(
	[
		'/src/lib/stores/bounties.svelte.ts',
		'/src/lib/stores/bounty-detail.svelte.ts',
		'/src/lib/components/bounty/BountyDetailView.svelte',
		'/src/lib/components/search/SearchResults.svelte',
		'/src/routes/profile/[npub]/+page.svelte'
	],
	{ eager: true, import: 'default', query: '?raw' }
) as Record<string, string>;

describe('trusted store projection architecture', () => {
	it('uses the shared projection for both list and detail state', () => {
		const list = modules['/src/lib/stores/bounties.svelte.ts'];
		const detail = modules['/src/lib/stores/bounty-detail.svelte.ts'];
		expect(list).toContain('projectFinancialState');
		expect(detail).toContain('projectFinancialState');
		expect(list).toContain('verifyPledgesForBounty');
		expect(detail).toContain('verifyPledgesForBounty');
		expect(list).not.toMatch(/#pledgeTotals|#completedBounties|#deriveStatus/);
	});

	it('does not let payouts independently select a winner in the detail UI', () => {
		const view = modules['/src/lib/components/bounty/BountyDetailView.svelte'];
		expect(view).toContain("projection.consensus.state === 'unique'");
		expect(view).toContain('projection.votingPowerByPubkey');
		expect(view).not.toContain('detail.payouts[0].solutionId');
		expect(view).not.toContain('tallyVotes(');
	});

	it('uses projected search results and profile activity', () => {
		const search = modules['/src/lib/components/search/SearchResults.svelte'];
		const profile = modules['/src/routes/profile/[npub]/+page.svelte'];
		expect(search).toContain('bountyList.items.filter');
		expect(profile).toContain('projectionRegistry.items');
		expect(profile).toContain('projection.activePledges.filter');
		expect(profile).toContain('projection.validPayouts.filter');
		expect(profile).toContain('projection.solutions.filter');
		expect(profile).not.toContain('parseBountySummary');
	});

	it('hydrates verified cache before starting relay revalidation', () => {
		const list = modules['/src/lib/stores/bounties.svelte.ts'];
		const detail = modules['/src/lib/stores/bounty-detail.svelte.ts'];
		expect(list.indexOf('await loadCachedEvents')).toBeLessThan(
			list.indexOf('createBountyListLoader()')
		);
		expect(detail.indexOf('await loadCachedEvents')).toBeLessThan(
			detail.indexOf('createRelatedEventsLoader(bountyAddress')
		);
	});
});
