<!-- SECURITY: This file handles private key material. Never persist or log nsec values. -->
<script lang="ts">
	import { accountState } from '$lib/nostr/account.svelte';
	import { signerState } from '$lib/nostr/signer.svelte';

	let showInstallPrompt = $state(false);
	let showNsecInput = $state(false);
	let nsecValue = $state('');
	let nsecError = $state<string | null>(null);

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
			showNsecInput = false;
		}
	}

	function toggleNsecInput() {
		showNsecInput = !showNsecInput;
		nsecValue = '';
		nsecError = null;
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
		class="cursor-pointer rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50"
	>
		{#if accountState.loading}
			Signing in...
		{:else}
			Login
		{/if}
	</button>

	<button
		onclick={toggleNsecInput}
		class="mt-1 block cursor-pointer text-xs text-muted-foreground transition-colors hover:text-foreground"
		aria-label={showNsecInput ? 'Hide nsec input' : 'Login with nsec'}
	>
		{showNsecInput ? 'cancel' : 'or paste nsec'}
	</button>

	{#if showNsecInput}
		<div class="mt-2 w-72 rounded-lg border border-border bg-card p-4 shadow-lg">
			<p class="mb-3 text-xs text-amber-600 dark:text-amber-400">
				⚠️ Pasting your private key is less secure than using a signer extension. Your key is kept in memory only and never stored.
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
					placeholder="nsec1..."
					bind:value={nsecValue}
					class="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
				/>
				<button
					type="submit"
					class="cursor-pointer rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
				>
					Login with nsec
				</button>
			</form>
			{#if nsecError}
				<p class="mt-2 text-xs text-destructive" role="alert">{nsecError}</p>
			{/if}
		</div>
	{/if}

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
					class="text-sm text-primary underline transition-colors hover:text-primary/80"
				>
					nos2x (Chrome)
				</a>
				<a
					href="https://getalby.com"
					target="_blank"
					rel="noopener noreferrer"
					class="text-sm text-primary underline transition-colors hover:text-primary/80"
				>
					Alby (Chrome, Firefox)
				</a>
			</div>
			<button
				onclick={dismissPrompt}
				class="mt-3 cursor-pointer text-xs text-muted-foreground transition-colors hover:text-foreground"
				aria-label="Dismiss install prompt"
			>
				Dismiss
			</button>
		</div>
	{/if}

	{#if accountState.error && !showInstallPrompt && accountState.error.type !== 'invalid-nsec'}
		<p class="absolute right-0 top-full mt-1 text-xs text-destructive" role="alert">
			{accountState.error.message}
		</p>
	{/if}
</div>
