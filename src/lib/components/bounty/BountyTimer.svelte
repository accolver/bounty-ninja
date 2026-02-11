<script lang="ts">
	const { deadline }: { deadline: number | null } = $props();

	let now = $state(Math.floor(Date.now() / 1000));

	$effect(() => {
		if (deadline === null) return;

		const interval = setInterval(() => {
			now = Math.floor(Date.now() / 1000);
		}, 60_000);

		return () => clearInterval(interval);
	});

	const isExpired = $derived(deadline !== null && deadline <= now);
	const remaining = $derived(deadline !== null ? deadline - now : 0);

	const countdownText = $derived.by(() => {
		if (deadline === null) return '';
		if (isExpired) return 'Expired';

		const totalSeconds = remaining;
		const days = Math.floor(totalSeconds / 86400);
		const hours = Math.floor((totalSeconds % 86400) / 3600);
		const minutes = Math.floor((totalSeconds % 3600) / 60);

		const parts: string[] = [];
		if (days > 0) parts.push(`${days}d`);
		if (hours > 0) parts.push(`${hours}h`);
		if (minutes > 0 || parts.length === 0) parts.push(`${minutes}m`);

		return parts.join(' ');
	});
</script>

{#if deadline !== null}
	<span
		class="inline-flex items-center gap-1 text-xs {isExpired ? 'text-destructive' : 'text-muted-foreground'}"
		aria-label={isExpired ? 'Deadline expired' : `Time remaining: ${countdownText}`}
	>
		{#if !isExpired}
			<svg
				xmlns="http://www.w3.org/2000/svg"
				viewBox="0 0 16 16"
				fill="currentColor"
				class="h-3 w-3"
				aria-hidden="true"
			>
				<path
					fill-rule="evenodd"
					d="M8 15A7 7 0 1 0 8 1a7 7 0 0 0 0 14Zm.75-10.25a.75.75 0 0 0-1.5 0v3.5c0 .199.079.39.22.53l2 2a.75.75 0 1 0 1.06-1.06L8.75 7.94V4.75Z"
					clip-rule="evenodd"
				/>
			</svg>
		{/if}
		<span>{countdownText}</span>
	</span>
{/if}
