<script lang="ts">
	import { bountyList } from '$lib/stores/bounties.svelte';
	import BountyListItem from '$lib/components/bounty/BountyListItem.svelte';
	import LoadingSpinner from '$lib/components/shared/LoadingSpinner.svelte';
	import EmptyState from '$lib/components/shared/EmptyState.svelte';
	import ErrorBoundary from '$lib/components/shared/ErrorBoundary.svelte';
	import Sidebar from '$lib/components/layout/Sidebar.svelte';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { Slider } from '$lib/components/ui/slider';
	import ArrowUpDown from '@lucide/svelte/icons/arrow-up-down';
	import ListFilter from '@lucide/svelte/icons/list-filter';
	import Plus from '@lucide/svelte/icons/plus';
	import Zap from '@lucide/svelte/icons/zap';
	import Clock from '@lucide/svelte/icons/clock';
	import Target from '@lucide/svelte/icons/target';
	import { fly } from 'svelte/transition';
	import { flip } from 'svelte/animate';
	import type { BountySummary, BountyStatus } from '$lib/bounty/types';

	// Start bounty list subscriptions when the page mounts (idempotent)
	$effect(() => {
		bountyList.init();
	});

	// Animations only play after a user-initiated filter/sort change,
	// not during the initial relay data stream.
	let animate = $state(false);

	let selectedTag = $state('');
	let sortBy = $state<'reward' | 'newest' | 'solutions'>('reward');

	// Status filter — prechecked with Open + In Review
	let showOpen = $state(true);
	let showInReview = $state(true);
	let showCompleted = $state(false);
	let showExpired = $state(false);

	const activeStatusCount = $derived(
		[showOpen, showInReview, showCompleted, showExpired].filter(Boolean).length
	);

	const statusFilters = $derived.by(() => {
		const set = new Set<BountyStatus>();
		if (showOpen) set.add('open');
		if (showInReview) set.add('in_review');
		if (showCompleted) set.add('completed');
		if (showExpired) set.add('expired');
		return set;
	});

	// Enable animations only after the user changes a filter/sort control,
	// not while relay data is still streaming in on initial load.
	let effectRan = false;
	$effect(() => {
		void [selectedTag, sortBy, showOpen, showInReview, showCompleted, showExpired, minSats];
		if (!effectRan) {
			effectRan = true;
			return;
		}
		animate = true;
	});

	// Sats slider — minimum pledge threshold
	let minSats = $state(0);

	// Compute the max pledge across all items for the slider range
	const maxPledge = $derived(
		Math.max(1000, ...bountyList.items.map((t) => t.totalPledged))
	);

	// Round up to a nice number for the slider max
	const sliderMax = $derived.by(() => {
		const raw = maxPledge;
		if (raw <= 10_000) return 10_000;
		if (raw <= 100_000) return 100_000;
		if (raw <= 500_000) return 500_000;
		return Math.ceil(raw / 100_000) * 100_000;
	});

	const sortFns: Record<string, (a: BountySummary, b: BountySummary) => number> = {
		reward: (a, b) => b.totalPledged - a.totalPledged,
		newest: (a, b) => b.createdAt - a.createdAt,
		solutions: (a, b) => b.solutionCount - a.solutionCount
	};

	const filteredBounties = $derived.by(() => {
		const statuses = statusFilters;
		return bountyList.items
			.filter((t: BountySummary) => statuses.has(t.status))
			.filter((t: BountySummary) => !selectedTag || t.tags.includes(selectedTag))
			.filter((t: BountySummary) => t.totalPledged >= minSats)
			.sort(sortFns[sortBy]);
	});

	// Stats derived from all bounties (unfiltered)
	const now24h = $derived(Math.floor(Date.now() / 1000) - 86_400);

	const recentCount = $derived(
		bountyList.items.filter((b) => b.createdAt >= now24h).length
	);

	const openBounties = $derived(
		bountyList.items.filter((b) => b.status === 'open' || b.status === 'in_review')
	);

	const totalSatsAvailable = $derived(
		openBounties.reduce((sum, b) => sum + b.totalPledged, 0)
	);

	function formatSats(n: number): string {
		if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
		if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
		return String(n);
	}
</script>

<svelte:head>
	<title>Bounty.ninja - Decentralized Bounty Board</title>
</svelte:head>

