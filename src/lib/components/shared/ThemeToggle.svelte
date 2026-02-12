<script lang="ts">
	import SunIcon from '@lucide/svelte/icons/sun';
	import MoonIcon from '@lucide/svelte/icons/moon';

	const THEME_KEY = 'bounty.ninja:theme';

	let isDark = $state(true);

	// Initialize from localStorage / system preference
	$effect(() => {
		try {
			const stored = localStorage.getItem(THEME_KEY);
			if (stored === 'light') {
				isDark = false;
				document.documentElement.classList.add('light');
			} else if (stored === 'dark') {
				isDark = true;
				document.documentElement.classList.remove('light');
			}
		} catch {
			/* ignore */
		}
	});

	function toggle() {
		isDark = !isDark;
		if (isDark) {
			document.documentElement.classList.remove('light');
		} else {
			document.documentElement.classList.add('light');
		}
		try {
			localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light');
		} catch {
			/* ignore */
		}
		const meta = document.querySelector('meta[name="theme-color"]');
		if (meta) meta.setAttribute('content', isDark ? '#1f2335' : '#f0f0f3');
	}
</script>

<button
	type="button"
	onclick={toggle}
	class="inline-flex cursor-pointer items-center justify-center rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
	aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
>
	{#if isDark}
		<SunIcon class="size-5" />
	{:else}
		<MoonIcon class="size-5" />
	{/if}
</button>
