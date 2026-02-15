<script lang="ts">
	import type { Pledge } from '$lib/bounty/types';
	import SatAmount from '$lib/components/shared/SatAmount.svelte';
	import TimeAgo from '$lib/components/shared/TimeAgo.svelte';
	import ProfileLink from '$lib/components/shared/ProfileLink.svelte';
	import { tokenValidator, type TokenVerificationStatus } from '$lib/cashu/token-validator.svelte';

	import type { Payout } from '$lib/bounty/types';
	import RetractPledgeButton from '$lib/components/pledge/RetractPledgeButton.svelte';
	import { accountState } from '$lib/nostr/account.svelte';

	const {
		pledge,
		payouts = [],
		taskAddress = '',
		hasSolutions = false,
		isRetracted = false
	}: {
		pledge: Pledge;
		payouts?: Payout[];
		taskAddress?: string;
		hasSolutions?: boolean;
		isRetracted?: boolean;
	} = $props();

	const isPledgeAuthor = $derived(accountState.pubkey === pledge.pubkey);

	/** Check if this pledger has released (has a corresponding Kind 73004 event) */
	const hasReleased = $derived(payouts.some((p) => p.pubkey === pledge.pubkey));

	// Trigger token verification reactively
	$effect(() => {
		if (pledge.cashuToken && pledge.mintUrl) {
			tokenValidator.verify(pledge.cashuToken, pledge.mintUrl);
		}
	});

	// Read verification status reactively
	const verificationStatus: TokenVerificationStatus = $derived(
		pledge.cashuToken ? tokenValidator.getStatus(pledge.cashuToken) : 'pending'
	);

	// Badge styling per status
	const badgeConfig = $derived.by(() => {
		switch (verificationStatus) {
		case 'verified':
			return {
				label: 'Verified',
				classes: 'bg-success/15 text-success border-success/30',
				ariaLabel: 'Token verified'
			};
		case 'unverified':
			return {
				label: 'Unverified',
				classes: 'bg-warning/15 text-warning border-warning/30',
				ariaLabel: 'Token unverified'
			};
		case 'invalid':
			return {
				label: 'Invalid',
				classes: 'bg-destructive/15 text-destructive border-destructive/30',
				ariaLabel: 'Token invalid'
			};
		case 'expired':
			return {
				label: 'Expired',
				classes: 'bg-destructive/15 text-destructive border-destructive/30',
				ariaLabel: 'Token expired'
			};
			case 'pending':
			default:
				return {
					label: 'Verifying...',
					classes: 'bg-muted text-muted-foreground border-border',
					ariaLabel: 'Token verification in progress'
				};
		}
	});
</script>

<li class="flex flex-col gap-1 rounded-md border border-border bg-card p-3">
	<div class="flex items-center justify-between gap-2">
		<ProfileLink pubkey={pledge.pubkey} />
		<div class="flex items-center gap-2">
			{#if isRetracted}
				<span
					class="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium leading-tight bg-destructive/15 text-destructive border-destructive/30"
					aria-label="Pledge retracted"
					role="status"
				>
					Retracted
				</span>
			{:else if hasReleased}
				<span
					class="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium leading-tight bg-success/15 text-success border-success/30"
					aria-label="Funds released to solver"
					role="status"
				>
					Released
				</span>
			{/if}
			<span
				class="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium leading-tight {badgeConfig.classes}"
				aria-label={badgeConfig.ariaLabel}
				role="status"
			>
				{badgeConfig.label}
			</span>
			<SatAmount amount={pledge.amount} />
		</div>
	</div>

	<div class="flex items-center justify-between gap-2">
		{#if pledge.message}
			<p class="text-xs text-muted-foreground">{pledge.message}</p>
		{:else}
			<span></span>
		{/if}
		<div class="flex items-center gap-2">
			{#if isPledgeAuthor && !isRetracted && !hasReleased && taskAddress}
				<RetractPledgeButton
					{taskAddress}
					pledgeEventId={pledge.id}
					{hasSolutions}
				/>
			{/if}
			<TimeAgo timestamp={pledge.createdAt} />
		</div>
	</div>
</li>