<ErrorBoundary>
	<div class="flex gap-8">
		<Sidebar bind:selectedTag />

		<section class="min-w-0 flex-1">
			<!-- Stats bar + CTA -->
			{#if !bountyList.loading || bountyList.items.length > 0}
				<div class="flex items-center justify-between gap-4 px-4 pb-6">
					<div class="flex items-center gap-5">
						<div class="flex items-center gap-1.5 text-xs text-muted-foreground">
							<Clock class="h-3.5 w-3.5 text-primary/70" />
							<span class="font-medium text-foreground">{recentCount}</span>
							<span>new today</span>
						</div>
						<div class="flex items-center gap-1.5 text-xs text-muted-foreground">
							<Target class="h-3.5 w-3.5 text-primary/70" />
							<span class="font-medium text-foreground">{openBounties.length}</span>
							<span>active</span>
						</div>
						<div class="flex items-center gap-1.5 text-xs text-muted-foreground">
							<Zap class="h-3.5 w-3.5 text-amber-500" />
							<span class="font-medium text-foreground">{formatSats(totalSatsAvailable)}</span>
							<span>sats available</span>
						</div>
					</div>
					<a
						href="/bounty/new"
						class="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
					>
						<Plus class="h-3.5 w-3.5" />
						Post a Bounty
					</a>
				</div>
			{/if}

			<!-- List header with filters -->
			<div class="flex flex-col gap-3 border-b border-border px-4 pb-3">
				<div class="flex items-center justify-between">
					<h2 class="text-sm font-medium text-foreground">
						{selectedTag ? selectedTag : 'All bounties'}
					</h2>
					<div class="relative">
						<label for="sort-select" class="sr-only">Sort by</label>
						<select
							id="sort-select"
							bind:value={sortBy}
							class="appearance-none bg-transparent pr-6 pl-2 py-1 text-xs text-muted-foreground
								cursor-pointer hover:text-foreground transition-colors
								focus-visible:ring-2 focus-visible:ring-ring rounded"
						>
							<option value="reward">Reward</option>
							<option value="newest">Newest</option>
							<option value="solutions">Solutions</option>
						</select>
						<ArrowUpDown class="pointer-events-none absolute right-0 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
					</div>
				</div>

				<!-- Filter row -->
				<div class="flex items-center gap-3">
					<!-- Status dropdown -->
					<DropdownMenu.Root>
						<DropdownMenu.Trigger>
							{#snippet child({ props })}
								<button
									{...props}
									class="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs text-muted-foreground shadow-xs transition-colors hover:border-primary/40 hover:text-foreground"
								>
									<ListFilter class="h-3.5 w-3.5" />
									Status
									{#if activeStatusCount < 4}
										<span class="ml-0.5 rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary">
											{activeStatusCount}
										</span>
									{/if}
								</button>
							{/snippet}
						</DropdownMenu.Trigger>
						<DropdownMenu.Content class="w-44">
							<DropdownMenu.Label>Filter by status</DropdownMenu.Label>
							<DropdownMenu.Separator />
							<DropdownMenu.CheckboxItem bind:checked={showOpen}>
								Open
							</DropdownMenu.CheckboxItem>
							<DropdownMenu.CheckboxItem bind:checked={showInReview}>
								In Review
							</DropdownMenu.CheckboxItem>
							<DropdownMenu.CheckboxItem bind:checked={showCompleted}>
								Completed
							</DropdownMenu.CheckboxItem>
							<DropdownMenu.CheckboxItem bind:checked={showExpired}>
								Expired
							</DropdownMenu.CheckboxItem>
						</DropdownMenu.Content>
					</DropdownMenu.Root>

					<!-- Sats slider -->
					<div class="flex items-center gap-3">
						<span class="text-xs text-muted-foreground whitespace-nowrap">Min sats</span>
						<Slider
							bind:value={minSats}
							max={sliderMax}
							step={1000}
							class="w-28"
							aria-label="Minimum sats filter"
						/>
						<span class="text-xs font-medium tabular-nums text-foreground w-10">
							{formatSats(minSats)}
						</span>
					</div>
				</div>
			</div>

			<!-- Bounty list -->
			{#if bountyList.loading && bountyList.items.length === 0}
				<div class="flex items-center justify-center py-12">
					<LoadingSpinner size="lg" />
				</div>
			{:else if bountyList.error}
				<div class="rounded-lg border border-destructive/50 bg-destructive/10 p-8 text-center">
					<p class="text-sm text-destructive">{bountyList.error}</p>
				</div>
			{:else if filteredBounties.length === 0}
				<EmptyState
					message={selectedTag
						? `No bounties found for "${selectedTag}". Try a different category.`
						: 'No bounties match the current filters.'}
				/>
			{:else}
				<div>
					{#each filteredBounties as bounty (bounty.id)}
						<div
							animate:flip={{ duration: animate ? 250 : 0 }}
							out:fly={{ y: -10, duration: animate ? 150 : 0 }}
						>
							<BountyListItem {bounty} />
						</div>
					{/each}
				</div>
			{/if}
		</section>
	</div>
</ErrorBoundary>
