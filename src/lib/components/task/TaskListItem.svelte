<script lang="ts">
	import type { TaskSummary } from '$lib/task/types';
	import { TASK_KIND } from '$lib/task/kinds';
	import { nip19 } from 'nostr-tools';
	import TaskStatusBadge from './TaskStatusBadge.svelte';
	import SatAmount from '$lib/components/shared/SatAmount.svelte';
	import TimeAgo from '$lib/components/shared/TimeAgo.svelte';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';

	const { task }: { task: TaskSummary } = $props();

	const naddr = $derived(
		nip19.naddrEncode({
			identifier: task.dTag,
			pubkey: task.pubkey,
			kind: TASK_KIND
		})
	);
</script>

<a
	href="/task/{naddr}"
	class="group flex items-center gap-4 border-b border-border/50 px-4 py-5
		transition-colors hover:bg-card/60
		focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
	aria-label="Task: {task.title}"
>
	<!-- Title + metadata -->
	<div class="min-w-0 flex-1">
		<h3 class="truncate text-base font-semibold text-foreground group-hover:text-primary transition-colors">
			{task.title}
		</h3>
		<p class="mt-1.5 flex items-center gap-1.5 text-sm text-muted-foreground">
			{#if task.totalPledged > 0}
				<span class="text-base font-semibold">
					<SatAmount amount={task.totalPledged} />
				</span>
				<span aria-hidden="true">&middot;</span>
			{/if}
			{#if task.solutionCount > 0}
				<span>
					{task.solutionCount} {task.solutionCount === 1 ? 'solution' : 'solutions'}
				</span>
				<span aria-hidden="true">&middot;</span>
			{/if}
			<TimeAgo timestamp={task.createdAt} />
		</p>
	</div>

	<!-- Status badge + chevron -->
	<div class="flex shrink-0 items-center gap-3">
		<TaskStatusBadge status={task.status} />
		<ChevronRight class="h-4 w-4 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" />
	</div>
</a>
