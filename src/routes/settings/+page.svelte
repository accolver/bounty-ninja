<script lang="ts">
	import { accountState } from '$lib/nostr/account.svelte';
	import LoginButton from '$lib/components/auth/LoginButton.svelte';
	import ErrorBoundary from '$lib/components/shared/ErrorBoundary.svelte';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { toastStore } from '$lib/stores/toast.svelte';
	import { getDefaultRelays, getDefaultMint } from '$lib/utils/env';
	import { onMount } from 'svelte';

	const SETTINGS_KEY = 'bounty.ninja:settings';
	const THEME_KEY = 'bounty.ninja:theme';
	const CACHE_LIMITS_KEY = 'bounty.ninja:cache-limits';

	/** Load settings from localStorage with safe fallback */
	function loadSettings(): { relays: string[]; mint: string } {
		try {
			const raw = localStorage.getItem(SETTINGS_KEY);
			if (raw) return JSON.parse(raw);
		} catch {
			/* ignore parse errors */
		}
		return { relays: getDefaultRelays(), mint: getDefaultMint() };
	}

	/** Persist settings to localStorage */
	function saveSettings(settings: { relays: string[]; mint: string }) {
		try {
			localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
		} catch {
			toastStore.error('Settings could not be saved — storage full');
		}
	}

	let settings = $state(loadSettings());
	let newRelay = $state('');
	let relayError = $state<string | null>(null);

	// Theme state — default to dark (Tokyo Night Storm)
	let isDark = $state(
		typeof document !== 'undefined' ? !document.documentElement.classList.contains('light') : true
	);

	// Cache limits state
	interface CacheLimits {
		maxEvents: number;
		maxAgeDays: number;
	}

	function loadCacheLimits(): CacheLimits {
		try {
			const raw = localStorage.getItem(CACHE_LIMITS_KEY);
			if (raw) return JSON.parse(raw);
		} catch {
			/* ignore parse errors */
		}
		return { maxEvents: 10_000, maxAgeDays: 30 };
	}

	let cacheLimits = $state(loadCacheLimits());
	let clearingCache = $state(false);

	// Cache monitor state — lazy loaded to avoid blocking page render
	let cacheEventCount = $state(0);
	let cacheEstimatedSize = $state('0 B');
	let cacheMonitorInterval: ReturnType<typeof setInterval> | null = null;

	async function refreshCacheStats() {
		try {
			const { getCacheEventCount, estimateCacheSize } = await import('$lib/nostr/cache-eviction');
			const [count, size] = await Promise.all([getCacheEventCount(), estimateCacheSize()]);
			cacheEventCount = count;
			cacheEstimatedSize = formatBytes(size);
		} catch {
			// Cache stats unavailable — not critical
		}
	}

	function formatBytes(bytes: number): string {
		if (bytes === 0) return '0 B';
		const units = ['B', 'KB', 'MB', 'GB'];
		const k = 1024;
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		const unitIndex = Math.min(i, units.length - 1);
		const value = bytes / Math.pow(k, unitIndex);
		return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
	}

	onMount(() => {
		// Initial refresh
		void refreshCacheStats();
		// Periodic refresh
		cacheMonitorInterval = setInterval(() => {
			void refreshCacheStats();
		}, 30_000);
		return () => {
			if (cacheMonitorInterval) clearInterval(cacheMonitorInterval);
		};
	});

	function saveCacheLimits() {
		try {
			localStorage.setItem(CACHE_LIMITS_KEY, JSON.stringify(cacheLimits));
			toastStore.success('Cache limits saved');
		} catch {
			toastStore.error('Cache limits could not be saved — storage full');
		}
	}

	async function clearCache() {
		clearingCache = true;
		try {
			const { deleteAllEvents } = await import('nostr-idb');
			const { getDatabase } = await import('$lib/nostr/cache');
			const db = getDatabase();
			if (db) {
				await deleteAllEvents(db);
				await refreshCacheStats();
				toastStore.success('Cache cleared successfully');
			} else {
				toastStore.error('Cache database not initialized');
			}
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			toastStore.error(`Failed to clear cache: ${message}`);
		} finally {
			clearingCache = false;
		}
	}

	function addRelay() {
		const url = newRelay.trim();
		if (!url.startsWith('wss://') && !url.startsWith('ws://')) {
			relayError = 'Relay URL must start with wss:// or ws://';
			return;
		}
		if (settings.relays.includes(url)) {
			relayError = 'This relay is already in your list';
			return;
		}
		settings.relays = [...settings.relays, url];
		saveSettings(settings);
		newRelay = '';
		relayError = null;
		toastStore.success('Relay added');
	}

	function removeRelay(url: string) {
		if (settings.relays.length <= 1) {
			if (!confirm('Removing all relays will prevent the app from loading data. Continue?')) {
				return;
			}
		}
		settings.relays = settings.relays.filter((r: string) => r !== url);
		saveSettings(settings);
		toastStore.success('Relay removed');
	}

	function updateMint() {
		saveSettings(settings);
		toastStore.success('Preferred mint updated');
	}

	function resetMint() {
		settings.mint = getDefaultMint();
		saveSettings(settings);
		toastStore.success('Mint reset to default');
	}

	function toggleTheme() {
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
		// Update theme-color meta tag for browser chrome
		const meta = document.querySelector('meta[name="theme-color"]');
		if (meta) meta.setAttribute('content', isDark ? '#1f2335' : '#f0f0f3');
	}
