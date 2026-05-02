<script lang="ts">
	import LockKeyhole from '@lucide/svelte/icons/lock-keyhole';
	import FileCheck from '@lucide/svelte/icons/file-check';
	import Vote from '@lucide/svelte/icons/vote';
	import HandCoins from '@lucide/svelte/icons/hand-coins';

	const steps = [
		{
			icon: LockKeyhole,
			title: 'Pledgers lock funds',
			description: 'Cashu pledges are locked to each pledger key. Bounty.ninja never takes custody.'
		},
		{
			icon: FileCheck,
			title: 'Solvers submit work',
			description: 'Solutions are public Nostr events linked to the bounty.'
		},
		{
			icon: Vote,
			title: 'Consensus picks a winner',
			description: 'Votes and creator review identify the solution eligible for payout.'
		},
		{
			icon: HandCoins,
			title: 'Pledgers release payouts',
			description: 'Each pledger releases their portion directly to the winning solver.'
		}
	];
</script>

<section
	class="space-y-3 rounded-lg border border-border bg-background p-4"
	aria-label="How payouts work"
>
	<div class="space-y-1">
		<p class="text-xs font-medium uppercase tracking-wide text-primary">How payouts work</p>
		<h2 class="text-base font-semibold text-foreground">No platform custody, no backend escrow</h2>
		<p class="text-sm text-muted-foreground">
			Funds stay under pledger-controlled Cashu locks until a winning solution is ready to be
			released.
		</p>
	</div>

	<ol class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
		{#each steps as step, index (step.title)}
			{@const Icon = step.icon}
			<li class="space-y-2 border-l border-border pl-3">
				<div class="flex items-center gap-2 text-sm font-medium text-foreground">
					<span
						class="inline-flex h-6 w-6 items-center justify-center rounded-full border border-primary/40 text-xs text-primary"
					>
						{index + 1}
					</span>
					<Icon class="h-4 w-4 text-primary" />
				</div>
				<h3 class="text-sm font-medium text-foreground">{step.title}</h3>
				<p class="text-xs leading-relaxed text-muted-foreground">{step.description}</p>
			</li>
		{/each}
	</ol>
</section>
