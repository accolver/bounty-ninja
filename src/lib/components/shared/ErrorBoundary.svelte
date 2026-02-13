<!--
  ErrorBoundary — catches rendering errors in child components.
  Uses Svelte 5's built-in <svelte:boundary> element.
  Provides a default fallback UI or accepts a custom fallback snippet.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { toastStore } from '$lib/stores/toast.svelte';
	import { errorMonitor } from '$lib/stores/error-monitor.svelte';
	import CircleXIcon from '@lucide/svelte/icons/circle-x';
	import RotateCcwIcon from '@lucide/svelte/icons/rotate-ccw';

	const {
		children,
		fallback,
		onError
	}: {
		/** Content to render inside the boundary */
		children: Snippet;
		/** Custom fallback UI. Receives the error and a reset function. */
		fallback?: Snippet<[{ error: Error; reset: () => void }]>;
		/** Optional callback when an error is caught (e.g. for error reporting) */
		onError?: (error: Error) => void;
	} = $props();

	function handleError(error: unknown, reset: () => void) {
		const err = error instanceof Error ? error : new Error(String(error));

		// Notify via toast
		toastStore.error(`Component error: ${err.message}`);

		// Capture in error monitor for debugging
		errorMonitor.capture(err.message, 'boundary', {
			stack: err.stack
		});

		// Forward to consumer callback if provided
		onError?.(err);

		// Log for debugging
		console.error('[ErrorBoundary]', err);
	}
</script>

<svelte:boundary onerror={handleError}>
	{@render children()}

	{#snippet failed(error, reset)}
		{#if fallback}
			{@render fallback({
				error: error instanceof Error ? error : new Error(String(error)),
				reset
			})}
		{:else}
			<div
				role="alert"
				class="flex items-start gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4"
			>
				<CircleXIcon class="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden="true" />

				<div class="flex-1">
					<p class="text-sm font-medium text-destructive">Something went wrong</p>
					<p class="mt-1 text-xs text-muted-foreground">
						{error instanceof Error ? error.message : 'An unexpected error occurred'}
					</p>

					<button
						onclick={reset}
						class="mt-3 inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-card px-3 py-1.5 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
					>
						<RotateCcwIcon class="size-3" aria-hidden="true" />
						Try again
					</button>
				</div>
			</div>
		{/if}
	{/snippet}
</svelte:boundary>
