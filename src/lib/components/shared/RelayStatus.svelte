<script lang="ts">
	import { pool } from '$lib/nostr/relay-pool';

	type RelayInfo = {
		url: string;
		connected: boolean;
	};

	let relays = $state<RelayInfo[]>([]);

	function shortenUrl(url: string): string {
		return url.replace(/^wss?:\/\//, '').replace(/\/$/, '');
	}

	function updateRelayStatus() {
		const relayMap = pool.relays;
		const entries: RelayInfo[] = [];

		for (const [url, relay] of relayMap) {
			// Check if the relay's WebSocket is open
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

	$effect(() => {
		// Poll relay status periodically
		updateRelayStatus();
		const interval = setInterval(updateRelayStatus, 3000);
		return () => clearInterval(interval);
	});
</script>

<div class="flex flex-wrap items-center gap-3" role="status" aria-label="Relay connection status">
	{#each relays as relay (relay.url)}
		<div
			class="flex items-center gap-1.5 text-xs"
			aria-label="{shortenUrl(relay.url)}: {relay.connected ? 'connected' : 'disconnected'}"
		>
			<span
				class="inline-block h-2 w-2 rounded-full {relay.connected
					? 'bg-success'
					: 'bg-destructive'}"
				aria-hidden="true"
			></span>
			<span class="text-muted-foreground">{shortenUrl(relay.url)}</span>
		</div>
	{:else}
		<span class="text-xs text-muted-foreground">No relays configured</span>
	{/each}
</div>
