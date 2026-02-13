<script lang="ts">
	import Zap from '@lucide/svelte/icons/zap';
	import Users from '@lucide/svelte/icons/users';
	import CheckCircle from '@lucide/svelte/icons/check-circle';

	let open = $state(true);
</script>

<div class="rounded-lg border border-border bg-card p-6">
	<button
		onclick={() => (open = !open)}
		class="flex w-full cursor-pointer items-center justify-between text-left transition-colors hover:text-primary"
	>
		<h2 class="text-lg font-semibold text-foreground">How Bounty.ninja Works</h2>
		<span class="text-muted-foreground transition-transform {open ? 'rotate-180' : ''}" aria-hidden="true">
			▾
		</span>
	</button>

	{#if open}
		<div class="mt-5 grid grid-cols-1 gap-6 sm:grid-cols-3">
			<div class="flex flex-col items-center gap-3 text-center">
				<div class="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
					<Zap class="h-6 w-6 text-primary" />
				</div>
				<h3 class="text-sm font-semibold text-foreground">1. Post a Bounty</h3>
				<p class="text-xs text-muted-foreground">
					Describe your task and set a reward in sats (small units of Bitcoin — think of them like cents to a dollar).
				</p>
			</div>

			<div class="flex flex-col items-center gap-3 text-center">
				<div class="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
					<Users class="h-6 w-6 text-primary" />
				</div>
				<h3 class="text-sm font-semibold text-foreground">2. Builders Apply</h3>
				<p class="text-xs text-muted-foreground">
					Developers find your bounty and submit solutions. Review submissions as they come in.
				</p>
			</div>

			<div class="flex flex-col items-center gap-3 text-center">
				<div class="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
					<CheckCircle class="h-6 w-6 text-primary" />
				</div>
				<h3 class="text-sm font-semibold text-foreground">3. Review & Pay</h3>
				<p class="text-xs text-muted-foreground">
					Pick the best solution and release payment — it's instant via Bitcoin, no middlemen.
				</p>
			</div>
		</div>

		<div class="mt-5 rounded-md bg-muted/50 px-4 py-3 text-center">
			<p class="text-xs text-muted-foreground">
				Bounty.ninja runs on <a href="https://nostr.com" target="_blank" rel="noopener noreferrer" class="text-primary underline transition-colors hover:text-primary/80">Nostr</a>, an open protocol — your data isn't locked in any platform.
				Payments use Bitcoin via <a href="https://cashu.space" target="_blank" rel="noopener noreferrer" class="text-primary underline transition-colors hover:text-primary/80">Cashu</a>, a simple digital cash system.
			</p>
		</div>
	{/if}
</div>
