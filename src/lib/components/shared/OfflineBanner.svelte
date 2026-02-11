<script lang="ts">
	import { connectivity } from '$lib/stores/connectivity.svelte';
</script>

{#if !connectivity.online}
	<div
		class="fixed top-0 left-0 right-0 z-50 bg-warning/90 px-4 py-2 text-center text-sm font-medium text-background"
		role="alert"
	>
		Offline — showing cached data. Reconnecting...
	</div>
{/if}
