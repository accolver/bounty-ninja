<script lang="ts">
	import { accountState } from '$lib/nostr/account.svelte';
	import LoginButton from '$lib/components/auth/LoginButton.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import type { BountyStatus } from '$lib/bounty/types';
	import CoinsIcon from '@lucide/svelte/icons/coins';

	const {
		bountyStatus,
		onPledge
	}: {
		bountyStatus: BountyStatus;
		onPledge: () => void;
	} = $props();

	const canPledge = $derived(
		bountyStatus === 'draft' || bountyStatus === 'open' || bountyStatus === 'in_review'
	);

	const disabledReason = $derived(
		!canPledge
			? 'This bounty is no longer accepting pledges'
			: !accountState.isLoggedIn
				? 'Sign in to fund this bounty'
				: null
	);
</script>

{#if !canPledge}
	<!-- Status does not allow pledging -->
	<div
		class="inline-flex items-center gap-2 rounded-md border border-border bg-muted/30 px-4 py-2 text-sm text-muted-foreground"
		role="status"
		aria-label={disabledReason}
	>
		<CoinsIcon class="size-4" />
		<span>No longer accepting pledges</span>
	</div>
{:else if !accountState.isLoggedIn}
	<!-- Authenticated required -->
	<div class="flex flex-col items-start gap-2">
		<p class="text-sm text-muted-foreground">Sign in to fund this bounty</p>
		<LoginButton />
	</div>
{:else}
	<!-- Ready to pledge -->
	<Button onclick={onPledge} variant="default" size="lg">
		<CoinsIcon class="size-4" />
		Fund this bounty
	</Button>
{/if}
