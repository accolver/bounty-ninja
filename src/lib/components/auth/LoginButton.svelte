<!-- SECURITY: This file handles private key material. Never persist or log nsec values. -->
<script lang="ts">
	import { accountState } from '$lib/nostr/account.svelte';
	import { signerState } from '$lib/nostr/signer.svelte';

	let open = $state(false);
	let showNsecForm = $state(false);
	let nsecValue = $state('');
	let nsecError = $state<string | null>(null);
	let menuRef = $state<HTMLDivElement | null>(null);
	let triggerRef = $state<HTMLButtonElement | null>(null);

	function toggle() {
		open = !open;
		if (!open) {
			showNsecForm = false;
			showInstallLinks = false;
			nsecValue = '';
			nsecError = null;
		}
	}

	function close() {
		open = false;
		showNsecForm = false;
		showInstallLinks = false;
		nsecValue = '';
		nsecError = null;
	}

	let showInstallLinks = $state(false);

	async function handleExtensionLogin() {
		if (!signerState.available && !window.nostr) {
			// No extension — show install links, not nsec form
			showInstallLinks = true;
			return;
		}
		close();
		await accountState.login();
	}

	function handleNsecSubmit() {
		nsecError = null;
		const nsec = nsecValue;
		// SECURITY: Clear the input immediately
		nsecValue = '';

		if (!nsec) {
			nsecError = 'Please enter your nsec key.';
			return;
		}

		accountState.loginWithNsec(nsec);

		if (accountState.error?.type === 'invalid-nsec') {
			nsecError = accountState.error.message;
		} else {
			close();
		}
	}

	/** Close dropdown when clicking outside */
	$effect(() => {
		if (!open) return;

		function onClickOutside(event: MouseEvent) {
			const target = event.target as Node;
			if (menuRef && !menuRef.contains(target) && triggerRef && !triggerRef.contains(target)) {
				close();
			}
		}

		const timer = setTimeout(() => {
			document.addEventListener('click', onClickOutside, true);
		}, 0);

		return () => {
			clearTimeout(timer);
			document.removeEventListener('click', onClickOutside, true);
		};
	});

	/** Close on Escape */
	$effect(() => {
		if (!open) return;

		function onKeyDown(event: KeyboardEvent) {
			if (event.key === 'Escape') {
				close();
				triggerRef?.focus();
			}
		}

		document.addEventListener('keydown', onKeyDown);
		return () => document.removeEventListener('keydown', onKeyDown);
	});
</script>

<div class="relative">
	<button
		bind:this={triggerRef}
		onclick={toggle}
		disabled={accountState.loading}
		aria-expanded={open}
		aria-haspopup="menu"
		aria-label="Login"
		class="cursor-pointer rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50"
	>
		{#if accountState.loading}
			Signing in…
		{:else}
			Login
		{/if}
	</button>

	{#if open}
		<div
			bind:this={menuRef}
			class="absolute right-0 top-full z-50 mt-2 w-72 rounded-lg border border-border bg-card p-3 shadow-lg"
			role="menu"
			aria-label="Login options"
		>
			{#if showInstallLinks}
				<!-- No extension detected — install links -->
				<div class="space-y-3">
					<div class="flex items-center gap-2">
						<button
							onclick={() => (showInstallLinks = false)}
							class="cursor-pointer text-muted-foreground transition-colors hover:text-foreground"
							aria-label="Back to login options"
						>
							<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
							</svg>
						</button>
						<h3 class="text-sm font-medium text-card-foreground">No Extension Detected</h3>
					</div>

					<p class="text-xs text-muted-foreground">
						Install a Nostr signer extension to sign in securely:
					</p>
					<div class="flex flex-col gap-2">
						<a href="https://github.com/nicehash/nos2x" target="_blank" rel="noopener noreferrer" class="text-sm text-primary underline transition-colors hover:text-primary/80">nos2x (Chrome)</a>
						<a href="https://getalby.com" target="_blank" rel="noopener noreferrer" class="text-sm text-primary underline transition-colors hover:text-primary/80">Alby (Chrome, Firefox)</a>
					</div>
					<p class="text-xs text-muted-foreground">
						Or go back and use <button onclick={() => { showInstallLinks = false; showNsecForm = true; }} class="cursor-pointer text-primary underline transition-colors hover:text-primary/80">paste nsec</button> instead.
					</p>
				</div>
			{:else if !showNsecForm}
				<!-- Option 1: NIP-07 Extension (preferred) -->
				<button
					onclick={handleExtensionLogin}
					class="flex w-full cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 text-sm text-card-foreground transition-colors hover:bg-muted"
					role="menuitem"
				>
					<svg class="h-5 w-5 shrink-0 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
						<path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
					</svg>
					<div class="text-left">
						<div class="font-medium">Signer Extension</div>
						<div class="text-xs text-muted-foreground">Recommended — nos2x, Alby, etc.</div>
					</div>
				</button>

				<div class="my-1.5 border-t border-border"></div>

				<!-- Option 2: nsec paste -->
				<button
					onclick={() => (showNsecForm = true)}
					class="flex w-full cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 text-sm text-card-foreground transition-colors hover:bg-muted"
					role="menuitem"
				>
					<svg class="h-5 w-5 shrink-0 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
						<path stroke-linecap="round" stroke-linejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
					</svg>
					<div class="text-left">
						<div class="font-medium">Paste nsec</div>
						<div class="text-xs text-muted-foreground">Less secure — key held in memory only</div>
					</div>
				</button>
			{:else}
				<!-- nsec form -->
				<div class="space-y-3">
					<div class="flex items-center gap-2">
						<button
							onclick={() => (showNsecForm = false)}
							class="cursor-pointer text-muted-foreground transition-colors hover:text-foreground"
							aria-label="Back to login options"
						>
							<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
							</svg>
						</button>
						<h3 class="text-sm font-medium text-card-foreground">Paste nsec</h3>
					</div>

					<p class="text-xs text-amber-600 dark:text-amber-400">
						⚠️ Less secure than a signer extension. Your key is kept in memory only and never stored.
					</p>

					<form
						onsubmit={(e) => { e.preventDefault(); handleNsecSubmit(); }}
						class="flex flex-col gap-2"
					>
						<input
							type="password"
							autocomplete="off"
							data-1p-ignore
							data-lpignore="true"
							data-form-type="other"
							placeholder="nsec1…"
							bind:value={nsecValue}
							class="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
						/>
						<button
							type="submit"
							class="cursor-pointer rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
						>
							Login
						</button>
					</form>

					{#if nsecError}
						<p class="text-xs text-destructive" role="alert">{nsecError}</p>
					{/if}

					<div class="border-t border-border pt-2">
						<p class="text-xs text-muted-foreground">
							Don't have an nsec? Get a signer extension:
						</p>
						<div class="mt-1 flex gap-3">
							<a href="https://github.com/nicehash/nos2x" target="_blank" rel="noopener noreferrer" class="text-xs text-primary underline transition-colors hover:text-primary/80">nos2x</a>
							<a href="https://getalby.com" target="_blank" rel="noopener noreferrer" class="text-xs text-primary underline transition-colors hover:text-primary/80">Alby</a>
						</div>
					</div>
				</div>
			{/if}
		</div>
	{/if}

	{#if accountState.error && !open && accountState.error.type !== 'invalid-nsec'}
		<p class="absolute right-0 top-full mt-1 text-xs text-destructive" role="alert">
			{accountState.error.message}
		</p>
	{/if}
</div>
