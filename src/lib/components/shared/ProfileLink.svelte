<script lang="ts">
	import type { Subscription } from 'rxjs';
	import type { NostrEvent } from 'nostr-tools';
	import { nip19 } from 'nostr-tools';
	import { eventStore } from '$lib/nostr/event-store';
	import { createProfileLoader } from '$lib/nostr/loaders/profile-loader';
	import ProfileAvatar from '$lib/components/auth/ProfileAvatar.svelte';
	import CredibilityBadge from '$lib/components/reputation/CredibilityBadge.svelte';
	import { formatNpub } from '$lib/utils/format';

	const {
		pubkey,
		size = 'sm',
		showAvatar = true,
		showReputation = true
	}: {
		/** Hex-encoded Nostr public key */
		pubkey: string;
		/** Avatar size */
		size?: 'sm' | 'md' | 'lg' | 'xl';
		/** Whether to show the avatar circle (default: true) */
		showAvatar?: boolean;
		/** Whether to show credibility badge (default: true) */
		showReputation?: boolean;
	} = $props();

	const npub = $derived(nip19.npubEncode(pubkey));

	// ── Load profile from relays ────────────────────────────────
	$effect(() => {
		const loader = createProfileLoader([pubkey]);
		return () => loader.unsubscribe();
	});

	// ── Read display name reactively from EventStore ────────────
	let profile = $state<{ name?: string; display_name?: string } | null>(null);

	$effect(() => {
		let sub: Subscription | undefined;

		sub = eventStore.replaceable(0, pubkey).subscribe((event: NostrEvent | undefined) => {
			if (event?.content) {
				try {
					profile = JSON.parse(event.content) as {
						name?: string;
						display_name?: string;
					};
				} catch {
					profile = null;
				}
			}
		});

		return () => sub?.unsubscribe();
	});

	const displayName = $derived(profile?.display_name ?? profile?.name ?? null);
	const label = $derived(displayName ?? formatNpub(npub));
</script>

<a
	href="/profile/{npub}"
	class="inline-flex items-center gap-1.5 font-medium text-primary transition-colors hover:underline hover:cursor-pointer focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
	aria-label="Profile: {label}"
>
	{#if showAvatar}
		<ProfileAvatar {pubkey} {size} />
	{/if}
	<span class="truncate">{label}</span>
	{#if showReputation}
		<CredibilityBadge {pubkey} />
	{/if}
</a>
