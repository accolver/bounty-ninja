<script lang="ts">
	import { pool } from '$lib/nostr/relay-pool';

	type RelayInfo = {
		url: string;
		connected: boolean;
	};

	let relays = $state<RelayInfo[]>([]);
	let open = $state(false);
	let menuRef = $state<HTMLDivElement | null>(null);
	let triggerRef = $state<HTMLButtonElement | null>(null);

	function shortenUrl(url: string): string {
		return url.replace(/^wss?:\/\//, '').replace(/\/$/, '');
	}

	function updateRelayStatus() {
		const relayMap = pool.relays;
		const entries: RelayInfo[] = [];

		for (const [url, relay] of relayMap) {
			let connected = false;
			try {
				connected = relay.connected ?? false;
			} catch {
				connected = false;
			}
			entries.push({ url, connected });
		}

		relays = entries;
	}

	const connectedCount = $derived(relays.filter((r) => r.connected).length);
	const totalCount = $derived(relays.length);

	/** red = none connected, yellow = connecting (some but not all? or 0 with relays?), green = 1+ connected */
	const dotColor = $derived.by(() => {
		if (totalCount === 0) return 'bg-destructive';
		if (connectedCount === 0) return 'bg-destructive';
		return 'bg-success';
	});

	const statusLabel = $derived(`${connectedCount}/${totalCount} relays connected`);

	$effect(() => {
		updateRelayStatus();
		const interval = setInterval(updateRelayStatus, 3000);
		return () => clearInterval(interval);
	});

	function toggle() {
		open = !open;
	}

	function close() {
		open = false;
	}

	/** Close dropdown when clicking outside */
	$effect(() => {
		if (!open) return;

		function onClickOutside(event: MouseEvent) {
			const target = event.target as Node;
			if (menuRef && !menuRef.contains(target) && triggerRef && !triggerRef.contains(target)) {
				close();
			}
		}

		const timer = setTimeout(() => {
			document.addEventListener('click', onClickOutside, true);
		}, 0);

		return () => {
			clearTimeout(timer);
			document.removeEventListener('click', onClickOutside, true);
		};
	});

	/** Close dropdown on Escape key */
	$effect(() => {
		if (!open) return;

		function onKeyDown(event: KeyboardEvent) {
			if (event.key === 'Escape') {
				close();
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
		onclick={toggle}
		class="inline-flex items-center justify-center rounded-md p-2 transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
		aria-expanded={open}
		aria-haspopup="menu"
		aria-label={statusLabel}
		title={statusLabel}
	>
		<span class="inline-block h-2.5 w-2.5 rounded-full {dotColor}" aria-hidden="true"></span>
	</button>

	{#if open}
		<div
			bind:this={menuRef}
			class="absolute right-0 top-full z-50 mt-1 w-64 rounded-lg border border-border bg-card shadow-lg"
			role="menu"
			aria-label="Relay status"
		>
			<div class="border-b border-border px-3 py-2">
				<p class="text-xs font-medium text-foreground">
					Relays ({connectedCount}/{totalCount} connected)
				</p>
			</div>
			<div class="py-1">
				{#each relays as relay (relay.url)}
					<div class="flex items-center gap-2 px-3 py-1.5 text-sm" role="menuitem">
						<span
							class="inline-block h-2 w-2 shrink-0 rounded-full {relay.connected
								? 'bg-success'
								: 'bg-destructive'}"
							aria-hidden="true"
						></span>
						<span class="truncate text-foreground">{shortenUrl(relay.url)}</span>
						<span class="ml-auto text-xs {relay.connected ? 'text-success' : 'text-destructive'}">
							{relay.connected ? 'Connected' : 'Disconnected'}
						</span>
					</div>
				{:else}
					<div class="px-3 py-2 text-xs text-muted-foreground">No relays configured</div>
				{/each}
			</div>
		</div>
	{/if}
</div>
