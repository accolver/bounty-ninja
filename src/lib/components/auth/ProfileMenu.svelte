<script lang="ts">
	import { accountState } from '$lib/nostr/account.svelte';
	import { eventStore } from '$lib/nostr/event-store';
	import { createProfileLoader } from '$lib/nostr/loaders/profile-loader';
	import ProfileAvatar from './ProfileAvatar.svelte';
	import { formatNpub } from '$lib/utils/format';

	let open = $state(false);
	let menuRef = $state<HTMLDivElement | null>(null);
	let triggerRef = $state<HTMLButtonElement | null>(null);

	/** Load the logged-in user's Kind 0 profile from relays */
	$effect(() => {
		const pubkey = accountState.pubkey;
		if (!pubkey) return;
		const loader = createProfileLoader([pubkey]);
		return () => loader.unsubscribe();
	});

	/** Parse Kind 0 profile to get display name */
	const displayName = $derived.by(() => {
		if (!accountState.pubkey) return null;
		const event = eventStore.getReplaceable(0, accountState.pubkey);
		if (!event?.content) return null;
		try {
			const parsed = JSON.parse(event.content) as {
				name?: string;
				display_name?: string;
			};
			return parsed.display_name ?? parsed.name ?? null;
		} catch {
			return null;
		}
	});

	/** Label shown on the trigger button */
	const label = $derived(
		displayName ?? (accountState.npub ? formatNpub(accountState.npub) : 'Account')
	);

	function toggle() {
		open = !open;
	}

	function close() {
		open = false;
	}

	function handleSignOut() {
		close();
		accountState.logout();
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

		// Use setTimeout to avoid the current click event from immediately closing
		const timer = setTimeout(() => {
			document.addEventListener('click', onClickOutside, true);
		}, 0);

		return () => {
			clearTimeout(timer);
			document.removeEventListener('click', onClickOutside, true);
		};
	});

	/** Close dropdown on Escape key */
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

{#if accountState.isLoggedIn && accountState.pubkey}
	<div class="relative">
		<!-- Trigger button -->
		<button
			bind:this={triggerRef}
			onclick={toggle}
			class="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
			aria-expanded={open}
			aria-haspopup="menu"
			aria-label="Account menu"
		>
			<ProfileAvatar pubkey={accountState.pubkey} size="sm" />
			<span class="max-w-[120px] truncate text-foreground">
				{label}
			</span>
			<svg
				class="h-4 w-4 text-muted-foreground transition-transform {open ? 'rotate-180' : ''}"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
				stroke-width="2"
				aria-hidden="true"
			>
				<path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
			</svg>
		</button>

		<!-- Dropdown menu -->
		{#if open}
			<div
				bind:this={menuRef}
				class="absolute right-0 top-full z-50 mt-1 w-56 rounded-lg border border-border bg-card shadow-lg"
				role="menu"
				aria-label="Account actions"
			>
				<!-- Menu items -->
				<div class="py-1">
					<a
						href="/profile/{accountState.npub}"
						onclick={close}
						class="flex items-center gap-2 px-3 py-2 text-sm text-card-foreground transition-colors hover:bg-muted focus-visible:bg-muted"
						role="menuitem"
					>
						<svg
							class="h-4 w-4 text-muted-foreground"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="2"
							aria-hidden="true"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
							/>
						</svg>
						My Bounties
					</a>

					<a
						href="/task/new"
						onclick={close}
						class="flex items-center gap-2 px-3 py-2 text-sm text-card-foreground transition-colors hover:bg-muted focus-visible:bg-muted"
						role="menuitem"
					>
						<svg
							class="h-4 w-4 text-muted-foreground"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="2"
							aria-hidden="true"
						>
							<path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
						</svg>
						Create Task
					</a>
				</div>

				<!-- Divider + Sign Out -->
				<div class="border-t border-border py-1">
					<button
						onclick={handleSignOut}
						class="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive transition-colors hover:bg-muted focus-visible:bg-muted"
						role="menuitem"
					>
						<svg
							class="h-4 w-4"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="2"
							aria-hidden="true"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
							/>
						</svg>
						Sign Out
					</button>
				</div>
			</div>
		{/if}
	</div>
{/if}
