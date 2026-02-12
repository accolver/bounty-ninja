<script lang="ts">
	import '../app.css';
	import Header from '$lib/components/layout/Header.svelte';
	import Footer from '$lib/components/layout/Footer.svelte';
	import MobileNav from '$lib/components/layout/MobileNav.svelte';
	import Toaster from '$lib/components/shared/Toaster.svelte';
	import OfflineBanner from '$lib/components/shared/OfflineBanner.svelte';
	import { connectDefaultRelays } from '$lib/nostr/relay-pool';
	import { initCache } from '$lib/nostr/cache';
	import { errorMonitor } from '$lib/stores/error-monitor.svelte';

	let { children } = $props();

	// Initialize Nostr connectivity on app load
	$effect(() => {
		connectDefaultRelays();
		initCache();
	});

	// Register global error handlers in production
	$effect(() => {
		if (import.meta.env.PROD) {
			const cleanup = errorMonitor.init();
			return cleanup;
		}
	});
</script>

<div class="flex min-h-screen flex-col">
	<OfflineBanner />
	<Header />
	<main class="mx-auto w-full max-w-6xl flex-1 px-4 py-6 pb-20 sm:pb-6">
		{@render children()}
	</main>
	<Footer />
</div>

<MobileNav />
<Toaster />
