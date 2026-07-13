<script lang="ts">
	import { pool, connectDefaultRelays } from '$lib/nostr/relay-pool';
	import { availability } from '$lib/stores/availability.svelte';
	import { errorMonitor } from '$lib/stores/error-monitor.svelte';
	import * as Dialog from '$lib/components/ui/dialog/index.js';

	type RelayInfo = { url: string; connected: boolean };

	let relays = $state<RelayInfo[]>([]);
	let open = $state(false);
	let checkingMint = $state(false);

	function updateRelayStatus() {
		const entries: RelayInfo[] = [];
		for (const [url, relay] of pool.relays) {
			let connected = false;
			try {
				connected = relay.connected ?? false;
			} catch {
				// A relay can throw while its WebSocket is being replaced.
			}
			entries.push({ url, connected });
		}
		relays = entries;
		availability.setRelayCoverage(
			entries.filter((relay) => relay.connected).length,
			entries.length
		);
	}

	function retryRelays() {
		availability.checkingRelays(relays.length);
		connectDefaultRelays();
		setTimeout(updateRelayStatus, 500);
	}

	async function retryMint() {
		checkingMint = true;
		try {
			const { clearWalletCache, getDefaultWallet } = await import('$lib/cashu/mint');
			clearWalletCache();
			await getDefaultWallet();
		} catch {
			errorMonitor.capture('Mint availability check failed', 'boundary', {
				source: 'availability'
			});
		} finally {
			checkingMint = false;
		}
	}

	const dotColor = $derived.by(() => {
		if (
			availability.browser.status === 'offline' ||
			availability.relays.status === 'unavailable' ||
			availability.publication.status === 'failed'
		) {
			return 'bg-destructive';
		}
		if (
			availability.relays.status === 'partial' ||
			availability.mint.status === 'unavailable' ||
			availability.cache.status === 'stale'
		) {
			return 'bg-warning';
		}
		if (availability.relays.status === 'checking') return 'bg-muted-foreground';
		return 'bg-success';
	});

	const statusLabel = $derived.by(() => {
		if (availability.browser.status === 'offline') return 'Availability: browser offline';
		if (availability.relays.status === 'unavailable') return 'Availability: relays unavailable';
		if (availability.publication.status === 'failed') return 'Availability: publication failed';
		if (availability.relays.status === 'partial') return 'Availability: partial relay coverage';
		if (availability.mint.status === 'unavailable') return 'Availability: mint unavailable';
		if (availability.cache.status === 'stale') return 'Availability: cached data is stale';
		return 'Availability: ready';
	});

	$effect(() => {
		updateRelayStatus();
		const interval = setInterval(updateRelayStatus, 3000);
		return () => clearInterval(interval);
	});
</script>

