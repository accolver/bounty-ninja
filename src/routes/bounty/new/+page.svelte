<script lang="ts">
	import BountyForm from '$lib/components/bounty/BountyForm.svelte';
	import LoginButton from '$lib/components/auth/LoginButton.svelte';
	import ErrorBoundary from '$lib/components/shared/ErrorBoundary.svelte';
	import { accountState } from '$lib/nostr/account.svelte';
</script>

<svelte:head>
	<title>Create Bounty - Tasks.fyi</title>
</svelte:head>

<ErrorBoundary>
	{#if accountState.isLoggedIn}
		<div class="mx-auto max-w-2xl">
			<h1 class="mb-6 text-2xl font-bold text-foreground">Create a Bounty</h1>
			<BountyForm />
		</div>
	{:else}
		<div class="mx-auto max-w-md py-12 text-center">
			<h1 class="mb-4 text-xl font-bold text-foreground">Create a Bounty</h1>
			<p class="mb-6 text-muted-foreground">Sign in with a Nostr extension to create a bounty.</p>
			<LoginButton />
		</div>
	{/if}
</ErrorBoundary>
