<script lang="ts">
	import { formatRelativeTime } from '$lib/utils/format';

	const { timestamp }: { timestamp: number } = $props();

	const isoString = $derived(new Date(timestamp * 1000).toISOString());
	const relativeText = $derived(formatRelativeTime(timestamp));
</script>

<time datetime={isoString} title={new Date(timestamp * 1000).toLocaleString()} class="text-xs text-muted-foreground">
	{relativeText}
</time>
