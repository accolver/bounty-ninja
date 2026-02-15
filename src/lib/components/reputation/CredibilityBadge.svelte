<script lang="ts">
	import { reputationStore } from '$lib/stores/reputation.svelte';
	import Tooltip from '$lib/components/shared/Tooltip.svelte';

	const {
		pubkey,
		size = 'sm'
	}: {
		/** Hex-encoded Nostr public key */
		pubkey: string;
		/** Badge size */
		size?: 'sm' | 'md';
	} = $props();

	const score = $derived(reputationStore.getReputation(pubkey));

	const tierConfig = $derived.by(() => {
		if (!score) return null;
		switch (score.tier) {
			case 'emerging':
				return { icon: '🌱', label: 'Emerging' };
			case 'established':
				return { icon: '✅', label: 'Established' };
			case 'trusted':
				return { icon: '⭐', label: 'Trusted' };
			case 'flagged':
				return { icon: '⚠️', label: 'Flagged' };
			default:
				return null; // 'new' tier shows no badge
		}
	});

	const tooltipText = $derived.by(() => {
		if (!score || !tierConfig) return '';
		const parts = [tierConfig.label];
		if (score.bountiesCompleted > 0) parts.push(`${score.bountiesCompleted} bounties completed`);
		if (score.solutionsAccepted > 0) parts.push(`${score.solutionsAccepted} solutions accepted`);
		if (score.totalPledges > 0) parts.push(`${Math.round(score.releaseRate * 100)}% release rate`);
		if (score.bountyRetractions > 0) parts.push(`${score.bountyRetractions} bounty retractions`);
		if (score.pledgeRetractions > 0) parts.push(`${score.pledgeRetractions} pledge retractions`);
		return parts.join(' — ');
	});

	const sizeClass = $derived(size === 'md' ? 'text-base' : 'text-sm');
</script>

{#if tierConfig}
	<Tooltip text={tooltipText}>
		{#snippet children()}
			<span class="inline-flex items-center {sizeClass}" aria-label="{tierConfig.label} reputation">
				{tierConfig.icon}
			</span>
		{/snippet}
	</Tooltip>
{/if}
