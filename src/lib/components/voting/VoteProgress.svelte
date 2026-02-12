<script lang="ts">
	import type { VoteTally } from '$lib/task/types';

	const { tally }: { tally: VoteTally } = $props();

	const totalWeight = $derived(tally.approveWeight + tally.rejectWeight);
	const approvePercent = $derived(totalWeight > 0 ? (tally.approveWeight / totalWeight) * 100 : 0);
	const rejectPercent = $derived(totalWeight > 0 ? (tally.rejectWeight / totalWeight) * 100 : 0);

	const statusText = $derived.by(() => {
		if (tally.isApproved) return 'Approved';
		if (tally.isRejected) return 'Rejected';
		return 'Pending';
	});

	const statusColor = $derived.by(() => {
		if (tally.isApproved) return 'text-primary';
		if (tally.isRejected) return 'text-destructive';
		return 'text-muted-foreground';
	});

	const formattedApprove = $derived(new Intl.NumberFormat().format(tally.approveWeight));
	const formattedReject = $derived(new Intl.NumberFormat().format(tally.rejectWeight));
</script>

<div class="space-y-2" role="group" aria-label="Vote progress">
	<!-- Progress bar -->
	<div
		class="flex h-3 w-full overflow-hidden rounded-full bg-muted"
		role="progressbar"
		aria-valuenow={approvePercent}
		aria-valuemin={0}
		aria-valuemax={100}
		aria-label="Approve: {formattedApprove} sats, Reject: {formattedReject} sats"
	>
		{#if totalWeight > 0}
			<div
				class="bg-success transition-all duration-300"
				style="width: {approvePercent}%"
			></div>
			<div
				class="bg-destructive transition-all duration-300"
				style="width: {rejectPercent}%"
			></div>
		{/if}
	</div>

	<!-- Weight numbers -->
	<div class="flex items-center justify-between text-xs">
		<span class="text-success" aria-label="Approve weight: {formattedApprove} sats">
			{formattedApprove} sats approve
		</span>
		<span class="text-destructive" aria-label="Reject weight: {formattedReject} sats">
			{formattedReject} sats reject
		</span>
	</div>

	<!-- Quorum + status -->
	<div class="flex items-center justify-between text-xs">
		<span class="text-muted-foreground">
			Quorum: {Math.round(tally.quorumPercent)}%
		</span>
		<span class="font-medium {statusColor}">
			{statusText}
		</span>
	</div>
</div>
