<script lang="ts">
	import { config } from '$lib/config';
	import BountyForm from '$lib/components/bounty/BountyForm.svelte';
	import LoginButton from '$lib/components/auth/LoginButton.svelte';
	import ErrorBoundary from '$lib/components/shared/ErrorBoundary.svelte';
	import { accountState } from '$lib/nostr/account.svelte';
</script>

<svelte:head>
	<title>Create Bounty - {config.app.nameCaps}</title>
</svelte:head>

<ErrorBoundary>
	{#if accountState.isLoggedIn}
		<section class="mx-auto max-w-5xl space-y-6">
			<h1 class="text-2xl font-bold text-foreground">Create a Bounty</h1>
			<BountyForm />
		</section>
	{:else}
		<section class="mx-auto max-w-lg space-y-4 py-12 text-center">
			<h1 class="text-2xl font-bold text-foreground">Create a Bounty</h1>
			<p class="text-muted-foreground">Sign in with a Nostr extension to create a bounty.</p>
			<LoginButton />
		</section>
	{/if}
</ErrorBoundary>
