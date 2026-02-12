<script lang="ts">
	import type { Solution, Vote } from '$lib/task/types';
	import SolutionItem from './SolutionItem.svelte';
	import EmptyState from '$lib/components/shared/EmptyState.svelte';

	const {
		solutions,
		votesBySolution
	}: {
		solutions: Solution[];
		votesBySolution?: Map<string, Vote[]>;
	} = $props();
</script>

{#if solutions.length === 0}
	<EmptyState message="No solutions submitted yet." />
{:else}
	<ul class="space-y-3" aria-label="Solution list">
		{#each solutions as solution (solution.id)}
			<SolutionItem {solution} votes={votesBySolution?.get(solution.id)} />
		{/each}
	</ul>
{/if}
