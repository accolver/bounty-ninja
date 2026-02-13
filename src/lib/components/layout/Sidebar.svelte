<script lang="ts">
	import { bountyList } from '$lib/stores/bounties.svelte';

	let { selectedTag = $bindable('') }: { selectedTag?: string } = $props();

	const tagCounts = $derived.by(() => {
		const counts = new Map<string, number>();
		for (const item of bountyList.items) {
			for (const tag of item.tags) {
				counts.set(tag, (counts.get(tag) ?? 0) + 1);
			}
		}
		return counts;
	});

	const popularTags = $derived([...tagCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10));
</script>

<aside class="hidden w-64 shrink-0 space-y-6 lg:block" aria-label="Category filter">
	<div class="space-y-2">
		<h3 class="text-xs font-medium uppercase tracking-wider text-muted-foreground">Categories</h3>
		<ul class="space-y-0.5">
			<li>
				<button
					type="button"
					class="w-full cursor-pointer rounded-md px-3 py-1.5 text-left text-sm transition-colors
						{selectedTag === '' ? 'bg-primary/10 font-medium text-primary' : 'text-foreground hover:bg-muted'}"
					onclick={() => (selectedTag = '')}
				>
					All
				</button>
			</li>
			{#each popularTags as [tag, count]}
				<li>
					<button
						type="button"
						class="flex w-full cursor-pointer items-center justify-between rounded-md px-3 py-1.5 text-left text-sm transition-colors
							{selectedTag === tag ? 'bg-primary/10 font-medium text-primary' : 'text-foreground hover:bg-muted'}"
						onclick={() => (selectedTag = tag)}
					>
						<span>{tag}</span>
						<span class="text-xs text-muted-foreground">{count}</span>
					</button>
				</li>
			{/each}
		</ul>
	</div>
</aside>
