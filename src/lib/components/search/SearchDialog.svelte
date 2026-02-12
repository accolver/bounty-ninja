<script lang="ts">
	import { goto } from '$app/navigation';
	import { Dialog } from 'bits-ui';
	import { fade, scale } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import SearchIcon from '@lucide/svelte/icons/search';
	import LoaderIcon from '@lucide/svelte/icons/loader';
	import XIcon from '@lucide/svelte/icons/x';
	import { searchStore } from '$lib/stores/search.svelte';
	import { searchDialog } from '$lib/stores/search-dialog.svelte';
	import { taskList } from '$lib/stores/tasks.svelte';
	import { TASK_KIND } from '$lib/task/kinds';
	import { nip19 } from 'nostr-tools';
	import SatAmount from '$lib/components/shared/SatAmount.svelte';

	let query = $state('');
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;
	let inputRef = $state<HTMLInputElement | null>(null);

	const trimmedQuery = $derived(query.trim());
	const canSearch = $derived(trimmedQuery.length >= 2);

	/** Filter to only active tasks and enrich with totalPledged from task list store */
	const activeResults = $derived.by(() => {
		const now = Math.floor(Date.now() / 1000);
		// Build a lookup of enriched totalPledged from the task list store
		const pledgeLookup = new Map(
			taskList.items.map((t) => [`${t.pubkey}:${t.dTag}`, t.totalPledged])
		);

		return searchStore.results
			.filter((task) => {
				// Exclude expired tasks
				if (task.deadline !== null && task.deadline <= now) return false;
				return true;
			})
			.map((task) => {
				const key = `${task.pubkey}:${task.dTag}`;
				const enrichedPledged = pledgeLookup.get(key) ?? task.totalPledged;
				return { ...task, totalPledged: enrichedPledged };
			});
	});

	/** Compute days since creation */
	function daysActive(createdAt: number): string {
		const now = Math.floor(Date.now() / 1000);
		const days = Math.floor((now - createdAt) / 86400);
		if (days === 0) return 'today';
		if (days === 1) return '1 day';
		return `${days} days`;
	}

	function handleInput() {
		if (debounceTimer) clearTimeout(debounceTimer);
		if (!canSearch) {
			searchStore.clear();
			return;
		}
		debounceTimer = setTimeout(() => {
			searchStore.search(query);
		}, 250);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			if (debounceTimer) {
				clearTimeout(debounceTimer);
				debounceTimer = null;
			}
			const trimmed = query.trim();
			if (trimmed) {
				searchDialog.open = false;
				goto(`/search?q=${encodeURIComponent(trimmed)}`);
			}
		}
	}

	function navigateToTask(pubkey: string, dTag: string) {
		const naddr = nip19.naddrEncode({
			identifier: dTag,
			pubkey,
			kind: TASK_KIND
		});
		searchDialog.open = false;
		goto(`/task/${naddr}`);
	}

	function close() {
		searchDialog.open = false;
	}

	$effect(() => {
		if (searchDialog.open) {
			query = '';
			searchStore.clear();
			requestAnimationFrame(() => {
				inputRef?.focus();
			});
		} else {
			if (debounceTimer) {
				clearTimeout(debounceTimer);
				debounceTimer = null;
			}
		}
	});

	function handleGlobalKeydown(e: KeyboardEvent) {
		if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
			e.preventDefault();
			searchDialog.toggle();
		}
	}
</script>

<svelte:window onkeydown={handleGlobalKeydown} />

<Dialog.Root bind:open={searchDialog.open}>
	<Dialog.Portal>
		<!-- Overlay -->
		<Dialog.Overlay forceMount>
			{#snippet child({ props, open })}
				{#if open}
					<div
						{...props}
						transition:fade={{ duration: 150 }}
						class="fixed inset-0 z-50 bg-black/50"
					></div>
				{/if}
			{/snippet}
		</Dialog.Overlay>

		<!-- Content -->
		<Dialog.Content forceMount>
			{#snippet child({ props, open })}
				{#if open}
					<div
						{...props}
						transition:scale={{ duration: 150, start: 0.98, easing: cubicOut }}
						class="fixed left-1/2 top-[12%] z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2
							rounded-xl bg-card shadow-2xl"
					>
						<Dialog.Title class="sr-only">Search tasks</Dialog.Title>

						<!-- Search input -->
						<div class="flex items-center gap-3 px-4">
							<SearchIcon class="size-4 shrink-0 text-muted-foreground" />
							<input
								bind:this={inputRef}
								type="text"
								bind:value={query}
								oninput={handleInput}
								onkeydown={handleKeydown}
								placeholder="Search tasks..."
								style="outline: none; box-shadow: none;"
								class="h-11 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground"
							/>
							<button
								type="button"
								onclick={close}
								class="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
								aria-label="Close search"
							>
								<XIcon class="size-4" />
							</button>
						</div>

						<!-- Divider + results -->
						{#if trimmedQuery}
							<div class="border-t border-border">
								<div class="max-h-[320px] overflow-y-auto">
									{#if !canSearch}
										<p class="py-6 text-center text-sm text-muted-foreground">
											Type at least 2 characters to search
										</p>
									{:else if searchStore.error}
										<p class="py-6 text-center text-sm text-destructive">
											{searchStore.error}
										</p>
									{:else if searchStore.loading}
										<div class="flex items-center justify-center py-6">
											<LoaderIcon class="size-5 animate-spin text-muted-foreground" />
										</div>
									{:else if activeResults.length === 0}
										<p class="py-6 text-center text-sm text-muted-foreground">
											No active tasks found
										</p>
									{:else}
										<ul role="listbox" aria-label="Search results">
											{#each activeResults as result (result.id)}
												<li role="option" aria-selected="false">
													<button
														type="button"
														class="flex w-full items-center gap-4 border-b border-border/50 px-4 py-2.5 text-left text-sm transition-colors last:border-b-0 hover:bg-muted/30"
														onclick={() => navigateToTask(result.pubkey, result.dTag)}
													>
														<span class="min-w-0 flex-1 truncate text-foreground">
															{result.title}
														</span>
														<span class="shrink-0 text-xs tabular-nums text-muted-foreground">
															<SatAmount amount={result.totalPledged} />
														</span>
														<span class="shrink-0 text-xs text-muted-foreground">
															{daysActive(result.createdAt)}
														</span>
													</button>
												</li>
											{/each}
										</ul>
									{/if}
								</div>
							</div>
						{/if}
					</div>
				{/if}
			{/snippet}
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
