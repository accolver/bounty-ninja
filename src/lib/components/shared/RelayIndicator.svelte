<script lang="ts">
	import { pool, connectDefaultRelays } from '$lib/nostr/relay-pool';
	import { availability } from '$lib/stores/availability.svelte';
	import { errorMonitor } from '$lib/stores/error-monitor.svelte';

	type RelayInfo = { url: string; connected: boolean };

	let relays = $state<RelayInfo[]>([]);
	let open = $state(false);
	let checkingMint = $state(false);
	let menuRef = $state<HTMLDivElement | null>(null);
	let triggerRef = $state<HTMLButtonElement | null>(null);

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

	$effect(() => {
		if (!open) return;
		function onClickOutside(event: MouseEvent) {
			const target = event.target as Node;
			if (menuRef && !menuRef.contains(target) && triggerRef && !triggerRef.contains(target)) {
				open = false;
			}
		}
		const timer = setTimeout(() => document.addEventListener('click', onClickOutside, true), 0);
		return () => {
			clearTimeout(timer);
			document.removeEventListener('click', onClickOutside, true);
		};
	});

	$effect(() => {
		if (!open) return;
		function onKeyDown(event: KeyboardEvent) {
			if (event.key === 'Escape') {
				open = false;
				triggerRef?.focus();
			}
		}
		document.addEventListener('keydown', onKeyDown);
		return () => document.removeEventListener('keydown', onKeyDown);
	});
</script>

<div class="relative">
	<button
		bind:this={triggerRef}
		type="button"
		onclick={() => (open = !open)}
		class="inline-flex cursor-pointer items-center justify-center rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
		aria-expanded={open}
		aria-haspopup="dialog"
		aria-label={statusLabel}
		title={statusLabel}
	>
		<span class="inline-block h-2.5 w-2.5 rounded-full {dotColor}" aria-hidden="true"></span>
	</button>

	{#if open}
		<div
			bind:this={menuRef}
			class="absolute right-0 top-full z-50 mt-1 w-72 rounded-lg border border-border bg-card shadow-lg"
			role="dialog"
			aria-label="Availability status"
		>
			<div class="border-b border-border px-3 py-2">
				<p class="text-xs font-medium text-foreground">Availability</p>
			</div>
			<dl class="divide-y divide-border px-3 text-xs">
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
					<dt class="w-20 text-muted-foreground">Relays</dt>
					<dd class="flex flex-1 items-center justify-between gap-2 text-foreground">
						<span>{availability.relays.connected}/{availability.relays.total} connected</span>
						{#if availability.relays.status !== 'ready'}
							<button
								type="button"
								onclick={retryRelays}
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
		</div>
	{/if}
</div>
