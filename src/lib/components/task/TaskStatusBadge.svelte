<script lang="ts">
	import type { TaskStatus } from '$lib/task/types';
	import { Badge } from '$lib/components/ui/badge';

	const { status }: { status: TaskStatus } = $props();

	const statusConfig: Record<TaskStatus, { label: string; classes: string }> = {
		draft: { label: 'Draft', classes: 'bg-muted text-muted-foreground border-transparent' },
		open: { label: 'Open', classes: 'bg-success/15 text-success border-success/30' },
		in_review: { label: 'In Review', classes: 'bg-warning/15 text-warning border-warning/30' },
		completed: { label: 'Completed', classes: 'bg-primary/15 text-primary border-primary/30' },
		expired: { label: 'Expired', classes: 'bg-destructive/15 text-destructive border-destructive/30' },
		cancelled: { label: 'Cancelled', classes: 'bg-destructive/15 text-destructive border-destructive/30' }
	};

	const config = $derived(statusConfig[status]);
</script>

<Badge class={config.classes} aria-label="Status: {config.label}">
	{config.label}
</Badge>
