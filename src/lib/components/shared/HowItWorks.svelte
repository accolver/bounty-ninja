<script lang="ts">
	import Zap from '@lucide/svelte/icons/zap';
	import Users from '@lucide/svelte/icons/users';
	import CheckCircle from '@lucide/svelte/icons/check-circle';
	import X from '@lucide/svelte/icons/x';
	import { browser } from '$app/environment';

	import { config, storageKey } from '$lib/config';

	const DISMISSED_KEY = storageKey('how-it-works-dismissed');

	const wasDismissed = browser ? localStorage.getItem(DISMISSED_KEY) === '1' : false;
	let dismissed = $state(wasDismissed);

	function dismiss() {
		dismissed = true;
		if (browser) localStorage.setItem(DISMISSED_KEY, '1');
	}
</script>

{#if !dismissed}
	<div class="rounded-lg border border-border bg-card p-6">
		<div class="flex items-start justify-between">
			<h2 class="text-lg font-semibold text-foreground">How {config.app.name} works</h2>
			<button
				onclick={dismiss}
				class="cursor-pointer rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
				aria-label="Dismiss"
			>
				<X class="h-4 w-4" />
			</button>
		</div>

		<div class="mt-5 grid grid-cols-1 gap-6 sm:grid-cols-3">
			<div class="flex flex-col items-center gap-3 text-center">
				<div class="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
					<Zap class="h-6 w-6 text-primary" />
				</div>
				<h3 class="text-sm font-semibold text-foreground">1. Post a Bounty</h3>
				<p class="text-xs text-muted-foreground">
					Describe your bounty and set a reward in sats (small units of Bitcoin — think of them like cents to a dollar).
				</p>
			</div>

			<div class="flex flex-col items-center gap-3 text-center">
				<div class="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
					<Users class="h-6 w-6 text-primary" />
				</div>
				<h3 class="text-sm font-semibold text-foreground">2. Others Apply</h3>
				<p class="text-xs text-muted-foreground">
					Others find your bounty and submit solutions. Review submissions as they come in.
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
				<strong class="text-foreground">Completely anonymous.</strong> No email, no accounts, no personal data. Sign in with a cryptographic key — we never know who you are.
				Built on <a href="https://nostr.com" target="_blank" rel="noopener noreferrer" class="text-primary underline transition-colors hover:text-primary/80">Nostr</a> (open protocol, no platform lock-in) with
				<a href="https://cashu.space" target="_blank" rel="noopener noreferrer" class="text-primary underline transition-colors hover:text-primary/80">Cashu</a> payments (private, instant Bitcoin).
			</p>
		</div>

		<div class="mt-4 text-center">
			<a href="/about" class="text-xs text-primary underline transition-colors hover:text-primary/80">
				Learn more about {config.app.name} →
			</a>
		</div>
	</div>
{/if}
