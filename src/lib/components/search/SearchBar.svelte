<script lang="ts">
	import { goto } from '$app/navigation';
	import { Input } from '$lib/components/ui/input/index.js';
	import SearchIcon from '@lucide/svelte/icons/search';
	import { connectivity } from '$lib/stores/connectivity.svelte';

	const {
		variant = 'compact',
		initialQuery = ''
	}: {
		variant?: 'hero' | 'compact';
		initialQuery?: string;
	} = $props();

	let query = $state('');
	// Sync with initialQuery prop (including on navigation changes)
	$effect(() => {
		query = initialQuery;
	});
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;

	function handleSubmit() {
		// Clear any pending debounce
		if (debounceTimer) {
			clearTimeout(debounceTimer);
			debounceTimer = null;
		}

		const trimmed = query.trim();
		if (trimmed) {
			goto(`/search?q=${encodeURIComponent(trimmed)}`);
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			handleSubmit();
		}
	}
</script>

<form
	role="search"
	aria-label="Search bounties"
	onsubmit={(e) => {
		e.preventDefault();
		handleSubmit();
	}}
	class={variant === 'hero' ? 'mx-auto max-w-xl' : 'w-full max-w-sm'}
>
	<label for="search-input" class="sr-only">Search bounties</label>
	<div class="relative">
		<SearchIcon
			class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground {variant === 'hero'
				? 'size-5'
				: 'size-4'}"
		/>
		<Input
			id="search-input"
			type="search"
			bind:value={query}
			onkeydown={handleKeydown}
			disabled={!connectivity.online}
			placeholder={connectivity.online ? 'Search bounties...' : 'Search unavailable offline'}
			class={variant === 'hero' ? 'h-12 pl-10 text-lg' : 'h-9 pl-9 text-sm'}
		/>
	</div>
</form>
