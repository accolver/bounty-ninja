<script lang="ts">
	let {
		action = 'Payment actions'
	}: {
		action?: string;
	} = $props();
</script>

<div class="border-y border-warning py-3" role="status" aria-live="polite">
	<p class="text-sm font-medium text-warning">{action} temporarily unavailable</p>
	<p class="mt-1 text-xs text-muted-foreground">
		Payments are disabled while wallet signing and fund-recovery safeguards are upgraded.
	</p>
</div>
