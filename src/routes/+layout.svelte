<script lang="ts">
	import '../app.css';
	import Header from '$lib/components/layout/Header.svelte';
	import Footer from '$lib/components/layout/Footer.svelte';
	import MobileNav from '$lib/components/layout/MobileNav.svelte';
	import Toaster from '$lib/components/shared/Toaster.svelte';
	import OfflineBanner from '$lib/components/shared/OfflineBanner.svelte';
	import { connectDefaultRelays } from '$lib/nostr/relay-pool';
	import { initCache } from '$lib/nostr/cache';
	import { scheduleEviction } from '$lib/nostr/cache-eviction';
	import { getSavedEvictionConfig } from '$lib/nostr/cache-settings';
	import { accountState } from '$lib/nostr/account.svelte';
	import { errorMonitor } from '$lib/stores/error-monitor.svelte';
	import { searchDialog } from '$lib/stores/search-dialog.svelte';
	import { pageLoading } from '$lib/stores/page-loading.svelte';
	import { beforeNavigate } from '$app/navigation';
	import { onMount, type Component } from 'svelte';

	let { children } = $props();
	let PaymentRecoveryPanel = $state<Component | null>(null);
	let ServiceWorkerUpdate = $state<Component | null>(null);

	function skipToMain(event: MouseEvent) {
		event.preventDefault();
		document.getElementById('main-content')?.focus();
	}

	// Close search dialog on navigation
	beforeNavigate(() => {
		searchDialog.open = false;
	});

	// Initialize Nostr connectivity once on app load
	onMount(() => {
		void Promise.all([
			import('$lib/components/payment/PaymentRecoveryPanel.svelte'),
			import('$lib/components/layout/ServiceWorkerUpdate.svelte')
		]).then(([recovery, updates]) => {
			PaymentRecoveryPanel = recovery.default;
			ServiceWorkerUpdate = updates.default;
		});
		connectDefaultRelays();
		void initCache()
			.then(() =>
				scheduleEviction(
					accountState.pubkey ?? accountState.rememberedPubkey,
					getSavedEvictionConfig()
				)
			)
			.catch((error: unknown) => {
				console.warn(
					`[cache] Initialization or scheduled eviction failed: ${error instanceof Error ? error.message : String(error)}`
				);
			});
	});

	// Register global error handlers in production
	$effect(() => {
		if (import.meta.env.PROD) {
			const cleanup = errorMonitor.init();
			return cleanup;
		}
	});
</script>

<a class="skip-link" href="#main-content" onclick={skipToMain}>Skip to main content</a>
<div class="flex min-h-dvh flex-col overflow-x-hidden">
	<OfflineBanner />
	{#if PaymentRecoveryPanel}<PaymentRecoveryPanel />{/if}
	{#if ServiceWorkerUpdate}<ServiceWorkerUpdate />{/if}
	<Header />
	<main
		id="main-content"
		tabindex="-1"
		class="mx-auto w-full max-w-6xl flex-1 px-4 py-6 pb-20 sm:pb-6"
	>
		{@render children()}
	</main>
	{#if !pageLoading.active}
		<Footer />
	{/if}
</div>

<MobileNav />
<Toaster />
