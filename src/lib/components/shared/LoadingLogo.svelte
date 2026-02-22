<script lang="ts">
	import { config } from '$lib/config';
</script>

<div
	class="absolute inset-0 z-40 flex justify-center bg-background pt-[20vh]"
	role="status"
	aria-label="Loading"
>
	<img src={config.app.logo} alt="" class="loading-logo h-16 w-16 opacity-60" aria-hidden="true" />
	<span class="sr-only">Loading</span>
</div>

<style>
	@media (prefers-reduced-motion: no-preference) {
		.loading-logo {
			animation: pulse-logo 2s ease-in-out infinite;
		}
	}

	@keyframes pulse-logo {
		0%,
		100% {
			opacity: 0.6;
			transform: scale(1);
		}
		50% {
			opacity: 0.3;
			transform: scale(0.95);
		}
	}
</style>
