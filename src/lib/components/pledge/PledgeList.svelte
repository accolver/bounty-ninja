<script lang="ts">
	import type { Pledge } from '$lib/task/types';
	import PledgeItem from './PledgeItem.svelte';
	import EmptyState from '$lib/components/shared/EmptyState.svelte';

	const { pledges }: { pledges: Pledge[] } = $props();
</script>

{#if pledges.length === 0}
	<EmptyState message="No pledges yet. Be the first to fund this task!" />
{:else}
	<ul class="space-y-2" aria-label="Pledge list">
		{#each pledges as pledge (pledge.id)}
			<PledgeItem {pledge} />
		{/each}
	</ul>
{/if}
