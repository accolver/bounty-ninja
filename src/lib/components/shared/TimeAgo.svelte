<script lang="ts">
	import { formatRelativeTime } from '$lib/utils/format';

	const { timestamp }: { timestamp: number } = $props();

	const isoString = $derived(new Date(timestamp * 1000).toISOString());

	// Tick counter incremented by the interval to force re-evaluation
	let tick = $state(0);

	const relativeText = $derived.by(() => {
		void tick; // subscribe to tick changes
		return formatRelativeTime(timestamp);
	});

	/** Choose an adaptive refresh interval based on event age */
	function getRefreshInterval(ts: number): number {
		const ageSeconds = Math.floor(Date.now() / 1000) - ts;
		if (ageSeconds < 3600) return 30_000; // < 1 hour: every 30s
		if (ageSeconds < 86400) return 60_000; // < 24 hours: every 60s
		return 300_000; // older: every 5 min
	}

	$effect(() => {
		const ms = getRefreshInterval(timestamp);
		const id = setInterval(() => {
			tick++;
		}, ms);
		return () => clearInterval(id);
	});
</script>

<time datetime={isoString} title={new Date(timestamp * 1000).toLocaleString()} class="text-xs text-muted-foreground">
	{relativeText}
</time>
