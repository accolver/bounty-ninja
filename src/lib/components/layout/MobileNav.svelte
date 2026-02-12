<script lang="ts">
	import { page } from '$app/state';
	import { accountState } from '$lib/nostr/account.svelte';
	import { goto } from '$app/navigation';
	import { toastStore } from '$lib/stores/toast.svelte';
	import { searchDialog } from '$lib/stores/search-dialog.svelte';
	import HomeIcon from '@lucide/svelte/icons/house';
	import SearchIcon from '@lucide/svelte/icons/search';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import SettingsIcon from '@lucide/svelte/icons/settings';

	interface NavItem {
		href: string;
		label: string;
		icon: typeof HomeIcon;
		requiresAuth?: boolean;
		action?: () => void;
	}

	const items: NavItem[] = [
		{ href: '/', label: 'Home', icon: HomeIcon },
		{
			href: '/search',
			label: 'Search',
			icon: SearchIcon,
			action: () => (searchDialog.open = true)
		},
		{ href: '/bounty/new', label: 'Create', icon: PlusIcon, requiresAuth: true },
		{ href: '/settings', label: 'Settings', icon: SettingsIcon }
	];

	function handleNav(item: NavItem) {
		if (item.action) {
			item.action();
			return;
		}
		if (item.requiresAuth && !accountState.isLoggedIn) {
			toastStore.info('Sign in with a Nostr extension to create a bounty');
			return;
		}
		goto(item.href);
	}
</script>

<nav
	class="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card sm:hidden"
	aria-label="Mobile navigation"
>
	<div class="flex items-center justify-around">
		{#each items as item}
			<button
				type="button"
				onclick={() => handleNav(item)}
				class="flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-0.5 px-3 py-2 text-xs transition-colors
					{page.url.pathname === item.href ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}"
				aria-current={page.url.pathname === item.href ? 'page' : undefined}
			>
				<item.icon class="size-5" aria-hidden="true" />
				<span>{item.label}</span>
			</button>
		{/each}
	</div>
</nav>
