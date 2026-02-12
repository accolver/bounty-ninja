<script lang="ts">
	const { tags }: { tags: string[] } = $props();
</script>

{#if tags.length > 0}
	<ul class="flex flex-wrap gap-1.5" aria-label="Task tags">
		{#each tags as tag (tag)}
			<li>
				<span class="inline-block rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
					{tag}
				</span>
			</li>
		{/each}
	</ul>
{/if}
