<script lang="ts">
	const {
		suggestedTags,
		onaccept,
		ondismiss
	}: {
		suggestedTags: string[];
		onaccept: (tag: string) => void;
		ondismiss: (tag: string) => void;
	} = $props();
</script>

{#if suggestedTags.length > 0}
	<div class="flex flex-col gap-1.5">
		<p class="text-xs font-medium text-muted-foreground">Suggested tags</p>
		<ul class="flex flex-wrap gap-1.5" role="list" aria-label="Suggested tags">
			{#each suggestedTags as tag (tag)}
				<li>
					<span
						class="inline-flex items-center gap-1 rounded-full border border-dashed border-border bg-muted/50 px-2.5 py-0.5 text-xs text-muted-foreground"
					>
						{tag}
						<button
							type="button"
							onclick={() => onaccept(tag)}
							class="ml-0.5 rounded-full p-0.5 text-primary transition-colors hover:bg-primary/20 focus-visible:ring-1 focus-visible:ring-ring"
							aria-label="Accept suggested tag {tag}"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								viewBox="0 0 16 16"
								fill="currentColor"
								class="h-3 w-3"
								aria-hidden="true"
							>
								<path
									d="M8.75 3.75a.75.75 0 0 0-1.5 0v3.5h-3.5a.75.75 0 0 0 0 1.5h3.5v3.5a.75.75 0 0 0 1.5 0v-3.5h3.5a.75.75 0 0 0 0-1.5h-3.5v-3.5Z"
								/>
							</svg>
						</button>
						<button
							type="button"
							onclick={() => ondismiss(tag)}
							class="rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-destructive/20 hover:text-destructive focus-visible:ring-1 focus-visible:ring-ring"
							aria-label="Dismiss suggested tag {tag}"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								viewBox="0 0 16 16"
								fill="currentColor"
								class="h-3 w-3"
								aria-hidden="true"
							>
								<path
									d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z"
								/>
							</svg>
						</button>
					</span>
				</li>
			{/each}
		</ul>
	</div>
{/if}
