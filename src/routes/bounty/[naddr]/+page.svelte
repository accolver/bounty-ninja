<script lang="ts">
	import { TaskDetailStore } from '$lib/stores/task-detail.svelte';
	import TaskDetailView from '$lib/components/task/TaskDetailView.svelte';
	import LoadingSpinner from '$lib/components/shared/LoadingSpinner.svelte';
	import ErrorBoundary from '$lib/components/shared/ErrorBoundary.svelte';

	const { data } = $props();

	const store = new TaskDetailStore();

	$effect(() => {
		store.load(data.taskAddress, data.kind, data.pubkey, data.dTag);

		return () => {
			store.destroy();
		};
	});
</script>

<svelte:head>
	<title>
		{store.task ? store.task.title : 'Loading Task...'} - Tasks.fyi
	</title>
</svelte:head>

<ErrorBoundary>
	{#if store.loading && !store.task}
		<div class="flex items-center justify-center py-12">
			<LoadingSpinner size="lg" />
		</div>
	{:else if store.error}
		<div class="rounded-lg border border-destructive/50 bg-destructive/10 p-8 text-center">
			<p class="text-sm text-destructive">{store.error}</p>
		</div>
	{:else if store.task}
		<TaskDetailView detail={store.task} />
	{:else}
		<div class="rounded-lg border border-border bg-card p-8 text-center">
			<p class="text-muted-foreground">Task not found.</p>
		</div>
	{/if}
</ErrorBoundary>
