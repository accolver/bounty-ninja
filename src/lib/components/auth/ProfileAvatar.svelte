<script lang="ts">
	import type { Subscription } from 'rxjs';
	import type { NostrEvent } from 'nostr-tools';
	import { eventStore } from '$lib/nostr/event-store';

	const {
		pubkey,
		size = 'md'
	}: {
		pubkey: string;
		size?: 'sm' | 'md' | 'lg' | 'xl';
	} = $props();

	const sizeClasses: Record<string, string> = {
		sm: 'h-6 w-6 text-[10px]',
		md: 'h-8 w-8 text-xs',
		lg: 'h-12 w-12 text-sm',
		xl: 'h-16 w-16 text-2xl'
	};

	/** Reactive profile state updated via RxJS subscription */
	let profile = $state<{ picture?: string; name?: string; display_name?: string } | null>(null);

	/** Subscribe to EventStore's replaceable observable for Kind 0 */
	$effect(() => {
		let sub: Subscription | undefined;

		sub = eventStore.replaceable(0, pubkey).subscribe((event: NostrEvent | undefined) => {
			if (event?.content) {
				try {
					profile = JSON.parse(event.content) as {
						picture?: string;
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

	const pictureUrl = $derived(profile?.picture ?? null);
	const displayName = $derived(profile?.display_name ?? profile?.name ?? null);

	/**
	 * Generate a deterministic background color from a hex pubkey.
	 * Uses the first 6 hex chars as an HSL hue seed for consistent,
	 * visually distinct colors.
	 */
	const fallbackColor = $derived.by(() => {
		const hash = parseInt(pubkey.slice(0, 8), 16);
		const hue = hash % 360;
		return `hsl(${hue}, 65%, 45%)`;
	});

	/** First 2 characters of the pubkey as a visual identicon label */
	const initials = $derived(pubkey.slice(0, 2).toUpperCase());

	let imgError = $state(false);

	function handleImgError() {
		imgError = true;
	}

	const showImage = $derived(pictureUrl !== null && !imgError);
	const altText = $derived(
		displayName ? `${displayName}'s avatar` : `Avatar for ${pubkey.slice(0, 8)}`
	);
</script>

{#if showImage}
	<img
		src={pictureUrl}
		alt={altText}
		class="shrink-0 rounded-full border border-border object-cover {sizeClasses[size]}"
		onerror={handleImgError}
		loading="lazy"
		decoding="async"
	/>
{:else}
	<div
		class="inline-flex shrink-0 items-center justify-center rounded-full border border-border font-mono font-bold text-white select-none {sizeClasses[
			size
		]}"
		style:background-color={fallbackColor}
		role="img"
		aria-label={altText}
	>
		{initials}
	</div>
{/if}
