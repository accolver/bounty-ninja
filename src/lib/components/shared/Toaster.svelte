<!--
  Toaster — renders the toast notification queue.
  Fixed position: bottom-right on desktop, bottom-center on mobile.
  Styled by type using Tokyo Night semantic tokens.
-->
<script lang="ts">
	import { toastStore, type ToastType } from '$lib/stores/toast.svelte';
	import CircleCheckIcon from '@lucide/svelte/icons/circle-check';
	import CircleXIcon from '@lucide/svelte/icons/circle-x';
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';
	import InfoIcon from '@lucide/svelte/icons/info';
	import XIcon from '@lucide/svelte/icons/x';

	/**
	 * Style map keyed by toast type.
	 * Uses Tailwind classes that reference the Tokyo Night semantic tokens
	 * defined in app.css (--color-success, --color-destructive, etc.).
	 */
	const typeStyles: Record<ToastType, { container: string; icon: string }> = {
		success: {
			container: 'border-success/60 bg-card text-success',
			icon: 'text-success'
		},
		error: {
			container: 'border-destructive/60 bg-card text-destructive',
			icon: 'text-destructive'
		},
		warning: {
			container: 'border-warning/60 bg-card text-warning',
			icon: 'text-warning'
		},
		info: {
			container: 'border-primary/60 bg-card text-primary',
			icon: 'text-primary'
		}
	};

	const typeIcons: Record<ToastType, typeof CircleCheckIcon> = {
		success: CircleCheckIcon,
		error: CircleXIcon,
		warning: TriangleAlertIcon,
		info: InfoIcon
	};
</script>

{#if toastStore.toasts.length > 0}
	<div
		class="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-sm:right-auto max-sm:left-1/2 max-sm:-translate-x-1/2"
		role="status"
		aria-live="polite"
		aria-relevant="additions removals"
	>
		{#each toastStore.toasts as toast (toast.id)}
			{@const styles = typeStyles[toast.type]}
			{@const Icon = typeIcons[toast.type]}
			<div
				class="toast-enter flex w-80 max-w-[calc(100vw-2rem)] items-start gap-3 rounded-lg border p-3 shadow-lg {styles.container}"
				role="alert"
			>
				<span class="mt-0.5 shrink-0 {styles.icon}" aria-hidden="true">
					<Icon class="size-4" />
				</span>

				<p class="flex-1 text-sm font-medium leading-snug text-card-foreground">
					{toast.message}
				</p>

				<button
					onclick={() => toastStore.dismiss(toast.id)}
					class="shrink-0 rounded-sm p-0.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
					aria-label="Dismiss notification"
				>
					<XIcon class="size-4" />
				</button>
			</div>
		{/each}
	</div>
{/if}

<style>
	/* Slide-in animation — respects prefers-reduced-motion via app.css global rule */
	@media (prefers-reduced-motion: no-preference) {
		.toast-enter {
			animation: toast-slide-in 0.2s ease-out;
		}
	}

	@keyframes toast-slide-in {
		from {
			opacity: 0;
			transform: translateY(0.5rem);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>
