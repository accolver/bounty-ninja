<script lang="ts">
	import LoginButton from '$lib/components/auth/LoginButton.svelte';
	import ProfileMenu from '$lib/components/auth/ProfileMenu.svelte';
	import SearchDialog from '$lib/components/search/SearchDialog.svelte';
	import ThemeToggle from '$lib/components/shared/ThemeToggle.svelte';
	import RelayIndicator from '$lib/components/shared/RelayIndicator.svelte';
	import { accountState } from '$lib/nostr/account.svelte';
	import { searchDialog } from '$lib/stores/search-dialog.svelte';
	import { config } from '$lib/config';
	import SearchIcon from '@lucide/svelte/icons/search';
</script>

<header class="border-b border-border bg-card">
	<nav
		class="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-3 sm:gap-4"
		aria-label="Main navigation"
	>
		<!-- Left: Logo -->
		<div class="flex items-center">
			<a
				href="/"
				class="flex items-center gap-1.5 text-foreground transition-colors hover:text-foreground/90"
				aria-label="{config.app.nameCaps} home"
			>
				<img src={config.app.logo} alt="" class="h-7 w-7" aria-hidden="true" />
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 220 40"
					fill="currentColor"
					role="img"
					aria-label="{config.app.nameCaps} logo"
					class="h-5 w-auto"
				>
					<text
						x="0"
						y="30"
						font-family="system-ui, -apple-system, sans-serif"
						font-size="28"
						font-weight="700"
						letter-spacing="-0.5">bounty<tspan fill="var(--color-primary)">.ninja</tspan></text
					>
				</svg>
			</a>
		</div>

		<!-- Center: Search trigger (hidden on mobile) -->
		<div class="hidden flex-1 justify-center px-4 sm:flex">
			<button
				type="button"
				onclick={() => (searchDialog.open = true)}
				class="flex w-full max-w-sm cursor-pointer items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
				aria-label="Search bounties"
			>
				<SearchIcon class="size-4 shrink-0" />
				<span class="flex-1 text-left">Search bounties...</span>
				<kbd class="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium">
					⌘K
				</kbd>
			</button>
		</div>

		<!-- Right: Mobile search icon + relay indicator + theme toggle + auth -->
		<div class="flex shrink-0 items-center gap-1">
			<RelayIndicator />
			<ThemeToggle />

			{#if accountState.isLoggedIn}
				<ProfileMenu />
			{:else}
				<LoginButton />
			{/if}
		</div>
	</nav>
</header>

<SearchDialog />
