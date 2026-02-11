<script lang="ts">
	import { searchStore } from '$lib/stores/search.svelte';
	import SearchBar from '$lib/components/search/SearchBar.svelte';
	import SearchResults from '$lib/components/search/SearchResults.svelte';
	import ErrorBoundary from '$lib/components/shared/ErrorBoundary.svelte';

	const { data } = $props();

	$effect(() => {
		if (data.query) {
			searchStore.search(data.query);
		}
	});
</script>

<svelte:head>
	<title>{data.query ? `Search: ${data.query}` : 'Search'} — Tasks.fyi</title>
</svelte:head>

<ErrorBoundary>
	<section class="space-y-6">
		<SearchBar variant="hero" initialQuery={data.query} />
		{#if data.query}
			<SearchResults />
		{/if}
	</section>
</ErrorBoundary>
