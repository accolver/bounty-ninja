<script lang="ts">
	import { taskList } from '$lib/stores/tasks.svelte';
	import TaskListItem from '$lib/components/task/TaskListItem.svelte';
	import LoadingSpinner from '$lib/components/shared/LoadingSpinner.svelte';
	import EmptyState from '$lib/components/shared/EmptyState.svelte';
	import ErrorBoundary from '$lib/components/shared/ErrorBoundary.svelte';
	import Sidebar from '$lib/components/layout/Sidebar.svelte';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { Slider } from '$lib/components/ui/slider';
	import ArrowUpDown from '@lucide/svelte/icons/arrow-up-down';
	import ListFilter from '@lucide/svelte/icons/list-filter';
	import { fly } from 'svelte/transition';
	import { flip } from 'svelte/animate';
	import type { TaskSummary, TaskStatus } from '$lib/task/types';

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
		const set = new Set<TaskStatus>();
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
		Math.max(1000, ...taskList.items.map((t) => t.totalPledged))
	);

	// Round up to a nice number for the slider max
	const sliderMax = $derived.by(() => {
		const raw = maxPledge;
		if (raw <= 10_000) return 10_000;
		if (raw <= 100_000) return 100_000;
		if (raw <= 500_000) return 500_000;
		return Math.ceil(raw / 100_000) * 100_000;
	});

	const sortFns: Record<string, (a: TaskSummary, b: TaskSummary) => number> = {
		reward: (a, b) => b.totalPledged - a.totalPledged,
		newest: (a, b) => b.createdAt - a.createdAt,
		solutions: (a, b) => b.solutionCount - a.solutionCount
	};

	const filteredTasks = $derived.by(() => {
		const statuses = statusFilters;
		return taskList.items
			.filter((t: TaskSummary) => statuses.has(t.status))
			.filter((t: TaskSummary) => !selectedTag || t.tags.includes(selectedTag))
			.filter((t: TaskSummary) => t.totalPledged >= minSats)
			.sort(sortFns[sortBy]);
	});

	function formatSats(n: number): string {
		if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
		if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
		return String(n);
	}
</script>

<svelte:head>
	<title>Tasks.fyi - Decentralized Task Board</title>
</svelte:head>

<ErrorBoundary>
	<div class="flex gap-8">
		<Sidebar bind:selectedTag />

		<section class="min-w-0 flex-1">
			<!-- List header with filters -->
			<div class="flex flex-col gap-3 border-b border-border px-4 pb-3">
				<div class="flex items-center justify-between">
					<h2 class="text-sm font-medium text-foreground">
						{selectedTag ? selectedTag : 'All tasks'}
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

			<!-- Task list -->
			{#if taskList.loading && taskList.items.length === 0}
				<div class="flex items-center justify-center py-12">
					<LoadingSpinner size="lg" />
				</div>
			{:else if taskList.error}
				<div class="rounded-lg border border-destructive/50 bg-destructive/10 p-8 text-center">
					<p class="text-sm text-destructive">{taskList.error}</p>
				</div>
			{:else if filteredTasks.length === 0}
				<EmptyState
					message={selectedTag
						? `No tasks found for "${selectedTag}". Try a different category.`
						: 'No tasks match the current filters.'}
				/>
			{:else}
				<div>
					{#each filteredTasks as task (task.id)}
						<div
							animate:flip={{ duration: animate ? 250 : 0 }}
							out:fly={{ y: -10, duration: animate ? 150 : 0 }}
						>
							<TaskListItem {task} />
						</div>
					{/each}
				</div>
			{/if}
		</section>
	</div>
</ErrorBoundary>
