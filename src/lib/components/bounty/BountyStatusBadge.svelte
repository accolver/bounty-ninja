<script lang="ts">
	import type { BountyStatus } from '$lib/bounty/types';
	import { Badge } from '$lib/components/ui/badge';

	const { status }: { status: BountyStatus } = $props();

	const statusConfig: Record<BountyStatus, { label: string; classes: string }> = {
		draft: {
			label: 'Draft',
			classes: 'border border-muted-foreground text-muted-foreground bg-transparent'
		},
		open: { label: 'Open', classes: 'border border-success text-success bg-transparent' },
		in_review: { label: 'In Review', classes: 'border border-warning text-warning bg-transparent' },
		consensus_reached: {
			label: 'Consensus Reached',
			classes: 'border border-info text-info bg-transparent'
		},
		releasing: {
			label: 'Releasing Funds',
			classes: 'border border-warning text-warning bg-transparent'
		},
		completed: { label: 'Completed', classes: 'border border-primary text-primary bg-transparent' },
		expired: {
			label: 'Expired',
			classes: 'border border-destructive text-destructive bg-transparent'
		},
		cancelled: {
			label: 'Cancelled',
			classes: 'border border-destructive text-destructive bg-transparent'
		}
	};

	const config = $derived(statusConfig[status]);
</script>

<Badge class={config.classes} aria-label="Status: {config.label}">
	{config.label}
</Badge>
