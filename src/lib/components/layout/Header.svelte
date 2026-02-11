<script lang="ts">
	import LoginButton from '$lib/components/auth/LoginButton.svelte';
	import ProfileMenu from '$lib/components/auth/ProfileMenu.svelte';
	import SearchBar from '$lib/components/search/SearchBar.svelte';
	import ThemeToggle from '$lib/components/shared/ThemeToggle.svelte';
	import RelayIndicator from '$lib/components/shared/RelayIndicator.svelte';
	import { accountState } from '$lib/nostr/account.svelte';
	import SearchIcon from '@lucide/svelte/icons/search';
	import XIcon from '@lucide/svelte/icons/x';

	let showMobileSearch = $state(false);

	function handleMobileSearchClose() {
		showMobileSearch = false;
	}

	function handleMobileSearchKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			showMobileSearch = false;
		}
	}
</script>

<header class="border-b border-border bg-card">
	<nav
		class="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3"
		aria-label="Main navigation"
	>
		<!-- Left: Logo -->
		<div class="flex items-center">
			<a
				href="/"
				class="flex items-center gap-2 text-foreground hover:text-foreground/90"
				aria-label="Tasks.fyi home"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 180 40"
					fill="currentColor"
					role="img"
					aria-label="Tasks.fyi logo"
					class="h-6 w-auto"
				>
					<text
						x="0"
						y="30"
						font-family="system-ui, -apple-system, sans-serif"
						font-size="28"
						font-weight="700"
						letter-spacing="-0.5">Tasks<tspan fill="var(--color-primary)">.fyi</tspan></text
					>
				</svg>
			</a>
		</div>

		<!-- Center: Compact SearchBar (hidden on mobile) -->
		<div class="hidden flex-1 justify-center px-4 sm:flex">
			<SearchBar variant="compact" />
		</div>

		<!-- Right: Mobile search icon + relay indicator + theme toggle + auth -->
		<div class="flex items-center gap-1">
			<!-- Mobile search icon -->
			<button
				type="button"
				class="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground transition-colors hover:text-foreground sm:hidden"
				onclick={() => (showMobileSearch = true)}
				aria-label="Open search"
			>
				<SearchIcon class="size-5" />
			</button>

			<RelayIndicator />
			<ThemeToggle />

			{#if accountState.isLoggedIn}
				<ProfileMenu />
			{:else}
				<LoginButton />
			{/if}
		</div>
	</nav>

	<!-- Mobile search overlay -->
	{#if showMobileSearch}
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<div
			class="absolute inset-x-0 top-0 z-50 flex items-center gap-2 border-b border-border bg-card px-4 py-3 sm:hidden"
			onkeydown={handleMobileSearchKeydown}
			role="search"
		>
			<div class="flex-1">
				<SearchBar variant="compact" />
			</div>
			<button
				type="button"
				class="inline-flex shrink-0 items-center justify-center rounded-md p-2 text-muted-foreground transition-colors hover:text-foreground"
				onclick={handleMobileSearchClose}
				aria-label="Close search"
			>
				<XIcon class="size-5" />
			</button>
		</div>
	{/if}
</header>
