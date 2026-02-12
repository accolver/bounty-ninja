<script lang="ts">
	import type { Subscription } from 'rxjs';
	import type { NostrEvent } from 'nostr-tools';
	import { nip19 } from 'nostr-tools';
	import { eventStore } from '$lib/nostr/event-store';
	import { TASK_KIND } from '$lib/task/kinds';
	import { parseTaskSummary } from '$lib/task/helpers';
	import { createProfileLoader } from '$lib/nostr/loaders/profile-loader';
	import { createTaskByAuthorLoader } from '$lib/nostr/loaders/task-loader';
	import type { TaskSummary } from '$lib/task/types';
	import TaskCard from '$lib/components/task/TaskCard.svelte';
	import LoadingSpinner from '$lib/components/shared/LoadingSpinner.svelte';
	import EmptyState from '$lib/components/shared/EmptyState.svelte';
	import ErrorBoundary from '$lib/components/shared/ErrorBoundary.svelte';
	import ProfileAvatar from '$lib/components/auth/ProfileAvatar.svelte';
	import { formatNpub } from '$lib/utils/format';

	const { data } = $props();

	const npub = $derived(nip19.npubEncode(data.pubkey));

	let profile = $state<Record<string, string> | null>(null);
	let tasks = $state<TaskSummary[]>([]);
	let loading = $state(true);

	$effect(() => {
		const subs: Array<Subscription | { unsubscribe(): void }> = [];

		// Subscribe to profile metadata from EventStore
		const profileSub = eventStore
			.replaceable(0, data.pubkey)
			.subscribe((event: NostrEvent | undefined) => {
				if (event) {
					try {
						profile = JSON.parse(event.content);
					} catch {
						profile = null;
					}
				}
				loading = false;
			});
		subs.push(profileSub);

		// Subscribe to tasks by this author from EventStore
		const taskSub = eventStore
			.timeline({ kinds: [TASK_KIND], authors: [data.pubkey] })
			.subscribe((events: NostrEvent[]) => {
				tasks = events.map(parseTaskSummary).filter((s): s is TaskSummary => s !== null);
				loading = false;
			});
		subs.push(taskSub);

		// Start relay loaders
		subs.push(createProfileLoader([data.pubkey]));
		subs.push(createTaskByAuthorLoader(data.pubkey));

		// Timeout fallback
		const timer = setTimeout(() => {
			loading = false;
		}, 5000);

		return () => {
			clearTimeout(timer);
			for (const sub of subs) {
				sub.unsubscribe();
			}
		};
	});

	const displayName = $derived(profile?.name || profile?.display_name || formatNpub(npub));
	const about = $derived(profile?.about || '');
</script>

<svelte:head>
	<title>{displayName} - Tasks.fyi</title>
</svelte:head>

<ErrorBoundary>
	<section class="mx-auto max-w-3xl space-y-8">
		<!-- Profile header -->
		<header class="flex items-center gap-4">
			<ProfileAvatar pubkey={data.pubkey} size="xl" />
			<div>
				<h1 class="text-xl font-bold text-foreground">{displayName}</h1>
				<p class="text-xs font-mono text-muted-foreground">{formatNpub(npub)}</p>
			</div>
		</header>

		{#if about}
			<p class="text-sm text-muted-foreground">{about}</p>
		{/if}

		<!-- Tasks by this author -->
		<section>
			<h2 class="mb-4 text-lg font-semibold text-foreground">
				Tasks ({tasks.length})
			</h2>

			{#if loading && tasks.length === 0}
				<div class="flex items-center justify-center py-12">
					<LoadingSpinner size="md" />
				</div>
			{:else if tasks.length === 0}
				<EmptyState message="This user hasn't posted any tasks yet." />
			{:else}
				<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
					{#each tasks as task (task.id)}
						<TaskCard {task} />
					{/each}
				</div>
			{/if}
		</section>
	</section>
</ErrorBoundary>