</script>

<svelte:head>
	<title>Settings — Bounty.ninja</title>
</svelte:head>

<ErrorBoundary>
	{#if !accountState.isLoggedIn}
		<section class="mx-auto max-w-lg space-y-4 py-12 text-center">
			<h1 class="text-2xl font-bold text-foreground">Settings</h1>
			<p class="text-muted-foreground">Sign in with a Nostr extension to manage your settings.</p>
			<LoginButton />
		</section>
	{:else}
		<section class="mx-auto max-w-2xl space-y-8">
			<h1 class="text-2xl font-bold text-foreground">Settings</h1>

			<!-- Relay Management -->
			<div class="space-y-4 rounded-lg border border-border bg-card p-6">
				<h2 class="text-lg font-semibold text-foreground">Relay Management</h2>
				<ul class="space-y-2" aria-label="Configured relays">
					{#each settings.relays as relay}
						<li
							class="flex items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-2"
						>
							<span class="truncate font-mono text-sm text-foreground">{relay}</span>
							<Button
								variant="ghost"
								size="sm"
								onclick={() => removeRelay(relay)}
								class="shrink-0 text-destructive hover:text-destructive"
							>
								Remove
							</Button>
						</li>
					{/each}
				</ul>
				<div class="flex items-start gap-2">
					<div class="flex-1">
						<Input
							bind:value={newRelay}
							placeholder="wss://relay.example.com"
							onkeydown={(e: KeyboardEvent) => {
								if (e.key === 'Enter') {
									e.preventDefault();
									addRelay();
								}
							}}
						/>
						{#if relayError}
							<p class="mt-1 text-xs text-destructive" role="alert">{relayError}</p>
						{/if}
					</div>
					<Button onclick={addRelay}>Add Relay</Button>
				</div>
			</div>

			<!-- Cashu Mint Selection -->
			<div class="space-y-4 rounded-lg border border-border bg-card p-6">
				<h2 class="text-lg font-semibold text-foreground">Cashu Mint</h2>
				<div class="flex items-start gap-2">
					<Input
						bind:value={settings.mint}
						placeholder="https://mint.example.com"
						onblur={updateMint}
						class="flex-1"
					/>
					<Button variant="outline" onclick={resetMint}>Reset</Button>
				</div>
				<p class="text-xs text-muted-foreground">Default: {getDefaultMint()}</p>
			</div>

			<!-- Theme Toggle -->
			<div class="space-y-4 rounded-lg border border-border bg-card p-6">
				<h2 class="text-lg font-semibold text-foreground">Theme</h2>
				<div class="flex items-center gap-4">
					<Button
						variant={isDark ? 'default' : 'outline'}
						onclick={() => {
							if (!isDark) toggleTheme();
						}}
					>
						Dark
					</Button>
					<Button
						variant={!isDark ? 'default' : 'outline'}
						onclick={() => {
							if (isDark) toggleTheme();
						}}
					>
						Light
					</Button>
				</div>
			</div>

			<!-- Cache Management -->
			<div class="space-y-4 rounded-lg border border-border bg-card p-6">
				<h2 class="text-lg font-semibold text-foreground">Cache Management</h2>

				<!-- Cache Statistics -->
				<div class="grid grid-cols-2 gap-4">
					<div class="rounded-md border border-border bg-background p-3">
						<p class="text-xs text-muted-foreground">Cached Events</p>
						<p class="text-lg font-semibold text-foreground">
							{cacheEventCount.toLocaleString()}
						</p>
					</div>
					<div class="rounded-md border border-border bg-background p-3">
						<p class="text-xs text-muted-foreground">Estimated Size</p>
						<p class="text-lg font-semibold text-foreground">
							{cacheEstimatedSize}
						</p>
					</div>
				</div>

				<!-- Cache Limits -->
				<div class="space-y-3">
					<h3 class="text-sm font-medium text-foreground">Cache Limits</h3>
					<div class="flex items-center gap-3">
						<label for="max-events" class="w-32 shrink-0 text-sm text-muted-foreground">
							Max events
						</label>
						<Input
							id="max-events"
							type="number"
							min={1000}
							max={100000}
							step={1000}
							bind:value={cacheLimits.maxEvents}
							onblur={saveCacheLimits}
							class="w-32"
						/>
					</div>
					<div class="flex items-center gap-3">
						<label for="max-age-days" class="w-32 shrink-0 text-sm text-muted-foreground">
							Max age (days)
						</label>
						<Input
							id="max-age-days"
							type="number"
							min={1}
							max={365}
							step={1}
							bind:value={cacheLimits.maxAgeDays}
							onblur={saveCacheLimits}
							class="w-32"
						/>
					</div>
				</div>

				<!-- Clear Cache -->
				<div class="flex items-center gap-3 border-t border-border pt-4">
					<Button variant="destructive" onclick={clearCache} disabled={clearingCache}>
						{clearingCache ? 'Clearing…' : 'Clear Cache'}
					</Button>
					<p class="text-xs text-muted-foreground">
						Remove all cached events from local storage. Data will be re-fetched from relays.
					</p>
				</div>
			</div>
		</section>
	{/if}
</ErrorBoundary>
