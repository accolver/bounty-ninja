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
	import { bountyList } from '$lib/stores/bounties.svelte';
	import { BOUNTY_KIND } from '$lib/bounty/kinds';
	import { nip19 } from 'nostr-tools';
	import SatAmount from '$lib/components/shared/SatAmount.svelte';

	let query = $state('');
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;
	let inputRef = $state<HTMLInputElement | null>(null);
	let listRef = $state<HTMLUListElement | null>(null);

	/** -1 = input focused, 0..n-1 = result index */
	let selectedIndex = $state(-1);

	const trimmedQuery = $derived(query.trim());
	const canSearch = $derived(trimmedQuery.length >= 2);

	/** Filter to only active bounties and enrich with totalPledged from bounty list store */
	const activeResults = $derived.by(() => {
		const now = Math.floor(Date.now() / 1000);
		// Build a lookup of enriched totalPledged from the bounty list store
		const pledgeLookup = new Map(
			bountyList.items.map((t) => [`${t.pubkey}:${t.dTag}`, t.totalPledged])
		);

		return searchStore.results
			.filter((bounty) => {
				// Exclude expired bounties
				if (bounty.deadline !== null && bounty.deadline <= now) return false;
				return true;
			})
			.map((bounty) => {
				const key = `${bounty.pubkey}:${bounty.dTag}`;
				const enrichedPledged = pledgeLookup.get(key) ?? bounty.totalPledged;
				return { ...bounty, totalPledged: enrichedPledged };
			});
	});

	// Reset selection when results change
	$effect(() => {
		activeResults;
		selectedIndex = -1;
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

	function navigateToTask(pubkey: string, dTag: string) {
		const naddr = nip19.naddrEncode({
			identifier: dTag,
			pubkey,
			kind: BOUNTY_KIND
		});
		searchDialog.open = false;
		goto(`/bounty/${naddr}`);
	}

	function navigateToSelected() {
		if (selectedIndex >= 0 && selectedIndex < activeResults.length) {
			const result = activeResults[selectedIndex];
			navigateToTask(result.pubkey, result.dTag);
		}
	}

	function scrollSelectedIntoView() {
		if (selectedIndex < 0 || !listRef) return;
		const item = listRef.children[selectedIndex] as HTMLElement | undefined;
		item?.scrollIntoView({ block: 'nearest' });
	}

	/**
	 * Unified keydown handler for the entire dialog.
	 * Captures Tab/Shift+Tab to cycle through results,
	 * Enter/Space to activate the selected result.
	 */
	function handleDialogKeydown(e: KeyboardEvent) {
		const count = activeResults.length;

		if (e.key === 'Tab' && count > 0) {
			e.preventDefault();
			if (e.shiftKey) {
				// Shift+Tab: move up, loop to last from input
				if (selectedIndex <= 0) {
					selectedIndex = count - 1;
				} else {
					selectedIndex--;
				}
			} else {
				// Tab: move down, loop to input from last
				if (selectedIndex >= count - 1) {
					selectedIndex = -1;
					inputRef?.focus();
					return;
				} else {
					selectedIndex++;
				}
			}
			scrollSelectedIntoView();
			return;
		}

		if (e.key === 'Escape') {
			// Let bits-ui Dialog handle Escape to close
			return;
		}

		// When input is focused, Enter goes to full search page
		if (selectedIndex === -1 && e.key === 'Enter') {
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
			return;
		}

		// When a result is selected, Enter/Space navigates to it
		if (selectedIndex >= 0 && (e.key === 'Enter' || e.key === ' ')) {
			e.preventDefault();
			navigateToSelected();
			return;
		}

		// ArrowDown/ArrowUp as alternative navigation
		if (e.key === 'ArrowDown' && count > 0) {
			e.preventDefault();
			selectedIndex = selectedIndex >= count - 1 ? 0 : selectedIndex + 1;
			scrollSelectedIntoView();
			return;
		}

		if (e.key === 'ArrowUp' && count > 0) {
			e.preventDefault();
			selectedIndex = selectedIndex <= 0 ? count - 1 : selectedIndex - 1;
			scrollSelectedIntoView();
			return;
		}
	}

	function close() {
		searchDialog.open = false;
	}

	$effect(() => {
		if (searchDialog.open) {
			query = '';
			selectedIndex = -1;
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
					<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
					<div
						{...props}
						onkeydown={handleDialogKeydown}
						transition:scale={{ duration: 150, start: 0.98, easing: cubicOut }}
						class="fixed left-1/2 top-[12%] z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2
							rounded-xl bg-card shadow-2xl"
					>
						<Dialog.Title class="sr-only">Search bounties</Dialog.Title>

						<!-- Search input -->
						<div class="flex items-center gap-3 px-4">
							<SearchIcon class="size-4 shrink-0 text-muted-foreground" />
							<input
								bind:this={inputRef}
								type="text"
								bind:value={query}
								oninput={handleInput}
								onfocus={() => (selectedIndex = -1)}
								placeholder="Search bounties..."
								style="outline: none; box-shadow: none;"
								class="h-11 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground"
							/>
							<button
								type="button"
								onclick={close}
								tabindex={-1}
								class="shrink-0 cursor-pointer rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
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
									{:else if activeResults.length === 0 && searchStore.loading}
										<div class="flex items-center justify-center py-6">
											<LoaderIcon class="size-5 animate-spin text-muted-foreground" />
										</div>
									{:else if activeResults.length === 0}
										<p class="py-6 text-center text-sm text-muted-foreground">
											No active bounties found
										</p>
									{:else}
										<ul bind:this={listRef} role="listbox" aria-label="Search results">
											{#each activeResults as result, i (result.id)}
												<li
													role="option"
													aria-selected={i === selectedIndex}
												>
													<button
														type="button"
														tabindex={-1}
														class="flex w-full cursor-pointer items-center gap-4 border-b border-border/50 px-4 py-2.5 text-left text-sm transition-colors last:border-b-0 hover:bg-muted/30 {i === selectedIndex ? 'bg-muted/30' : ''}"
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
