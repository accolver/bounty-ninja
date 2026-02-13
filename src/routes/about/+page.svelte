<script lang="ts">
	import { config } from '$lib/config';
</script>

<svelte:head>
	<title>About — {config.app.name}</title>
</svelte:head>

<div class="mx-auto max-w-2xl space-y-8 py-4">
	<div>
		<h1 class="text-2xl font-bold text-foreground">About {config.app.name}</h1>
		<p class="mt-2 text-muted-foreground">
			A decentralized bounty board where anyone can post bounties with Bitcoin rewards — and anyone can earn by completing them. No accounts, no middlemen, no platform lock-in.
		</p>
	</div>

	<!-- How it works -->
	<section class="space-y-4">
		<h2 class="text-lg font-semibold text-foreground">How it works</h2>
		<div class="space-y-3">
			<div class="flex gap-3">
				<span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">1</span>
				<div>
					<h3 class="text-sm font-medium text-foreground">Post a bounty</h3>
					<p class="text-sm text-muted-foreground">Describe what you need done and set a reward in sats. Your bounty is published to the Nostr network — visible to everyone, owned by no one.</p>
				</div>
			</div>
			<div class="flex gap-3">
				<span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">2</span>
				<div>
					<h3 class="text-sm font-medium text-foreground">Others apply</h3>
					<p class="text-sm text-muted-foreground">People browse bounties and submit solutions. You can review submissions as they come in and ask follow-up questions.</p>
				</div>
			</div>
			<div class="flex gap-3">
				<span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">3</span>
				<div>
					<h3 class="text-sm font-medium text-foreground">Review & pay</h3>
					<p class="text-sm text-muted-foreground">Pick the best solution and release payment. It's instant — Bitcoin goes directly to the solver, no processing delays or fees to us.</p>
				</div>
			</div>
		</div>
	</section>

	<!-- What are sats -->
	<section class="space-y-3 rounded-lg border border-border bg-card p-5">
		<h2 class="text-lg font-semibold text-foreground">What are sats?</h2>
		<p class="text-sm text-muted-foreground">
			Sats (short for satoshis) are the smallest unit of Bitcoin. Think of them like cents to a dollar — except there are 100 million sats in one Bitcoin.
		</p>
		<div class="rounded-md bg-muted/50 p-3">
			<p class="text-xs text-muted-foreground">
				<strong class="text-foreground">Quick reference:</strong>
				1,000 sats ≈ $0.50 · 10,000 sats ≈ $5 · 100,000 sats ≈ $50 · 1,000,000 sats ≈ $500
			</p>
			<p class="mt-1 text-xs text-muted-foreground italic">Approximate — varies with the Bitcoin price.</p>
		</div>
	</section>

	<!-- What is Nostr -->
	<section class="space-y-3 rounded-lg border border-border bg-card p-5">
		<h2 class="text-lg font-semibold text-foreground">What is Nostr?</h2>
		<p class="text-sm text-muted-foreground">
			Nostr is an open protocol for social communication. Instead of your data living on one company's servers (like Twitter or Reddit), it's stored across many independent servers called <strong class="text-foreground">relays</strong>.
		</p>
		<p class="text-sm text-muted-foreground">
			This means your bounties and profile aren't controlled by any single company. You own your identity (a cryptographic key pair) and can take it anywhere.
		</p>
		<div class="flex flex-wrap gap-3">
			<a href="https://nostr.com" target="_blank" rel="noopener noreferrer" class="text-sm text-primary underline transition-colors hover:text-primary/80">nostr.com — Learn more</a>
			<a href="https://nostr.how" target="_blank" rel="noopener noreferrer" class="text-sm text-primary underline transition-colors hover:text-primary/80">nostr.how — Beginner guide</a>
		</div>
	</section>

	<!-- What is Cashu -->
	<section class="space-y-3 rounded-lg border border-border bg-card p-5">
		<h2 class="text-lg font-semibold text-foreground">What is Cashu?</h2>
		<p class="text-sm text-muted-foreground">
			Cashu is a digital cash system built on Bitcoin. It uses "mints" — servers that issue digital tokens backed by real Bitcoin. These tokens can be sent instantly and privately.
		</p>
		<p class="text-sm text-muted-foreground">
			When you fund a bounty on {config.app.name}, the payment is held as Cashu tokens. When you approve a solution, the tokens are released to the solver — instantly, with no fees.
		</p>
		<a href="https://cashu.space" target="_blank" rel="noopener noreferrer" class="text-sm text-primary underline transition-colors hover:text-primary/80">cashu.space — Learn more</a>
	</section>

	<!-- Signing in -->
	<section class="space-y-3 rounded-lg border border-border bg-card p-5">
		<h2 class="text-lg font-semibold text-foreground">How do I sign in?</h2>
		<p class="text-sm text-muted-foreground">
			{config.app.name} doesn't use passwords or email accounts. Instead, you sign in with a <strong class="text-foreground">Nostr identity</strong> — a cryptographic key pair that works across the entire Nostr ecosystem.
		</p>
		<p class="text-sm text-muted-foreground">The easiest way to get started:</p>
		<ol class="list-inside list-decimal space-y-1 text-sm text-muted-foreground">
			<li>Install a browser extension like <a href="https://getalby.com" target="_blank" rel="noopener noreferrer" class="text-primary underline transition-colors hover:text-primary/80">Alby</a> or <a href="https://github.com/nicehash/nos2x" target="_blank" rel="noopener noreferrer" class="text-primary underline transition-colors hover:text-primary/80">nos2x</a></li>
			<li>Create a new Nostr identity in the extension (takes 10 seconds)</li>
			<li>Click <strong class="text-foreground">Login</strong> on {config.app.name} → <strong class="text-foreground">Browser Extension</strong></li>
		</ol>
		<p class="text-sm text-muted-foreground">
			Your identity works on any Nostr app — not just {config.app.name}. One key for the whole ecosystem.
		</p>
	</section>

	<!-- Relays -->
	<section class="space-y-3 rounded-lg border border-border bg-card p-5">
		<h2 class="text-lg font-semibold text-foreground">What are relays?</h2>
		<p class="text-sm text-muted-foreground">
			Relays are servers that store and deliver Nostr events (like your bounties and messages). {config.app.name} connects to several public relays by default so your bounties are widely available.
		</p>
		<p class="text-sm text-muted-foreground">
			You can customize which relays you use in <a href="/settings" class="text-primary underline transition-colors hover:text-primary/80">Settings</a>. More relays generally means better availability, but the defaults work great for most people.
		</p>
		<a href="https://nostr.watch" target="_blank" rel="noopener noreferrer" class="text-sm text-primary underline transition-colors hover:text-primary/80">nostr.watch — Browse public relays</a>
	</section>

	<!-- Open source -->
	<section class="space-y-3 rounded-lg border border-border bg-card p-5">
		<h2 class="text-lg font-semibold text-foreground">Open source & sovereign</h2>
		<p class="text-sm text-muted-foreground">
			{config.app.name} is fully open source. There's no backend server, no database we control, no accounts to hack. The entire app runs in your browser and talks directly to the Nostr relay network.
		</p>
		<ul class="list-inside list-disc space-y-1 text-sm text-muted-foreground">
			<li><strong class="text-foreground">No platform risk</strong> — your bounties exist on the Nostr network, not our servers</li>
			<li><strong class="text-foreground">No custody</strong> — we never hold your Bitcoin or keys</li>
			<li><strong class="text-foreground">No tracking</strong> — no analytics, no cookies, no data collection</li>
			<li><strong class="text-foreground">Portable</strong> — export your identity and use it anywhere on Nostr</li>
		</ul>
	</section>

	<div class="border-t border-border pt-6 text-center">
		<p class="text-xs text-muted-foreground">
			Built with <a href="https://svelte.dev" target="_blank" rel="noopener noreferrer" class="text-primary underline transition-colors hover:text-primary/80">SvelteKit</a>,
			<a href="https://nostr.com" target="_blank" rel="noopener noreferrer" class="text-primary underline transition-colors hover:text-primary/80">Nostr</a>, and
			<a href="https://cashu.space" target="_blank" rel="noopener noreferrer" class="text-primary underline transition-colors hover:text-primary/80">Cashu</a>.
			Deployed on <a href="https://pages.cloudflare.com" target="_blank" rel="noopener noreferrer" class="text-primary underline transition-colors hover:text-primary/80">Cloudflare Pages</a>.
		</p>
	</div>
</div>
