<script lang="ts">
	const { size = 'md' }: { size?: 'sm' | 'md' | 'lg' } = $props();

	const sizeClasses: Record<string, string> = {
		sm: 'h-4 w-4 border-2',
		md: 'h-8 w-8 border-3',
		lg: 'h-12 w-12 border-4'
	};
</script>

<span
	class="loading-spinner inline-block rounded-full border-primary border-t-transparent {sizeClasses[size]}"
	role="status"
	aria-label="Loading"
>
	<span class="sr-only">Loading</span>
</span>

<style>
	@media (prefers-reduced-motion: no-preference) {
		.loading-spinner {
			animation: spin 0.75s linear infinite;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.loading-spinner {
			animation: pulse-opacity 1.5s ease-in-out infinite;
		}
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	@keyframes pulse-opacity {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.4;
		}
	}
</style>
