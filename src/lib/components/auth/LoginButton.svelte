<script lang="ts">
	import { accountState } from '$lib/nostr/account.svelte';
	import { signerState } from '$lib/nostr/signer.svelte';

	let showInstallPrompt = $state(false);

	async function handleLogin() {
		if (!signerState.available && !window.nostr) {
			showInstallPrompt = true;
			return;
		}
		showInstallPrompt = false;
		await accountState.login();

		if (accountState.error?.type === 'no-extension') {
			showInstallPrompt = true;
		}
	}

	function dismissPrompt() {
		showInstallPrompt = false;
	}
</script>

<div class="relative">
	<button
		onclick={handleLogin}
		disabled={accountState.loading}
		aria-label="Login with Nostr"
		class="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50"
	>
		{#if accountState.loading}
			Signing in...
		{:else}
			Login
		{/if}
	</button>

	{#if showInstallPrompt}
		<div
			class="absolute right-0 top-full z-50 mt-2 w-72 rounded-lg border border-border bg-card p-4 shadow-lg"
			role="alert"
		>
			<p class="mb-3 text-sm text-card-foreground">
				No Nostr signer extension detected. Install one to continue:
			</p>
			<div class="flex flex-col gap-2">
				<a
					href="https://github.com/nicehash/nos2x"
					target="_blank"
					rel="noopener noreferrer"
					class="text-sm text-primary underline hover:text-primary/80"
				>
					nos2x (Chrome)
				</a>
				<a
					href="https://getalby.com"
					target="_blank"
					rel="noopener noreferrer"
					class="text-sm text-primary underline hover:text-primary/80"
				>
					Alby (Chrome, Firefox)
				</a>
			</div>
			<button
				onclick={dismissPrompt}
				class="mt-3 text-xs text-muted-foreground hover:text-foreground"
				aria-label="Dismiss install prompt"
			>
				Dismiss
			</button>
		</div>
	{/if}

	{#if accountState.error && !showInstallPrompt}
		<p class="absolute right-0 top-full mt-1 text-xs text-destructive" role="alert">
			{accountState.error.message}
		</p>
	{/if}
</div>
