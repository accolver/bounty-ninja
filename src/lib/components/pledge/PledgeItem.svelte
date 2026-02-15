<script lang="ts">
	import type { Pledge } from '$lib/bounty/types';
	import { nip19 } from 'nostr-tools';
	import { formatNpub } from '$lib/utils/format';
	import SatAmount from '$lib/components/shared/SatAmount.svelte';
	import TimeAgo from '$lib/components/shared/TimeAgo.svelte';
	import { tokenValidator, type TokenVerificationStatus } from '$lib/cashu/token-validator.svelte';

	import type { Payout } from '$lib/bounty/types';

	const { pledge, payouts = [] }: { pledge: Pledge; payouts?: Payout[] } = $props();

	/** Check if this pledger has released (has a corresponding Kind 73004 event) */
	const hasReleased = $derived(payouts.some((p) => p.pubkey === pledge.pubkey));

	const npub = $derived(nip19.npubEncode(pledge.pubkey));

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
				classes: 'bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30',
				ariaLabel: 'Token verified'
			};
		case 'unverified':
			return {
				label: 'Unverified',
				classes: 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/30',
				ariaLabel: 'Token unverified'
			};
		case 'invalid':
			return {
				label: 'Invalid',
				classes: 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30',
				ariaLabel: 'Token invalid'
			};
		case 'expired':
			return {
				label: 'Expired',
				classes: 'bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30',
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
		<a
			href="/profile/{npub}"
			class="text-sm font-medium text-primary transition-colors hover:underline focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
			aria-label="Pledger profile: {formatNpub(npub)}"
		>
			{formatNpub(npub)}
		</a>
		<div class="flex items-center gap-2">
			{#if hasReleased}
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
		<TimeAgo timestamp={pledge.createdAt} />
	</div>
</li>
