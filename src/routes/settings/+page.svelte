<script lang="ts">
	import { accountState } from '$lib/nostr/account.svelte';
	import LoginButton from '$lib/components/auth/LoginButton.svelte';
	import ErrorBoundary from '$lib/components/shared/ErrorBoundary.svelte';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { toastStore } from '$lib/stores/toast.svelte';
	import { errorMonitor } from '$lib/stores/error-monitor.svelte';
	import { cacheMonitor } from '$lib/nostr/cache-monitor.svelte';
	import { getDefaultRelays, getDefaultMint } from '$lib/utils/env';
	import { isValidRelayUrl } from '$lib/utils/relay-validation';
	import { pool } from '$lib/nostr/relay-pool';
	import { onMount } from 'svelte';

	const SETTINGS_KEY = 'bounty.ninja:settings';
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
	let errorLogOpen = $state(false);

	onMount(() => {
		cacheMonitor.startMonitoring(30_000);
		return () => {
			cacheMonitor.stopMonitoring();
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
				await cacheMonitor.refresh();
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
		const validation = isValidRelayUrl(url);
		if (!validation.valid) {
			relayError = validation.error ?? 'Invalid relay URL';
			return;
		}
		if (settings.relays.includes(url)) {
			relayError = 'This relay is already in your list';
			return;
		}
		settings.relays = [...settings.relays, url];
		saveSettings(settings);
		// Add to live pool immediately
		pool.relay(url);
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
		toastStore.success('Relay removed — reconnecting…');
		// Reload to cleanly reinitialize the pool with updated relay list
		setTimeout(() => window.location.reload(), 300);
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
		<section class="mx-auto max-w-5xl space-y-6">
			<h1 class="text-2xl font-bold text-foreground">Settings</h1>

			<!-- Top row: Relays + Cashu Mint side by side -->
			<div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
				<!-- Relay Management — takes 2 cols on desktop -->
				<div class="space-y-4 rounded-lg border border-border bg-card p-5 lg:col-span-2">
					<h2 class="text-lg font-semibold text-foreground">Relay Management</h2>
					<ul class="space-y-1.5" aria-label="Configured relays">
						{#each settings.relays as relay}
							<li
								class="flex items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-1.5"
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
				<div class="space-y-3 rounded-lg border border-border bg-card p-5">
					<h2 class="text-lg font-semibold text-foreground">Cashu Mint</h2>
					<Input
						bind:value={settings.mint}
						placeholder="https://mint.example.com"
						onblur={updateMint}
					/>
					<div class="flex items-center justify-between">
						<p class="truncate text-xs text-muted-foreground">Default: {getDefaultMint()}</p>
						<Button variant="outline" size="sm" onclick={resetMint}>Reset</Button>
					</div>
				</div>
			</div>

			<!-- Bottom row: Cache Management + Error Log side by side -->
			<div class="grid grid-cols-1 gap-6 md:grid-cols-2">
				<!-- Cache Management -->
				<div class="space-y-4 rounded-lg border border-border bg-card p-5">
					<h2 class="text-lg font-semibold text-foreground">Cache Management</h2>

					<!-- Cache Statistics -->
					<div class="grid grid-cols-2 gap-3">
						<div class="rounded-md border border-border bg-background p-3">
							<p class="text-xs text-muted-foreground">Cached Events</p>
							<p class="text-lg font-semibold text-foreground">
								{cacheMonitor.eventCount.toLocaleString()}
							</p>
						</div>
						<div class="rounded-md border border-border bg-background p-3">
							<p class="text-xs text-muted-foreground">Estimated Size</p>
							<p class="text-lg font-semibold text-foreground">
								{cacheMonitor.estimatedSizeFormatted}
							</p>
						</div>
					</div>

					<!-- Cache Limits -->
					<div class="grid grid-cols-2 gap-3">
						<div class="flex items-center gap-2">
							<label for="max-events" class="shrink-0 text-sm text-muted-foreground">
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
							/>
						</div>
						<div class="flex items-center gap-2">
							<label for="max-age-days" class="shrink-0 text-sm text-muted-foreground">
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
							/>
						</div>
					</div>

					<!-- Clear Cache -->
					<div class="flex items-center gap-3 border-t border-border pt-3">
						<Button variant="destructive" size="sm" onclick={clearCache} disabled={clearingCache}>
							{clearingCache ? 'Clearing…' : 'Clear Cache'}
						</Button>
						<p class="text-xs text-muted-foreground">
							Removes all cached events. Data re-fetched from relays.
						</p>
					</div>
				</div>

				<!-- Error Log (only visible when errors exist) -->
				{#if errorMonitor.hasErrors}
					<div class="space-y-4 rounded-lg border border-border bg-card p-5">
						<div class="flex items-center justify-between">
							<button
								onclick={() => (errorLogOpen = !errorLogOpen)}
								class="flex cursor-pointer items-center gap-2 text-lg font-semibold text-foreground transition"
								aria-expanded={errorLogOpen}
								aria-controls="error-log-list"
							>
								<span
									class="inline-block transition-transform {errorLogOpen
										? 'rotate-90'
										: ''}"
									aria-hidden="true">&#9654;</span
								>
								Error Log ({errorMonitor.count})
							</button>
							<Button
								variant="ghost"
								size="sm"
								onclick={() => {
									errorMonitor.clear();
									toastStore.success('Error log cleared');
								}}
								class="text-destructive hover:text-destructive"
							>
								Clear
							</Button>
						</div>

						{#if errorLogOpen}
							<ul
								id="error-log-list"
								class="max-h-64 space-y-2 overflow-y-auto"
								aria-label="Captured errors"
							>
								{#each errorMonitor.entries as entry}
									<li class="rounded-md border border-border bg-background p-2.5">
										<div class="flex items-start justify-between gap-2">
											<span
												class="inline-block rounded px-1.5 py-0.5 text-xs font-medium {entry.type ===
												'error'
													? 'bg-destructive/20 text-destructive'
													: entry.type === 'unhandled-rejection'
														? 'bg-warning/20 text-warning'
														: 'bg-muted text-muted-foreground'}"
											>
												{entry.type}
											</span>
											<time
												class="shrink-0 text-xs text-muted-foreground"
												datetime={new Date(entry.timestamp).toISOString()}
											>
												{new Date(entry.timestamp).toLocaleTimeString()}
											</time>
										</div>
										<p class="mt-1 break-all font-mono text-xs text-foreground">
											{entry.message}
										</p>
										{#if entry.stack}
											<details class="mt-1">
												<summary
													class="cursor-pointer text-xs text-muted-foreground transition-colors hover:text-foreground"
												>
													Stack trace
												</summary>
												<pre
													class="mt-1 max-h-24 overflow-auto whitespace-pre-wrap break-all rounded bg-background p-2 text-xs text-muted-foreground">{entry.stack}</pre>
											</details>
										{/if}
									</li>
								{/each}
							</ul>
						{/if}
					</div>
				{/if}
			</div>
		</section>
	{/if}
</ErrorBoundary>