<Dialog.Root bind:open>
	<Dialog.Trigger
		class="inline-flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs text-foreground underline decoration-muted-foreground underline-offset-4 transition-colors hover:bg-muted hover:decoration-primary focus-visible:ring-2 focus-visible:ring-ring"
		aria-label={`${availability.relays.connected} of ${availability.relays.total} relays connected. Show connection details`}
		title={statusLabel}
	>
		<span class="inline-block h-2.5 w-2.5 rounded-full {dotColor}" aria-hidden="true"></span>
		<span>{availability.relays.connected}/{availability.relays.total} connected</span>
	</Dialog.Trigger>

	<Dialog.Content class="max-w-lg">
		<Dialog.Header>
			<Dialog.Title>Connection details</Dialog.Title>
			<Dialog.Description>
				Live browser, relay, mint, cache, and publishing availability.
			</Dialog.Description>
		</Dialog.Header>

		<section class="space-y-2" aria-labelledby="relay-connections-heading">
			<div class="flex items-center justify-between gap-3">
				<h3 id="relay-connections-heading" class="text-sm font-medium text-foreground">
					Relays ({availability.relays.connected}/{availability.relays.total} connected)
				</h3>
				<button
					type="button"
					onclick={retryRelays}
					class="hover:cursor-pointer text-sm text-foreground underline underline-offset-2 transition-colors hover:text-primary"
				>
					Retry relays
				</button>
			</div>
			{#if relays.length > 0}
				<ul class="max-h-64 divide-y divide-border overflow-y-auto border-y border-border text-xs">
					{#each relays as relay (relay.url)}
						<li class="flex items-center justify-between gap-3 py-2">
							<span class="min-w-0 break-all text-muted-foreground">{relay.url}</span>
							<span class="inline-flex shrink-0 items-center gap-1.5 text-foreground">
								<span
									class="h-2 w-2 rounded-full {relay.connected ? 'bg-success' : 'bg-destructive'}"
									aria-hidden="true"
								></span>
								{relay.connected ? 'Connected' : 'Disconnected'}
							</span>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="border-y border-border py-3 text-sm text-muted-foreground">
					No relays are configured.
				</p>
			{/if}
		</section>

		<section class="border-t border-border pt-2" aria-labelledby="availability-heading">
			<h3 id="availability-heading" class="sr-only">Other availability</h3>
			<dl class="divide-y divide-border text-xs">
				<div class="flex items-center gap-3 py-2">
					<dt class="w-20 text-muted-foreground">Browser</dt>
					<dd class="flex flex-1 items-center justify-between gap-2 text-foreground">
						<span>{availability.browser.status === 'online' ? 'Online' : 'Offline'}</span>
						{#if availability.browser.status === 'offline'}
							<button
								type="button"
								onclick={() => window.location.reload()}
								class="hover:cursor-pointer text-foreground underline underline-offset-2 transition-colors hover:text-primary"
								>Retry</button
							>
						{/if}
					</dd>
				</div>
				<div class="flex items-center gap-3 py-2">
					<dt class="w-20 text-muted-foreground">Mint</dt>
					<dd class="flex flex-1 items-center justify-between gap-2 text-foreground">
						<span>
							{availability.mint.status === 'ready'
								? 'Ready'
								: availability.mint.status === 'unavailable'
									? 'Unavailable'
									: availability.mint.status === 'checking'
										? 'Checking…'
										: 'Not checked'}
						</span>
						{#if availability.mint.status !== 'ready'}
							<button
								type="button"
								onclick={retryMint}
								disabled={checkingMint}
								class="hover:cursor-pointer text-foreground underline underline-offset-2 transition-colors hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
								>Check</button
							>
						{/if}
					</dd>
				</div>
				<div class="flex items-center gap-3 py-2">
					<dt class="w-20 text-muted-foreground">Cache</dt>
					<dd class="flex flex-1 items-center justify-between gap-2 text-foreground">
						<span>
							{availability.cache.status === 'fresh'
								? 'Fresh'
								: availability.cache.status === 'stale'
									? 'Stale'
									: 'Checking…'}
						</span>
						{#if availability.cache.status === 'stale'}
							<button
								type="button"
								onclick={retryRelays}
								class="hover:cursor-pointer text-foreground underline underline-offset-2 transition-colors hover:text-primary"
								>Refresh</button
							>
						{/if}
					</dd>
				</div>
				<div class="flex items-center gap-3 py-2">
					<dt class="w-20 text-muted-foreground">Publishing</dt>
					<dd class="flex flex-1 items-center justify-between gap-2 text-foreground">
						<span>
							{availability.publication.status === 'ready'
								? 'Ready'
								: availability.publication.status === 'publishing'
									? 'Publishing…'
									: availability.publication.status === 'failed'
										? 'Failed'
										: availability.publication.status === 'blocked'
											? 'Blocked'
											: 'Checking…'}
						</span>
						{#if availability.publication.status === 'failed' || availability.publication.status === 'blocked'}
							<button
								type="button"
								onclick={retryRelays}
								class="hover:cursor-pointer text-foreground underline underline-offset-2 transition-colors hover:text-primary"
								>Retry relays</button
							>
						{/if}
					</dd>
				</div>
			</dl>
		</section>
	</Dialog.Content>
</Dialog.Root>
